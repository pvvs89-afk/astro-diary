import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonApp,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenu,
  IonMenuToggle,
  IonRouterOutlet,
  IonTitle,
  IonToolbar,
  MenuController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  cardOutline,
  chatbubblesOutline,
  locationOutline,
  chevronDownOutline,
  chevronUpOutline,
  createOutline,
  heartOutline,
  homeOutline,
  listOutline,
  logOutOutline,
  menuOutline,
  personCircleOutline,
  personOutline,
  planetOutline,
  starOutline,
  peopleOutline,
  notifications,
  notificationsOutline,
  chatbubbles,
  walletOutline,
} from 'ionicons/icons';
import { NotifyService } from './services/notify.service';
import { NOTIFY_TEXT } from './notify/notify-text';
import { START_TEXT } from './start/start-text';
import { I18nService } from './i18n/i18n.service';
import { PbService } from './services/pb.service';
import { CommService } from './services/comm.service';
import { COMM_TEXT } from './comm/comm-text';
import { CallOverlayComponent } from './call/call-overlay.component';
import { CallService } from './call/call.service';
import { AppThemeService } from './services/app-theme.service';

/** App shell: side menu (Kundli → My Kundli / Match making / My matches / Birth details, Subscription, Logout) + pages. */
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  imports: [
    IonApp,
    IonRouterOutlet,
    IonMenu,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonFooter,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonMenuToggle,
    RouterLink,
    RouterLinkActive,
    CallOverlayComponent,
  ],
})
export class AppComponent {
  private pbs = inject(PbService);
  private comm = inject(CommService);
  private calls = inject(CallService);
  /** Whole-app theme (applied at start from this phone's saved choice). */
  private appTheme = inject(AppThemeService);
  readonly unread = this.comm.unread;
  readonly astroOnline = this.comm.astroOnline;
  readonly avatar = signal('');
  private router = inject(Router);
  private menu = inject(MenuController);
  private i18n = inject(I18nService);
  readonly t = this.i18n.t;
  readonly ct = computed(() => COMM_TEXT[this.i18n.lang()]);
  /** Notifications from Astro Diary (menu badge). */
  private notify = inject(NotifyService);
  readonly notifUnread = this.notify.unread;
  readonly nt = computed(() => NOTIFY_TEXT[this.i18n.lang()]);
  readonly st = computed(() => START_TEXT[this.i18n.lang()]);
  /** Bottom tabs: on when logged in, off on login and inside a chat. */
  readonly tabsOn = signal(false);
  /** Customer chose to appear offline to the astrologer. */
  readonly hideOnline = signal(false);
  readonly statusBusy = signal(false);

  /** Menu is off on the login page and when nobody is logged in. */
  readonly menuOn = signal(false);
  readonly userName = signal('');
  readonly userEmail = signal('');
  /** Kundli sub-menu open (starts open). */
  readonly kundliOpen = signal(true);

  constructor() {
    addIcons({ cardOutline, chevronDownOutline, chevronUpOutline, personOutline, homeOutline, planetOutline, heartOutline, listOutline, createOutline, logOutOutline, personCircleOutline, menuOutline, starOutline, chatbubblesOutline, locationOutline, peopleOutline, notifications, notificationsOutline, chatbubbles, walletOutline });
    // Unread replies badge: checked when the menu opens and every 2 minutes.
    setInterval(() => this.pbs.isLoggedIn && void this.comm.refreshUnread(), 120_000);
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.menuOn.set(this.pbs.isLoggedIn && !e.urlAfterRedirects.startsWith('/login'));
        this.tabsOn.set(this.menuOn() && !e.urlAfterRedirects.startsWith('/messages'));
        if (this.pbs.isLoggedIn) {
          this.comm.startPresence();
          this.calls.listen();
          this.notify.start();
          this.appTheme.syncFromAccount();
        }
      }
    });
  }

  refreshUser(): void {
    const u = this.pbs.user;
    this.userName.set((u?.['name'] as string) || '');
    this.userEmail.set((u?.['email'] as string) || '');
    this.hideOnline.set(!!u?.['hide_online']);
    void this.comm.avatarUrl('100x100').then((url) => this.avatar.set(url), () => this.avatar.set(''));
    void this.comm.refreshUnread();
    void this.notify.refreshUnread();
  }

  async setOnline(on: boolean): Promise<void> {
    if (this.statusBusy() || this.hideOnline() === !on) return;
    this.statusBusy.set(true);
    try {
      await this.comm.setHideOnline(!on);
      this.hideOnline.set(!on);
    } catch {
      /* stays as it was */
    } finally {
      this.statusBusy.set(false);
    }
  }

  async logout(): Promise<void> {
    await this.menu.close('main');
    this.pbs.logout();
    this.menuOn.set(false);
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
