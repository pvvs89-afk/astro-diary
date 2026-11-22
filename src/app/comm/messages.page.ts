import { Component, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import {
  ActionSheetController,
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  call,
  checkmark,
  checkmarkDone,
  colorPaletteOutline,
  imageOutline,
  location,
  locationOutline,
  mic,
  planetOutline,
  send,
  stop,
  trashOutline,
  videocam,
  videocamOutline,
} from 'ionicons/icons';
import { RecordModel } from 'pocketbase';
import { I18nService } from '../i18n/i18n.service';
import { LangButtonComponent } from '../i18n/lang-button.component';
import {
  CHAT_THEMES,
  CommService,
  astroStatus,
  MAX_FILE_BYTES,
  MAX_FILES,
  MAX_MESSAGE_BYTES,
  fileKind,
  mapsLink,
  shrinkImage,
} from '../services/comm.service';
import { COMM_TEXT, CommKey, fill } from './comm-text';
import { CallService } from '../call/call.service';

interface Pending {
  file: File;
  kind: 'photo' | 'video' | 'audio' | 'file';
  preview: string;
}

const MAX_RECORD_SECONDS = 300;
const LAST_KEY = 'astro.lastAstrologer';

/**
 * Message Astrologer: the chat (text, photos, videos, voice notes, location) with the
 * list of astrologers beside it - a column on the right on wide screens, a row of
 * photos on top on phones. Tapping an astrologer switches the chat.
 */
@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [
    RouterLink,
    IonHeader,
    IonIcon,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonMenuButton,
    IonButton,
    IonContent,
    IonFooter,
    IonSpinner,
    LangButtonComponent,
  ],
  templateUrl: './messages.page.html',
  host: {
    '[class.theme-clean]': "comm.chatTheme() === 'clean'",
    '[class.theme-lavender]': "comm.chatTheme() === 'lavender'",
    '[class.theme-saffron]': "comm.chatTheme() === 'saffron'",
    '[class.theme-dark]': "comm.chatTheme() === 'dark'",
  },
  styleUrls: ['./chat-theme.scss', './chat-side.scss'],
})
export class MessagesPage implements OnInit, OnDestroy {
  readonly comm = inject(CommService);
  readonly calls = inject(CallService);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  /** The astrologer of this chat (from the address /messages/:staff, else the last one used). */
  readonly staffId = signal(this.route.snapshot.paramMap.get('staff') ?? '');
  /** Search box and "Online only" switch (shown when there are many astrologers). */
  readonly search = signal('');
  readonly onlineOnly = signal(false);
  readonly manyAstro = computed(() => this.comm.myAstrologers().length > 8);
  /** Show the astrologer column / row (also to offer "Add astrologer" when others exist). */
  readonly showSide = computed(() => this.list().length > 1 || this.comm.astrologers().length > 1);
  /** The list after search / online filter (the open chat always stays in it). */
  readonly shown = computed(() => {
    const q = this.search().trim().toLowerCase();
    const only = this.onlineOnly();
    return this.list().filter(
      (a) =>
        a.id === this.staffId() ||
        ((!q || String(a['name'] ?? '').toLowerCase().includes(q) || String(a['bio'] ?? '').toLowerCase().includes(q)) &&
          (!only || this.isOnline(a))),
    );
  });
  /** All astrologers: online first, then the chief astrologer, then by name. */
  readonly list = computed(() =>
    [...this.comm.myAstrologers()].sort(
      (a, b) =>
        Number(this.isOnline(b)) - Number(this.isOnline(a)) ||
        Number(b['role'] === 'super') - Number(a['role'] === 'super') ||
        String(a['name'] ?? '').localeCompare(String(b['name'] ?? '')),
    ),
  );
  readonly astro = computed(() => this.comm.astrologers().find((a) => a.id === this.staffId()) ?? null);
  readonly astroName = computed(() => String(this.astro()?.['name'] || this.tx().msg_astrologer));
  /** The chief (super admin) chat also shows older messages sent before astrologers existed. */
  readonly isChief = computed(() => this.astro()?.['role'] === 'super');
  readonly status = computed(() => astroStatus(this.astro()));
  readonly typing = computed(() => this.comm.typingStaff().has(this.staffId()));
  private i18n = inject(I18nService);
  private alerts = inject(AlertController);
  private sheets = inject(ActionSheetController);
  private content = viewChild(IonContent);
  readonly t = this.i18n.t;
  readonly tx = computed(() => COMM_TEXT[this.i18n.lang()]);
  readonly mapsLink = mapsLink;
  readonly fileKind = fileKind;

  readonly loading = signal(true);
  readonly error = signal('');
  readonly items = signal<RecordModel[]>([]);
  readonly token = signal('');

  readonly note = signal('');
  readonly pending = signal<Pending[]>([]);
  readonly attachLoc = signal(false);
  readonly sending = signal(false);
  readonly recording = signal(false);
  readonly recSecs = signal(0);

  private unsub: (() => Promise<void>) | null = null;
  private recorder: MediaRecorder | null = null;
  private recTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    addIcons({ call, checkmark, checkmarkDone, colorPaletteOutline, imageOutline, location, locationOutline, mic, planetOutline, send, stop, trashOutline, videocam, videocamOutline });
  }

  /** 🎨 in the header: choose the chat theme (saved to the customer's account). */
  async pickTheme(): Promise<void> {
    const t = this.tx();
    const current = this.comm.chatTheme();
    const sheet = await this.sheets.create({
      header: t.prof_theme,
      buttons: [
        ...CHAT_THEMES.map((x) => ({
          text: (current === x.id ? '✓ ' : '') + t[('theme_' + x.id) as 'theme_clean'],
          handler: () => {
            void this.comm.setMyTheme(x.id).catch((e) => this.error.set(this.i18n.err(e)));
          },
        })),
        { text: t.cancel, role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  /** Text box grows with the message (up to ~5 lines). */
  onType(ev: Event): void {
    const el = ev.target as HTMLTextAreaElement;
    this.note.set(el.value);
    if (el.value.trim()) this.comm.typing(this.staffId());
    else this.comm.stopTyping();
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  private parse(v: unknown): Date {
    return new Date(String(v).replace(' ', 'T'));
  }

  /** Show a date divider before the first message of each day. */
  dayChanged(i: number): boolean {
    const list = this.items();
    if (i === 0) return true;
    return this.parse(list[i]['created']).toDateString() !== this.parse(list[i - 1]['created']).toDateString();
  }

  day(v: unknown): string {
    const d = this.parse(v);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(`${this.i18n.lang()}-IN`, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  }

  clockTime(v: unknown): string {
    const d = this.parse(v);
    return isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat(`${this.i18n.lang()}-IN`, { hour: 'numeric', minute: '2-digit' }).format(d);
  }

  /** Call log lines written by the server ("📞 Video call · 3 min"). */
  isCallLog(m: RecordModel): boolean {
    return String(m['note'] ?? '').startsWith('📞') && !this.files(m).length;
  }

  callIcon(m: RecordModel): string {
    return String(m['note']).includes('ideo') ? 'videocam' : 'call';
  }

  isOnline(a: RecordModel): boolean {
    return astroStatus(a).online;
  }

  /** Unread replies; the chief astrologer's chat also counts older messages without an astrologer. */
  unreadOf(a: RecordModel): number {
    const by = this.comm.unreadByStaff();
    return (by[a.id] ?? 0) + (a['role'] === 'super' ? (by[''] ?? 0) : 0);
  }

  /** Switch the chat to another astrologer (stays on this screen). */
  select(a: RecordModel): void {
    if (a.id === this.staffId()) return;
    this.comm.stopTyping();
    this.staffId.set(a.id);
    this.remember(a.id);
    this.location.replaceState('/messages/' + a.id);
    this.items.set([]);
    this.error.set('');
    void this.load();
  }

  private remember(id: string): void {
    try {
      localStorage.setItem(LAST_KEY, id);
    } catch {
      /* not remembered */
    }
  }

  async ngOnInit(): Promise<void> {
    this.comm.startPresence();
    if (!this.comm.astrologers().length) await this.comm.loadAstrologers();
    void this.comm.refreshUnread();
    // No astrologer in the address: the last one used, else the first in the list.
    const ids = this.list().map((a) => a.id);
    if (!this.staffId() || !ids.includes(this.staffId())) {
      let last = '';
      try {
        last = localStorage.getItem(LAST_KEY) ?? '';
      } catch {
        /* none */
      }
      const pick = ids.includes(last) ? last : (ids[0] ?? '');
      if (pick && pick !== this.staffId()) {
        this.staffId.set(pick);
        this.location.replaceState('/messages/' + pick);
      }
    }
    if (this.staffId()) this.remember(this.staffId());
    await this.load();
    try {
      this.unsub = await this.comm.watch(() => {
        void this.load(false);
        void this.comm.refreshUnread();
      });
    } catch {
      /* live updates are optional */
    }
  }

  ngOnDestroy(): void {
    this.comm.stopTyping();
    void this.unsub?.();
    this.stopRecording(true);
    for (const p of this.pending()) URL.revokeObjectURL(p.preview);
  }

  text(key: CommKey, vars: Record<string, string | number> = {}): string {
    return fill(this.tx()[key], vars);
  }

  async load(spinner = true): Promise<void> {
    if (spinner) this.loading.set(true);
    this.error.set('');
    try {
      const [list, token] = await Promise.all([this.comm.messages(this.staffId(), this.isChief()), this.comm.fileToken()]);
      this.token.set(token);
      this.items.set(list);
      if (list.some((m) => m['sender'] === 'admin' && !m['seen'])) {
        await this.comm.markRepliesSeen(this.staffId());
        if (this.isChief()) await this.comm.markRepliesSeen('');
      }
      setTimeout(() => this.content()?.scrollToBottom(200), 50);
    } catch (e) {
      this.error.set(this.i18n.err(e));
    } finally {
      this.loading.set(false);
    }
  }

  url(m: RecordModel, f: string, thumb = ''): string {
    return this.comm.fileUrl(m, f, this.token(), thumb);
  }

  files(m: RecordModel): string[] {
    return (m['files'] as string[] | undefined) ?? [];
  }

  time(v: unknown): string {
    const d = new Date(String(v).replace(' ', 'T'));
    return isNaN(d.getTime())
      ? ''
      : new Intl.DateTimeFormat(`${this.i18n.lang()}-IN`, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(d);
  }

  // ---------- Attachments ----------
  async pick(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const list = Array.from(input.files ?? []);
    input.value = '';
    for (const f of list) await this.addFile(f);
  }

  private async addFile(f: File): Promise<void> {
    this.error.set('');
    if (this.pending().length >= MAX_FILES) {
      this.error.set(this.text('msg_too_many', { n: MAX_FILES }));
      return;
    }
    let file = f;
    let kind = fileKind(f.name);
    if (f.type.startsWith('image/')) kind = 'photo';
    else if (f.type.startsWith('video/')) kind = 'video';
    else if (f.type.startsWith('audio/')) kind = 'audio';
    if (kind === 'photo') {
      try {
        const small = await shrinkImage(f, 1600);
        file = new File([small], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
      } catch {
        /* the phone can't decode it (e.g. HEIC) - send as it is */
      }
    }
    if (file.size > MAX_FILE_BYTES) {
      this.error.set(this.text('msg_too_big', { mb: MAX_FILE_BYTES / 1048576 }));
      return;
    }
    const total = this.pending().reduce((s, p) => s + p.file.size, 0) + file.size;
    if (total > MAX_MESSAGE_BYTES) {
      this.error.set(this.text('msg_total_big', { mb: MAX_MESSAGE_BYTES / 1048576 }));
      return;
    }
    this.pending.update((p) => [...p, { file, kind, preview: URL.createObjectURL(file) }]);
  }

  removePending(i: number): void {
    const p = this.pending()[i];
    if (p) URL.revokeObjectURL(p.preview);
    this.pending.update((list) => list.filter((_, j) => j !== i));
  }

  // ---------- Voice recording (built-in browser recorder, free) ----------
  async toggleRecording(): Promise<void> {
    if (this.recording()) {
      this.stopRecording();
      return;
    }
    this.error.set('');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      this.error.set(this.tx().msg_mic_denied);
      return;
    }
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    const mime = types.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if ((rec as unknown as { discard?: boolean }).discard || !chunks.length) return;
      const type = (rec.mimeType || mime || 'audio/webm').split(';')[0];
      const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([new Blob(chunks, { type })], `voice-${Date.now()}.${ext}`, { type });
      void this.addFile(file);
    };
    rec.start(1000);
    this.recorder = rec;
    this.recording.set(true);
    this.recSecs.set(0);
    this.recTimer = setInterval(() => {
      this.recSecs.update((s) => s + 1);
      if (this.recSecs() >= MAX_RECORD_SECONDS) this.stopRecording();
    }, 1000);
  }

  private stopRecording(discard = false): void {
    if (this.recTimer) clearInterval(this.recTimer);
    this.recTimer = null;
    if (this.recorder && this.recorder.state !== 'inactive') {
      (this.recorder as unknown as { discard?: boolean }).discard = discard;
      this.recorder.stop();
    }
    this.recorder = null;
    this.recording.set(false);
  }

  // ---------- Send / delete ----------
  async send(): Promise<void> {
    if (this.sending() || this.recording()) return;
    const files = this.pending().map((p) => p.file);
    if (!this.note().trim() && !files.length && !this.attachLoc()) {
      this.error.set(this.tx().msg_need_something);
      return;
    }
    this.sending.set(true);
    this.error.set('');
    try {
      let where = null;
      if (this.attachLoc()) {
        try {
          where = await this.comm.locate();
        } catch {
          this.error.set(this.tx().msg_loc_denied);
          return;
        }
      }
      this.comm.stopTyping();
      await this.comm.send(this.staffId(), this.note(), files, where);
      for (const p of this.pending()) URL.revokeObjectURL(p.preview);
      this.pending.set([]);
      this.note.set('');
      this.attachLoc.set(false);
      document.querySelectorAll<HTMLTextAreaElement>('textarea.field').forEach((t) => (t.style.height = 'auto'));
      await this.load(false);
    } catch (e) {
      this.error.set(this.i18n.err(e));
    } finally {
      this.sending.set(false);
    }
  }

  async remove(m: RecordModel): Promise<void> {
    const a = await this.alerts.create({
      message: this.tx().msg_delete_q,
      buttons: [
        { text: this.tx().cancel, role: 'cancel' },
        { text: this.tx().msg_delete, role: 'destructive' },
      ],
    });
    await a.present();
    if ((await a.onDidDismiss()).role !== 'destructive') return;
    try {
      await this.comm.deleteMessage(m.id);
      this.items.update((l) => l.filter((x) => x.id !== m.id));
    } catch (e) {
      this.error.set(this.i18n.err(e));
    }
  }
}
