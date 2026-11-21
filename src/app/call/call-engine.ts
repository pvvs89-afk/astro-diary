// Internet audio / video calls with WebRTC (open standard, built into browsers and
// phones - free). PocketBase is only used to ring and to exchange connection
// details ("signalling"); the voice/video goes directly between the two devices,
// or through a TURN relay when a mobile network blocks direct connections.
// The same file is used by the customer app and the admin panel.

/* eslint-disable @typescript-eslint/no-explicit-any */
import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';

export type CallSide = 'customer' | 'admin';
export type CallKind = 'audio' | 'video';
export type CallState = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ended';
/** Why a call ended (for the message shown for a moment). */
export type CallEnd = 'ended' | 'declined' | 'missed' | 'cancelled' | 'failed' | 'busy' | 'elsewhere' | 'media';

export interface CallEvents {
  state(s: CallState, end?: CallEnd): void;
  local(stream: MediaStream | null): void;
  remote(stream: MediaStream | null): void;
}

const RING_MS = 45_000;
const now = () => new Date().toISOString().replace('T', ' ');

export class CallEngine {
  call: RecordModel | null = null;
  state: CallState = 'idle';
  startedAt = 0;

  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingOut: RTCIceCandidateInit[] = [];
  private pendingIn: RTCIceCandidateInit[] = [];
  private unsubs: (() => Promise<void>)[] = [];
  private ringTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private pb: PocketBase,
    private side: CallSide,
    private ev: CallEvents,
  ) {}

  private get other(): CallSide {
    return this.side === 'customer' ? 'admin' : 'customer';
  }

  private setState(s: CallState, end?: CallEnd): void {
    this.state = s;
    this.ev.state(s, end);
  }

  // ---------- Start / answer ----------

  /** Rings the other side. `userId` = the customer of this conversation. */
  async start(userId: string, kind: CallKind): Promise<void> {
    if (this.state !== 'idle') return;
    this.setState('outgoing');
    try {
      await this.getMedia(kind);
    } catch {
      this.finish('media');
      return;
    }
    try {
      const pc = await this.makePeer();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.call = await this.pb.collection('calls').create({
        user: userId,
        caller: this.side,
        kind,
        status: 'ringing',
        offer: { type: offer.type, sdp: offer.sdp },
      });
      for (const c of this.pendingOut.splice(0)) void this.sendCandidate(c);
      await this.watchCall();
      await this.listenCandidates();
      this.ringTimer = setTimeout(() => {
        if (this.state === 'outgoing') void this.hangup('missed');
      }, RING_MS);
    } catch {
      this.finish('failed');
    }
  }

  /** A new call record arrived from the other side. Returns false if we're busy. */
  incoming(rec: RecordModel): boolean {
    if (rec['caller'] !== this.other || rec['status'] !== 'ringing') return false;
    if (this.state !== 'idle') {
      void this.pb.collection('calls').update(rec.id, { status: 'declined' }).catch(() => undefined);
      return false;
    }
    this.call = rec;
    this.setState('incoming');
    void this.watchCall();
    this.ringTimer = setTimeout(() => {
      if (this.state === 'incoming') this.finish('missed');
    }, RING_MS);
    return true;
  }

  async accept(): Promise<void> {
    const call = this.call;
    if (this.state !== 'incoming' || !call) return;
    this.clearRing();
    this.setState('connecting');
    try {
      await this.getMedia(call['kind'] as CallKind);
    } catch {
      await this.updateCall({ status: 'declined' });
      this.finish('media');
      return;
    }
    try {
      const pc = await this.makePeer();
      await pc.setRemoteDescription(call['offer']);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.updateCall({ answer: { type: answer.type, sdp: answer.sdp }, status: 'accepted', started: now() });
      await this.listenCandidates();
      await this.flushIn();
    } catch {
      await this.hangup('failed');
    }
  }

  async decline(): Promise<void> {
    if (this.state !== 'incoming') return;
    await this.updateCall({ status: 'declined' });
    this.finish('declined');
  }

  /** End / cancel the call from this side. */
  async hangup(reason: 'ended' | 'missed' | 'failed' = 'ended'): Promise<void> {
    if (this.state === 'idle' || this.state === 'ended') return;
    const was = this.state;
    const status = reason === 'missed' ? 'missed' : was === 'outgoing' ? 'cancelled' : 'ended';
    const duration = this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : 0;
    const call = this.call;
    this.finish(reason === 'failed' ? 'failed' : (status as CallEnd));
    if (call) {
      await this.pb
        .collection('calls')
        .update(call.id, { status, ended_at: now(), duration })
        .catch(() => undefined);
    }
  }

  // ---------- In-call controls ----------

  setMuted(muted: boolean): void {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }

  setCamera(on: boolean): void {
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = on));
  }

  /** Front / back camera on phones. */
  async switchCamera(): Promise<void> {
    const old = this.localStream?.getVideoTracks()[0];
    if (!old || !this.pc || !this.localStream) return;
    const facing = old.getSettings().facingMode === 'environment' ? 'user' : 'environment';
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
    const track = s.getVideoTracks()[0];
    const sender = this.pc.getSenders().find((x) => x.track?.kind === 'video');
    await sender?.replaceTrack(track);
    old.stop();
    this.localStream.removeTrack(old);
    this.localStream.addTrack(track);
    this.ev.local(this.localStream);
  }

  // ---------- Internals ----------

  private async iceServers(): Promise<RTCIceServer[]> {
    try {
      const r = await this.pb.send<{ iceServers: RTCIceServer[] }>('/api/astro/ice', { requestKey: null });
      if (r?.iceServers?.length) return r.iceServers;
    } catch {
      /* use the default below */
    }
    return [{ urls: 'stun:stun.l.google.com:19302' }];
  }

  private async getMedia(kind: CallKind): Promise<void> {
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: kind === 'video' ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false,
    });
    this.ev.local(this.localStream);
  }

  private async makePeer(): Promise<RTCPeerConnection> {
    const pc = new RTCPeerConnection({ iceServers: await this.iceServers() });
    this.pc = pc;
    this.remoteStream = new MediaStream();
    this.localStream?.getTracks().forEach((t) => pc.addTrack(t, this.localStream!));
    pc.ontrack = (e) => {
      const rs = this.remoteStream!;
      const tracks = e.streams[0]?.getTracks() ?? [e.track];
      for (const t of tracks) if (!rs.getTracks().includes(t)) rs.addTrack(t);
      this.ev.remote(rs);
    };
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const c = e.candidate.toJSON();
      if (this.call) void this.sendCandidate(c);
      else this.pendingOut.push(c);
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'connected' && this.state !== 'active') {
        this.clearRing();
        this.startedAt = Date.now();
        this.setState('active');
      } else if (s === 'failed') {
        void this.hangup('failed');
      }
    };
    return pc;
  }

  private sendCandidate(c: RTCIceCandidateInit): Promise<unknown> {
    return this.pb
      .collection('call_candidates')
      .create({ call: this.call!.id, from: this.side, candidate: c }, { requestKey: null })
      .catch(() => undefined);
  }

  private addCandidate(c: RTCIceCandidateInit): void {
    if (this.pc?.remoteDescription) void this.pc.addIceCandidate(c).catch(() => undefined);
    else this.pendingIn.push(c);
  }

  private async flushIn(): Promise<void> {
    for (const c of this.pendingIn.splice(0)) await this.pc?.addIceCandidate(c).catch(() => undefined);
  }

  private async listenCandidates(): Promise<void> {
    const id = this.call!.id;
    const unsub = await this.pb.collection('call_candidates').subscribe(
      '*',
      (e: any) => {
        if (e.action === 'create' && e.record['call'] === id && e.record['from'] === this.other) this.addCandidate(e.record['candidate']);
      },
      { filter: this.pb.filter('call = {:id}', { id }) },
    );
    this.unsubs.push(unsub);
    const existing = await this.pb.collection('call_candidates').getFullList({
      filter: this.pb.filter('call = {:id} && from = {:f}', { id, f: this.other }),
      requestKey: null,
    });
    existing.forEach((r: RecordModel) => this.addCandidate(r['candidate']));
  }

  private async watchCall(): Promise<void> {
    const id = this.call!.id;
    const unsub = await this.pb.collection('calls').subscribe(id, async (e: any) => {
      const r: RecordModel = e.record;
      this.call = r;
      const st = r['status'];
      // Our outgoing call was answered.
      if (r['answer'] && this.pc && !this.pc.remoteDescription && r['caller'] === this.side) {
        try {
          await this.pc.setRemoteDescription(r['answer']);
          await this.flushIn();
          this.clearRing();
          if (this.state === 'outgoing') this.setState('connecting');
        } catch {
          void this.hangup('failed');
        }
      }
      // Answered on another device/tab (admin with two tabs open).
      if (this.state === 'incoming' && st === 'accepted') this.finish('elsewhere');
      if (['declined', 'missed', 'cancelled', 'ended'].includes(st) && this.state !== 'idle' && this.state !== 'ended') {
        this.finish(st === 'declined' ? 'declined' : st === 'ended' ? 'ended' : 'missed');
      }
    });
    this.unsubs.push(unsub);
  }

  private updateCall(data: Record<string, unknown>): Promise<unknown> {
    return this.call ? this.pb.collection('calls').update(this.call.id, data).catch(() => undefined) : Promise.resolve();
  }

  private clearRing(): void {
    if (this.ringTimer) clearTimeout(this.ringTimer);
    this.ringTimer = null;
  }

  private finish(end: CallEnd): void {
    this.clearRing();
    for (const u of this.unsubs.splice(0)) void u().catch(() => undefined);
    this.pc?.close();
    this.pc = null;
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.remoteStream = null;
    this.pendingIn = [];
    this.pendingOut = [];
    this.startedAt = 0;
    this.ev.local(null);
    this.ev.remote(null);
    this.setState('ended', end);
    setTimeout(() => {
      if (this.state === 'ended') {
        this.call = null;
        this.setState('idle');
      }
    }, 2500);
  }
}

/** Simple ringtone with the Web Audio API (no sound file needed). */
export class Ringer {
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  start(outgoing = false): void {
    this.stop();
    try {
      const ctx = new AudioContext();
      this.ctx = ctx;
      const beep = () => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = outgoing ? 425 : 520;
        g.gain.value = 0.08;
        o.connect(g).connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + (outgoing ? 1 : 0.35));
        if (!outgoing && 'vibrate' in navigator) navigator.vibrate?.(300);
      };
      beep();
      this.timer = setInterval(beep, outgoing ? 3000 : 1200);
    } catch {
      /* no audio - the screen still shows the call */
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}

/** "03:25" */
export function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
