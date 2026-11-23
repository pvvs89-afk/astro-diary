import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alarm, alertCircle, checkmarkCircle, chevronForward, informationCircle, notifications, notificationsOutline, pricetag, sparkles, warning } from 'ionicons/icons';
import { RecordModel } from 'pocketbase';
import { I18nService } from '../i18n/i18n.service';
import { LangButtonComponent } from '../i18n/lang-button.component';
import { PbService } from '../services/pb.service';
import { NotifyService } from '../services/notify.service';
import { NOTIFY_TEXT } from './notify-text';
import { NOTIFY_KIND_CSS, NOTIFY_KIND_NAMES, notifyKind } from './notify-kinds';

/** Notifications from Astro Diary: newest first, unread highlighted. Updates live. */
@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonMenuButton, IonButton, IonContent, IonSpinner, IonIcon, LangButtonComponent],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button [attr.aria-label]="t('back')" defaultHref="/kundli"></ion-back-button>
          <ion-menu-button [attr.aria-label]="t('menu')"></ion-menu-button>
        </ion-buttons>
        <ion-title>{{ tx().n_title }}</ion-title>
        <ion-buttons slot="end"><app-lang-button></app-lang-button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="wrap">
        @if (notify.unread()) {
          <div class="top">
            <span class="count">{{ tx().n_unread }}: {{ notify.unread() }}</span>
            <ion-button size="small" fill="outline" (click)="markAll()">{{ tx().n_mark_all }}</ion-button>
          </div>
        }
        @if (loading()) {
          <div class="center" role="status"><ion-spinner name="crescent" aria-hidden="true"></ion-spinner><span class="sr-only">{{ t('loading') }}</span></div>
        } @else {
          <ul class="list">
            @for (n of items(); track n.id) {
              <li>
                <button type="button" [class]="'item nk k-' + kindOf(n).id" [class.unread]="!n['read']" [style.--k]="kindOf(n).color" (click)="open(n)">
                  <span class="nk-ic" aria-hidden="true"><ion-icon [name]="kindOf(n).icon"></ion-icon></span>
                  <span class="body">
                    <span class="meta"><span class="nk-badge">{{ kindName(n) }}</span><small class="when">{{ when(n['created']) }}</small></span>
                    <b class="ttl">{{ n['title'] }}</b>
                    @if (n['body']) { <span class="msg">{{ n['body'] }}</span> }
                  </span>
                  @if (n['link']) { <ion-icon class="go" name="chevron-forward" aria-hidden="true"></ion-icon> }
                  @if (!n['read']) { <span class="dot" [attr.aria-label]="tx().n_unread"></span> }
                </button>
              </li>
            } @empty {
              <li class="empty">{{ tx().n_empty }}</li>
            }
          </ul>
        }
      </div>
    </ion-content>
  `,
  styles: [
    NOTIFY_KIND_CSS,
    `
      .wrap { max-width: 760px; margin: 0 auto; }
      .top { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; }
      .count { font-weight: 600; color: var(--ion-color-primary); }
      .list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
      .item {
        width: 100%; display: flex; gap: 10px; align-items: flex-start; text-align: left; padding: 9px 12px; border-radius: 12px;
        border: 1px solid var(--ion-color-step-150, #e4e4e4); background: var(--ion-background-color); color: inherit; font: inherit; cursor: pointer; position: relative;
      }
      .item.unread { box-shadow: 0 2px 8px color-mix(in srgb, var(--k) 18%, transparent); }
      .body { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; padding-right: 10px; }
      .meta { display: flex; align-items: center; gap: 8px; }
      .ttl { font-size: 14px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .item:not(.unread) .ttl { font-weight: 600; }
      .msg { font-size: 13px; line-height: 1.35; color: var(--ion-color-medium); word-break: break-word;
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .when { color: var(--ion-color-medium); font-size: 11px; }
      .go { align-self: center; color: var(--ion-color-medium); font-size: 16px; flex: none; }
      .dot { position: absolute; top: 9px; right: 9px; width: 8px; height: 8px; border-radius: 50%; background: var(--k, var(--ion-color-danger)); }
      .empty { color: var(--ion-color-medium); padding: 20px 4px; text-align: center; }
      .center { display: flex; justify-content: center; padding: 40px; }
      .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    `,
  ],
})
export class NotificationsPage implements OnInit, OnDestroy {
  readonly notify = inject(NotifyService);
  private pbs = inject(PbService);
  private i18n = inject(I18nService);
  readonly t = this.i18n.t;
  readonly tx = computed(() => NOTIFY_TEXT[this.i18n.lang()]);
  readonly loading = signal(true);
  readonly items = signal<RecordModel[]>([]);
  private unsub: (() => Promise<void>) | null = null;

  constructor() {
    addIcons({ alarm, alertCircle, checkmarkCircle, chevronForward, informationCircle, notifications, notificationsOutline, pricetag, sparkles, warning });
  }

  async ngOnInit(): Promise<void> {
    this.notify.start();
    await this.load();
    this.loading.set(false);
    try {
      this.unsub = await this.pbs.pb.collection('inbox').subscribe('*', () => void this.load());
    } catch {
      /* live updates optional */
    }
  }

  ngOnDestroy(): void {
    void this.unsub?.();
  }

  private async load(): Promise<void> {
    try {
      this.items.set(await this.notify.list());
    } catch {
      /* keep what is shown */
    }
  }

  async open(n: RecordModel): Promise<void> {
    if (!n['read']) {
      this.items.update((l) => l.map((x) => (x.id === n.id ? ({ ...x, read: true } as RecordModel) : x)));
      void this.notify.markRead(n.id).catch(() => undefined);
    }
    this.notify.open(n);
  }

  async markAll(): Promise<void> {
    const list = this.items();
    this.items.update((l) => l.map((x) => ({ ...x, read: true }) as RecordModel));
    await this.notify.markAllRead(list).catch(() => undefined);
  }

  kindOf(n: RecordModel) {
    return notifyKind(n['kind']);
  }

  kindName(n: RecordModel): string {
    return NOTIFY_KIND_NAMES[this.i18n.lang()][this.kindOf(n).id];
  }

  when(v: unknown): string {
    const d = new Date(String(v).replace(' ', 'T'));
    return isNaN(d.getTime())
      ? ''
      : new Intl.DateTimeFormat(`${this.i18n.lang()}-IN`, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(d);
  }
}
