import { Injectable, inject, signal } from '@angular/core';
import { PbService } from '../services/pb.service';
import { CallEnd, CallEngine, CallKind, CallState, Ringer } from './call-engine';

/** Customer side of internet calls with the astrologer (see call-engine.ts). */
@Injectable({ providedIn: 'root' })
export class CallService {
  private pbs = inject(PbService);

  readonly state = signal<CallState>('idle');
  readonly end = signal<CallEnd | null>(null);
  readonly kind = signal<CallKind>('audio');
  readonly local = signal<MediaStream | null>(null);
  readonly remote = signal<MediaStream | null>(null);
  readonly muted = signal(false);
  readonly camOff = signal(false);
  readonly seconds = signal(0);

  private ringer = new Ringer();
  private tick: ReturnType<typeof setInterval> | null = null;
  private listening = false;

  private engine = new CallEngine(this.pbs.pb, 'customer', {
    state: (s, e) => this.onState(s, e),
    local: (m) => this.local.set(m),
    remote: (m) => this.remote.set(m),
  });

  /** Listen for calls from the astrologer (while the app is open). */
  listen(): void {
    if (this.listening || !this.pbs.isLoggedIn) return;
    this.listening = true;
    void this.pbs.pb
      .collection('calls')
      .subscribe('*', (e: { action: string; record: import('pocketbase').RecordModel }) => {
        if (e.action === 'create' && this.engine.incoming(e.record)) this.kind.set(e.record['kind'] as CallKind);
      })
      .catch(() => (this.listening = false));
  }

  async call(kind: CallKind): Promise<void> {
    const uid = this.pbs.user?.id;
    if (!uid || this.state() !== 'idle') return;
    this.kind.set(kind);
    this.muted.set(false);
    this.camOff.set(false);
    await this.engine.start(uid, kind);
  }

  accept(): void {
    this.muted.set(false);
    this.camOff.set(false);
    void this.engine.accept();
  }

  decline(): void {
    void this.engine.decline();
  }

  hangup(): void {
    void this.engine.hangup();
  }

  toggleMute(): void {
    this.muted.update((m) => !m);
    this.engine.setMuted(this.muted());
  }

  toggleCamera(): void {
    this.camOff.update((c) => !c);
    this.engine.setCamera(!this.camOff());
  }

  switchCamera(): void {
    void this.engine.switchCamera().catch(() => undefined);
  }

  private onState(s: CallState, e?: CallEnd): void {
    this.state.set(s);
    this.end.set(e ?? null);
    if (s === 'incoming') this.ringer.start(false);
    else if (s === 'outgoing') this.ringer.start(true);
    else this.ringer.stop();
    if (s === 'active') {
      this.seconds.set(0);
      this.tick = setInterval(() => this.seconds.set(Math.round((Date.now() - this.engine.startedAt) / 1000)), 1000);
    } else if (this.tick) {
      clearInterval(this.tick);
      this.tick = null;
    }
  }
}
