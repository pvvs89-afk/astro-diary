import { Injectable, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { RecordModel } from 'pocketbase';
import { I18nService } from '../i18n/i18n.service';
import { NOTIFY_TEXT } from '../notify/notify-text';
import { NOTIFY_KIND_NAMES, notifyKind } from '../notify/notify-kinds';
import { PbService } from './pb.service';

/**
 * In-app notifications from Astro Diary (sent by the super admin): unread count for
 * the menu, the list, read / unread, and a pop-up when one arrives while the app is
 * open. Also keeps the customer's app language on their account ("by language").
 */
@Injectable({ providedIn: 'root' })
export class NotifyService {
  private pbs = inject(PbService);
  private pb = this.pbs.pb;
  private i18n = inject(I18nService);
  private toasts = inject(ToastController);
  private router = inject(Router);

  readonly unread = signal(0);
  private started = false;

  constructor() {
    // Save the app language on the account whenever it changes.
    effect(() => {
      const lang = this.i18n.lang();
      void this.saveLanguage(lang);
    });
  }

  /** After login: unread count, live updates, language. Safe to call more than once. */
  start(): void {
    if (this.started || !this.pbs.isLoggedIn) return;
    this.started = true;
    void this.refreshUnread();
    void this.saveLanguage(this.i18n.lang());
    void this.pb
      .collection('inbox')
      .subscribe('*', (e: { action: string; record: RecordModel }) => {
        void this.refreshUnread();
        if (e.action === 'create') void this.popup(e.record);
      })
      .catch(() => (this.started = false));
  }

  async refreshUnread(): Promise<void> {
    if (!this.pbs.isLoggedIn) return;
    try {
      const r = await this.pb.collection('inbox').getList(1, 1, { filter: 'read = false', fields: 'id', requestKey: null });
      this.unread.set(r.totalItems);
    } catch {
      /* keep the last count */
    }
  }

  list(): Promise<RecordModel[]> {
    return this.pb.collection('inbox').getFullList({ sort: '-created', requestKey: null });
  }

  async markRead(id: string): Promise<void> {
    await this.pb.collection('inbox').update(id, { read: true });
    await this.refreshUnread();
  }

  async markAllRead(items: RecordModel[]): Promise<void> {
    await Promise.all(items.filter((n) => !n['read']).map((n) => this.pb.collection('inbox').update(n.id, { read: true })));
    await this.refreshUnread();
  }

  /** Opens the screen the notification points to (if any). */
  open(n: RecordModel): void {
    const link = String(n['link'] ?? '');
    if (link.startsWith('/')) void this.router.navigateByUrl(link);
  }

  private async popup(n: RecordModel): Promise<void> {
    const tx = NOTIFY_TEXT[this.i18n.lang()];
    const k = notifyKind(n['kind']);
    const toast = await this.toasts.create({
      // Coloured by type (styles in theme/variables.scss: .nk-toast.nk-<type>)
      cssClass: ['nk-toast', 'nk-' + k.id],
      header: NOTIFY_KIND_NAMES[this.i18n.lang()][k.id] + ' · ' + String(n['title'] || tx.n_new),
      message: String(n['body'] ?? '').slice(0, 140),
      duration: k.id === 'alert' ? 10000 : 6000,
      position: 'top',
      icon: k.icon,
      buttons: [{ text: tx.n_open, handler: () => void this.router.navigateByUrl('/notifications') }],
    });
    await toast.present();
  }

  private async saveLanguage(lang: string): Promise<void> {
    const u = this.pbs.user;
    if (!u || u['language'] === lang) return;
    try {
      await this.pb.collection('users').update(u.id, { language: lang });
    } catch {
      /* tried again next time */
    }
  }
}
