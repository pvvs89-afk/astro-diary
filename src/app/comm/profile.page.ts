import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonSpinner,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular';
import { I18nService } from '../i18n/i18n.service';
import { LangButtonComponent } from '../i18n/lang-button.component';
import { CHAT_THEMES, ChatTheme, CommService, shrinkImage } from '../services/comm.service';
import { PbService } from '../services/pb.service';
import { APP_THEMES, AppTheme, AppThemeService } from '../services/app-theme.service';
import { COMM_TEXT } from './comm-text';

/** My Profile: name, email and profile photo (cropped square, 512 px, on the phone). */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonMenuButton, IonButton, IonContent, IonSpinner, IonToggle, LangButtonComponent],
  templateUrl: './profile.page.html',
  styleUrls: ['./comm.scss'],
})
export class ProfilePage implements OnInit {
  readonly comm = inject(CommService);
  readonly themes = CHAT_THEMES;
  readonly appTheme = inject(AppThemeService);
  readonly appThemes = APP_THEMES;
  private pbs = inject(PbService);
  private i18n = inject(I18nService);
  private alerts = inject(AlertController);
  readonly t = this.i18n.t;
  readonly tx = computed(() => COMM_TEXT[this.i18n.lang()]);

  readonly photo = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly done = signal('');
  readonly name = signal('');
  readonly email = signal('');
  readonly hideOnline = signal(false);

  async ngOnInit(): Promise<void> {
    const u = this.pbs.user;
    this.name.set(String(u?.['name'] ?? ''));
    this.email.set(String(u?.['email'] ?? ''));
    this.hideOnline.set(!!u?.['hide_online']);
    this.comm.startPresence();
    await this.refresh();
  }

  private async refresh(): Promise<void> {
    try {
      this.photo.set(await this.comm.avatarUrl('300x300'));
    } catch {
      this.photo.set('');
    }
  }

  async pick(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    this.busy.set(true);
    this.error.set('');
    this.done.set('');
    try {
      const small = await shrinkImage(f, 512, true, 0.85);
      await this.comm.setAvatar(small);
      await this.refresh();
      this.done.set(this.tx().prof_saved);
    } catch (e) {
      this.error.set(this.i18n.err(e));
    } finally {
      this.busy.set(false);
    }
  }

  themeName(id: ChatTheme): string {
    return this.tx()[('theme_' + id) as 'theme_clean'];
  }

  appThemeName(id: AppTheme): string {
    return this.tx()[('app_' + id) as 'app_classic'];
  }

  async setAppTheme(t: AppTheme): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.appTheme.set(t);
    } catch (e) {
      this.error.set(this.i18n.err(e));
    } finally {
      this.busy.set(false);
    }
  }

  async setTheme(theme: ChatTheme): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.comm.setMyTheme(theme);
    } catch (e) {
      this.error.set(this.i18n.err(e));
    } finally {
      this.busy.set(false);
    }
  }

  async setShowOnline(show: boolean): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.comm.setHideOnline(!show);
      this.hideOnline.set(!show);
    } catch (e) {
      this.error.set(this.i18n.err(e));
      this.hideOnline.set(this.hideOnline()); // put the switch back
    } finally {
      this.busy.set(false);
    }
  }

  async remove(): Promise<void> {
    const a = await this.alerts.create({
      message: this.tx().prof_remove_q,
      buttons: [
        { text: this.tx().cancel, role: 'cancel' },
        { text: this.tx().yes, role: 'destructive' },
      ],
    });
    await a.present();
    if ((await a.onDidDismiss()).role !== 'destructive') return;
    this.busy.set(true);
    try {
      await this.comm.removeAvatar();
      this.photo.set('');
    } catch (e) {
      this.error.set(this.i18n.err(e));
    } finally {
      this.busy.set(false);
    }
  }
}
