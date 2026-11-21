import { Injectable, computed, inject, signal } from '@angular/core';
import { RecordModel } from 'pocketbase';
import { Place, PbService } from './pb.service';

export type ChatTheme = 'clean' | 'lavender' | 'saffron' | 'dark';
/** Themes with three preview colours (header, own bubble, background). */
export const CHAT_THEMES: { id: ChatTheme; swatch: [string, string, string] }[] = [
  { id: 'clean', swatch: ['#ffffff', '#185fa5', '#f4f3ef'] },
  { id: 'lavender', swatch: ['#534ab7', '#7f77dd', '#eeedfe'] },
  { id: 'saffron', swatch: ['#faeeda', '#993c1d', '#fffbf3'] },
  { id: 'dark', swatch: ['#1f2023', '#185fa5', '#141517'] },
];
const isTheme = (v: unknown): v is ChatTheme => CHAT_THEMES.some((t) => t.id === v);

/** A location reading from the phone, with its place name. */
export interface HereNow {
  lat: number;
  lon: number;
  /** Metres. */
  accuracy: number;
  place: string;
}

/** Biggest single file the server accepts (same as the collection setting). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** Whole message (all attachments) - keeps uploads reasonable on mobile data. */
export const MAX_MESSAGE_BYTES = 30 * 1024 * 1024;
export const MAX_FILES = 5;

/**
 * Messages to the astrologer, shared locations and the profile photo.
 * Everything is stored in our own PocketBase (free, open source); files are
 * protected, so links carry a short-lived token.
 */
@Injectable({ providedIn: 'root' })
export class CommService {
  private pbs = inject(PbService);
  private get pb() {
    return this.pbs.pb;
  }

  /** Admin replies the customer hasn't opened yet (for the menu badge). */
  readonly unread = signal(0);

  /** Astrologer (admin) status for the app: online now / last seen. */
  readonly astroOnline = signal(false);
  readonly astroLastSeen = signal<Date | null>(null);
  /** The admin switched to Offline (then no "last seen" is shown). */
  readonly astroHidden = signal(false);
  private presenceStarted = false;

  /** Chat theme: the customer's own choice (Clean light until they pick one). */
  readonly myTheme = signal<ChatTheme | ''>('');
  readonly chatTheme = computed<ChatTheme>(() => this.myTheme() || 'clean');

  /** The astrologer is typing a reply right now. */
  readonly astroTyping = signal(false);
  private typingOff: ReturnType<typeof setTimeout> | null = null;
  private lastTypingSent = 0;
  private stopTypingTimer: ReturnType<typeof setTimeout> | null = null;

  private token = '';
  private tokenAt = 0;

  /** File token for protected files (valid a few minutes; refreshed when older than 2). */
  async fileToken(): Promise<string> {
    if (!this.token || Date.now() - this.tokenAt > 120_000) {
      this.token = await this.pb.files.getToken();
      this.tokenAt = Date.now();
    }
    return this.token;
  }

  fileUrl(record: RecordModel, file: string, token: string, thumb = ''): string {
    return this.pb.files.getURL(record, file, thumb ? { token, thumb } : { token });
  }

  // ---------- Messages ----------
  messages(): Promise<RecordModel[]> {
    const uid = this.pbs.user?.id ?? '';
    return this.pb.collection('customer_messages').getFullList({
      filter: this.pb.filter('user = {:u}', { u: uid }),
      sort: 'created',
    });
  }

  async send(note: string, files: File[], where: HereNow | null): Promise<RecordModel> {
    const fd = new FormData();
    fd.append('user', this.pbs.user?.id ?? '');
    fd.append('sender', 'customer');
    fd.append('note', note.trim());
    for (const f of files) fd.append('files', f, f.name);
    if (where) {
      fd.append('lat', String(where.lat));
      fd.append('lon', String(where.lon));
      fd.append('accuracy', String(Math.round(where.accuracy)));
      fd.append('place', where.place.slice(0, 300));
    }
    return this.pb.collection('customer_messages').create(fd);
  }

  deleteMessage(id: string): Promise<boolean> {
    return this.pb.collection('customer_messages').delete(id);
  }

  async markRepliesSeen(): Promise<void> {
    try {
      await this.pb.send('/api/astro/messages/seen', { method: 'POST' });
      this.unread.set(0);
    } catch {
      /* not important */
    }
  }

  async refreshUnread(): Promise<void> {
    const uid = this.pbs.user?.id;
    if (!uid) return;
    try {
      const r = await this.pb.collection('customer_messages').getList(1, 1, {
        filter: this.pb.filter("user = {:u} && sender = 'admin' && seen = false", { u: uid }),
        fields: 'id',
      });
      this.unread.set(r.totalItems);
    } catch {
      /* offline */
    }
  }

  /** Live updates for this customer's chat. Returns the unsubscribe function. */
  watch(onChange: () => void): Promise<() => Promise<void>> {
    return this.pb.collection('customer_messages').subscribe('*', () => onChange());
  }

  // ---------- Online status ----------
  /**
   * Starts the heartbeat (every minute while the app is visible; "away" when hidden)
   * and keeps the astrologer's status up to date. Safe to call more than once.
   */
  startPresence(): void {
    if (this.presenceStarted) return;
    this.presenceStarted = true;
    const mine = this.pbs.user?.['chat_theme'];
    this.myTheme.set(isTheme(mine) ? mine : '');
    const beat = (away = false) => {
      if (!this.pbs.isLoggedIn) return;
      void this.pb.send('/api/astro/presence', { method: 'POST', body: { away }, requestKey: null }).catch(() => undefined);
    };
    beat();
    void this.refreshAstroStatus();
    // Online while the app is open - also in a background tab. (On phones the app is
    // paused in the background, so the beats stop and it shows offline after ~2 min.)
    setInterval(() => {
      beat();
      void this.refreshAstroStatus();
    }, 60_000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        beat();
        void this.refreshAstroStatus();
      }
    });
    // Tab / app closed: show offline at once (keepalive lets the request finish).
    window.addEventListener('pagehide', () => {
      if (!this.pbs.isLoggedIn) return;
      void fetch(this.pb.buildURL('/api/astro/presence'), {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: this.pb.authStore.token },
        body: JSON.stringify({ away: true }),
      }).catch(() => undefined);
    });
    // Live "typing…" from the astrologer.
    void this.pb.realtime
      .subscribe('astro_typing', (e: { from?: string; on?: boolean }) => {
        if (e?.from !== 'admin') return;
        if (this.typingOff) clearTimeout(this.typingOff);
        this.astroTyping.set(!!e.on);
        if (e.on) this.typingOff = setTimeout(() => this.astroTyping.set(false), 6000);
      })
      .catch(() => undefined);
    // Live: the admin switching Online/Offline shows at once.
    void this.pb
      .collection('astro_status')
      .subscribe('*', (e: { record: RecordModel }) => this.applyAstroStatus(e.record))
      .catch(() => undefined);
  }

  async refreshAstroStatus(): Promise<void> {
    if (!this.pbs.isLoggedIn) return;
    try {
      const rec = await this.pb.collection('astro_status').getFirstListItem("key = 'main'", { requestKey: null });
      this.applyAstroStatus(rec);
    } catch {
      /* offline */
    }
  }

  private applyAstroStatus(rec: RecordModel): void {
    const hidden = rec['admin_mode'] === 'offline';
    const seen = rec['admin_last_seen'] ? new Date(String(rec['admin_last_seen']).replace(' ', 'T')) : null;
    this.astroHidden.set(hidden);
    this.astroLastSeen.set(hidden ? null : seen);
    this.astroOnline.set(!hidden && !!seen && Date.now() - seen.getTime() < 150_000);
  }

  /** Call on every key press in the chat box; tells the astrologer "typing…" (throttled). */
  typing(): void {
    if (Date.now() - this.lastTypingSent > 3000) {
      this.lastTypingSent = Date.now();
      this.sendTyping(true);
    }
    if (this.stopTypingTimer) clearTimeout(this.stopTypingTimer);
    this.stopTypingTimer = setTimeout(() => this.stopTyping(), 4000);
  }

  stopTyping(): void {
    if (this.stopTypingTimer) clearTimeout(this.stopTypingTimer);
    this.stopTypingTimer = null;
    if (!this.lastTypingSent) return;
    this.lastTypingSent = 0;
    this.sendTyping(false);
  }

  private sendTyping(on: boolean): void {
    void this.pb.send('/api/astro/typing', { method: 'POST', body: { on }, requestKey: null }).catch(() => undefined);
  }

  /** Saves the customer's own chat theme to their account. */
  async setMyTheme(theme: ChatTheme): Promise<void> {
    const id = this.pbs.user?.id ?? '';
    await this.pb.collection('users').update(id, { chat_theme: theme });
    await this.pb.collection('users').authRefresh();
    this.myTheme.set(theme);
  }

  /** Customer chooses to appear offline to the astrologer. */
  async setHideOnline(hide: boolean): Promise<void> {
    const id = this.pbs.user?.id ?? '';
    await this.pb.collection('users').update(id, { hide_online: hide });
    await this.pb.collection('users').authRefresh();
  }

  // ---------- Location ----------
  /** Asks the phone for its position now (no cache) and looks up the place name. */
  async locate(): Promise<HereNow> {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      if (!('geolocation' in navigator)) return reject(new Error('no-geolocation'));
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 0,
      });
    });
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    let place = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    try {
      const res = await this.pb.send<{ item: Place | null }>('/api/astro/places/reverse', {
        query: { lat: String(lat), lon: String(lon) },
        requestKey: null,
      });
      if (res.item) place = res.item.name || res.item.title || place;
    } catch {
      /* keep the coordinates */
    }
    return { lat, lon, accuracy: pos.coords.accuracy, place };
  }

  saveLocation(h: HereNow): Promise<RecordModel> {
    return this.pb.collection('customer_locations').create({
      user: this.pbs.user?.id,
      lat: h.lat,
      lon: h.lon,
      accuracy: Math.round(h.accuracy),
      place: h.place.slice(0, 300),
    });
  }

  locations(): Promise<RecordModel[]> {
    const uid = this.pbs.user?.id ?? '';
    return this.pb.collection('customer_locations').getFullList({
      filter: this.pb.filter('user = {:u}', { u: uid }),
      sort: '-created',
    });
  }

  deleteLocation(id: string): Promise<boolean> {
    return this.pb.collection('customer_locations').delete(id);
  }

  // ---------- Profile photo ----------
  async setAvatar(file: Blob): Promise<RecordModel> {
    const id = this.pbs.user?.id ?? '';
    const fd = new FormData();
    fd.append('avatar', file, 'avatar.jpg');
    const rec = await this.pb.collection('users').update(id, fd);
    await this.pb.collection('users').authRefresh();
    return rec;
  }

  async removeAvatar(): Promise<void> {
    const id = this.pbs.user?.id ?? '';
    await this.pb.collection('users').update(id, { avatar: null });
    await this.pb.collection('users').authRefresh();
  }

  /** Profile photo URL of the logged-in customer ('' if none). */
  async avatarUrl(thumb = '300x300'): Promise<string> {
    const u = this.pbs.user;
    if (!u?.['avatar']) return '';
    return this.fileUrl(u, u['avatar'] as string, await this.fileToken(), thumb);
  }
}

/** "photo" | "video" | "audio" | "file" from a file name. */
export function fileKind(name: string): 'photo' | 'video' | 'audio' | 'file' {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'webp', 'heic', 'gif'].includes(ext)) return 'photo';
  if (['mp4', 'mov', '3gp', 'm4v'].includes(ext)) return 'video';
  if (['webm', 'ogg', 'oga', 'm4a', 'mp3', 'aac', 'wav'].includes(ext)) {
    // Our recorder saves audio as "voice-*.webm"; a camera .webm is a video.
    return name.startsWith('voice') || ext !== 'webm' ? 'audio' : 'video';
  }
  return 'file';
}

/**
 * Shrinks a photo on the phone before upload (longest side `max` px, JPEG).
 * `square` crops the centre to a square (profile photo).
 */
export async function shrinkImage(file: Blob, max = 1600, square = false, quality = 0.82): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (square) {
      const s = Math.min(sw, sh);
      sx = (sw - s) / 2;
      sy = (sh - s) / 2;
      sw = sh = s;
    }
    const scale = Math.min(1, max / Math.max(sw, sh));
    const w = Math.round(sw * scale), h = Math.round(sh * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('image'))), 'image/jpeg', quality),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Google Maps link for a point (opens the Maps app on phones). */
export function mapsLink(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}
