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

/** An astrologer's status for customers: online now, last seen, or offline (switched off). */
export function astroStatus(a: RecordModel | null | undefined): { online: boolean; lastSeen: Date | null } {
  if (!a || a['status_mode'] === 'offline') return { online: false, lastSeen: null };
  // Status worked out by the server (doesn't depend on this phone's clock).
  if (typeof a['online'] === 'boolean') {
    const ago = Number(a['seen_ago']);
    return { online: a['online'], lastSeen: ago >= 0 ? new Date(Date.now() - ago * 1000) : null };
  }
  const d = a['last_seen'] ? new Date(String(a['last_seen']).replace(' ', 'T')) : null;
  if (!d || isNaN(d.getTime())) return { online: false, lastSeen: null };
  return { online: Date.now() - d.getTime() < 150_000, lastSeen: d };
}

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
/** Reviews of one astrologer (from the server). */
export interface ReviewSummary {
  rating: number;
  count: number;
  mine: { rating: number; comment: string } | null;
  items: { rating: number; comment: string; name: string; created: string }[];
}

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

  /** Every astrologer shown to customers (the "All astrologers" page). */
  readonly astrologers = signal<RecordModel[]>([]);
  /** Favourites, shown in the customer's chats: the chief astrologer + the ones they added (no limit). */
  readonly myAstrologers = computed(() => this.astrologers().filter((a) => a['mine']));
  /** How many the customer added (the chief astrologer doesn't count). */
  readonly myAddedCount = computed(() => this.astrologers().filter((a) => a['mine'] && a['role'] !== 'super').length);
  /** Unread replies per astrologer id. */
  readonly unreadByStaff = signal<Record<string, number>>({});
  /** Any astrologer online (green dot in the menu). */
  readonly astroOnline = computed(() => this.myAstrologers().some((a) => astroStatus(a).online));
  private presenceStarted = false;

  /** Chat theme: the customer's own choice (Clean light until they pick one). */
  readonly myTheme = signal<ChatTheme | ''>('');
  readonly chatTheme = computed<ChatTheme>(() => this.myTheme() || 'clean');

  /** Astrologers typing a reply to this customer right now (ids). */
  readonly typingStaff = signal<ReadonlySet<string>>(new Set());
  private typingOff = new Map<string, ReturnType<typeof setTimeout>>();
  private lastTypingSent = 0;
  private typingTo = '';
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

  // ---------- Astrologers ----------
  /** Loads the astrologers this customer may chat with (super admins first). */
  async loadAstrologers(): Promise<RecordModel[]> {
    if (!this.pbs.isLoggedIn) return [];
    try {
      const list = await this.pb.send<RecordModel[]>('/api/astro/astrologers', { requestKey: null });
      this.astrologers.set(list);
      return list;
    } catch {
      return this.astrologers();
    }
  }

  // ---------- Reviews ----------
  reviews(staffId: string): Promise<ReviewSummary> {
    return this.pb.send<ReviewSummary>('/api/astro/reviews/' + encodeURIComponent(staffId), { requestKey: null });
  }

  async saveReview(staffId: string, rating: number, comment: string): Promise<void> {
    await this.pb.send('/api/astro/reviews', { method: 'POST', body: { staff: staffId, rating, comment }, requestKey: null });
    await this.loadAstrologers();
  }

  async deleteReview(staffId: string): Promise<void> {
    await this.pb.send('/api/astro/reviews/' + encodeURIComponent(staffId), { method: 'DELETE', requestKey: null });
    await this.loadAstrologers();
  }

  /** Adds an astrologer to (or removes one from) this customer's favourites. */
  async setMine(staffId: string, add: boolean): Promise<void> {
    await this.pb.send('/api/astro/my-astrologers', { method: 'POST', body: { id: staffId, add }, requestKey: null });
    await this.loadAstrologers();
  }

  /** Profile photo of an astrologer ('' if none). Astrologer photos are public. */
  astroPhoto(a: RecordModel | null | undefined, thumb = '100x100'): string {
    return a?.['avatar'] ? this.pb.files.getURL(a, a['avatar'] as string, { thumb }) : '';
  }

  // ---------- Messages ----------
  /**
   * Chat with one astrologer. Older messages (from before astrologers were added)
   * have no astrologer and belong to the chat with the super admin.
   */
  messages(staffId: string, withOld = false): Promise<RecordModel[]> {
    const uid = this.pbs.user?.id ?? '';
    return this.pb.collection('customer_messages').getFullList({
      filter: this.pb.filter(withOld ? "user = {:u} && (staff = {:s} || staff = '')" : 'user = {:u} && staff = {:s}', {
        u: uid,
        s: staffId,
      }),
      sort: 'created',
    });
  }

  async send(staffId: string, note: string, files: File[], where: HereNow | null): Promise<RecordModel> {
    const fd = new FormData();
    fd.append('user', this.pbs.user?.id ?? '');
    fd.append('staff', staffId);
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

  /** Marks one astrologer's replies as read ('' = all). */
  async markRepliesSeen(staffId = ''): Promise<void> {
    try {
      await this.pb.send('/api/astro/messages/seen', { method: 'POST', body: { staff: staffId } });
      await this.refreshUnread();
    } catch {
      /* not important */
    }
  }

  async refreshUnread(): Promise<void> {
    const uid = this.pbs.user?.id;
    if (!uid) return;
    try {
      const list = await this.pb.collection('customer_messages').getFullList({
        filter: this.pb.filter("user = {:u} && sender = 'admin' && seen = false", { u: uid }),
        fields: 'id,staff',
        requestKey: null,
      });
      const by: Record<string, number> = {};
      for (const m of list as RecordModel[]) by[m['staff'] || ''] = (by[m['staff'] || ''] ?? 0) + 1;
      this.unreadByStaff.set(by);
      this.unread.set(list.length);
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
    void this.loadAstrologers();
    // Online while the app is open - also in a background tab. (On phones the app is
    // paused in the background, so the beats stop and it shows offline after ~2 min.)
    setInterval(() => beat(), 60_000);
    // Astrologers' status: refreshed every 30 s (and at once when one switches Online/Offline).
    setInterval(() => void this.loadAstrologers(), 30_000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        beat();
        void this.loadAstrologers();
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
    // Live "typing…" from an astrologer.
    void this.pb.realtime
      .subscribe('astro_typing', (e: { from?: string; staff?: string; on?: boolean }) => {
        if (e?.from !== 'admin' || !e.staff) return;
        const sid = e.staff;
        const t = this.typingOff.get(sid);
        if (t) clearTimeout(t);
        this.setTyping(sid, !!e.on);
        if (e.on) this.typingOff.set(sid, setTimeout(() => this.setTyping(sid, false), 6000));
      })
      .catch(() => undefined);
    // Live: an astrologer switching Online/Offline shows at once.
    void this.pb
      .collection('staff')
      .subscribe('*', () => void this.loadAstrologers())
      .catch(() => undefined);
  }

  private setTyping(staffId: string, on: boolean): void {
    const next = new Set(this.typingStaff());
    if (on) next.add(staffId);
    else next.delete(staffId);
    this.typingStaff.set(next);
  }

  /** Call on every key press in the chat box; tells that astrologer "typing…" (throttled). */
  typing(staffId: string): void {
    if (this.typingTo !== staffId) this.stopTyping();
    this.typingTo = staffId;
    if (Date.now() - this.lastTypingSent > 3000) {
      this.lastTypingSent = Date.now();
      this.sendTyping(staffId, true);
    }
    if (this.stopTypingTimer) clearTimeout(this.stopTypingTimer);
    this.stopTypingTimer = setTimeout(() => this.stopTyping(), 4000);
  }

  stopTyping(): void {
    if (this.stopTypingTimer) clearTimeout(this.stopTypingTimer);
    this.stopTypingTimer = null;
    if (!this.lastTypingSent || !this.typingTo) return;
    this.lastTypingSent = 0;
    this.sendTyping(this.typingTo, false);
  }

  private sendTyping(staffId: string, on: boolean): void {
    void this.pb.send('/api/astro/typing', { method: 'POST', body: { staff: staffId, on }, requestKey: null }).catch(() => undefined);
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
