import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  call,
  chatbubbles,
  chevronForward,
  heart,
  notifications,
  notificationsOutline,
  people,
  planet,
  star,
  wallet,
} from 'ionicons/icons';
import { RecordModel } from 'pocketbase';
import { NAKSHATRA_NAMES } from '../i18n/astro-names';
import { I18nService } from '../i18n/i18n.service';
import { LangButtonComponent } from '../i18n/lang-button.component';
import { CommService, astroStatus } from '../services/comm.service';
import { NotifyService } from '../services/notify.service';
import { PbService } from '../services/pb.service';
import { moonLongitude } from '../shared/vimshottari';
import { NAK, TARA_RESULT, nakshatraSpan, taraNumber } from '../tarabalam/tara-calc';
import { TARA_TEXT } from '../tarabalam/tara-text';
import { START_TEXT, fillText } from './start-text';

/**
 * Home: greeting, today's star strength, quick actions, astrologers online now,
 * the latest notification and the plans. The first screen after login.
 */
@Component({
  selector: 'app-start',
  standalone: true,
  imports: [RouterLink, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton, IonButton, IonContent, IonIcon, LangButtonComponent],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start"><ion-menu-button [attr.aria-label]="t('menu')"></ion-menu-button></ion-buttons>
        <ion-title><span class="ad-icon ad-emblem title-icon" aria-hidden="true"></span> Astro Diary</ion-title>
        <ion-buttons slot="end">
          <ion-button routerLink="/wallet" class="wallet-chip" [attr.aria-label]="tx().wallet + ': ₹0'">
            <ion-icon slot="start" name="wallet" aria-hidden="true"></ion-icon> ₹0
          </ion-button>
          <ion-button routerLink="/notifications" [attr.aria-label]="'Notifications' + (notify.unread() ? ': ' + notify.unread() : '')" class="bell">
            <ion-icon slot="icon-only" [name]="notify.unread() ? 'notifications' : 'notifications-outline'"></ion-icon>
            @if (notify.unread()) { <span class="bell-badge">{{ notify.unread() }}</span> }
          </ion-button>
          <app-lang-button></app-lang-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="wrap">
        <h2 class="hello">{{ name() ? t('namaste_name', { name: name() }) : t('namaste') }}</h2>

        <!-- Today -->
        <section class="today" [attr.data-r]="today()?.result" aria-labelledby="today-h">
          <h3 id="today-h">{{ tx().today }}</h3>
          @if (today(); as d) {
            <p class="tara">{{ fill(tx().tara_line, { name: taraName(d.tara), result: tt().result[d.result] }) }}</p>
            <p class="small">{{ fill(tx().today_star, { star: starName(d.star) }) }} · {{ fill(tx().your_star, { star: starName(d.birth) }) }}</p>
            <a class="link" routerLink="/tarabalam">{{ tx().see_week }} <ion-icon name="chevron-forward" aria-hidden="true"></ion-icon></a>
          } @else if (noKundli()) {
            <p class="small">{{ tx().need_kundli }}</p>
            <a class="link" routerLink="/kundli">{{ tx().make_kundli }} <ion-icon name="chevron-forward" aria-hidden="true"></ion-icon></a>
          } @else {
            <p class="small">…</p>
          }
        </section>

        <!-- Quick actions -->
        <h3>{{ tx().quick }}</h3>
        <ul class="tiles">
          <li><a routerLink="/messages" class="tile c1"><ion-icon name="chatbubbles" aria-hidden="true"></ion-icon><span>{{ tx().q_chat }}</span></a></li>
          <li><a routerLink="/astrologers" class="tile c2"><ion-icon name="call" aria-hidden="true"></ion-icon><span>{{ tx().q_call }}</span></a></li>
          <li><a routerLink="/kundli" class="tile c3"><ion-icon name="planet" aria-hidden="true"></ion-icon><span>{{ tx().q_kundli }}</span></a></li>
          <li><a routerLink="/match-new" class="tile c4"><ion-icon name="heart" aria-hidden="true"></ion-icon><span>{{ tx().q_match }}</span></a></li>
          <li><a routerLink="/tarabalam" class="tile c5"><ion-icon name="star" aria-hidden="true"></ion-icon><span>{{ tx().q_tara }}</span></a></li>
          <li><a routerLink="/astrologers" class="tile c6"><ion-icon name="people" aria-hidden="true"></ion-icon><span>{{ tx().q_astros }}</span></a></li>
        </ul>

        <!-- Online now -->
        <div class="row-head">
          <h3>{{ tx().online_now }}</h3>
          <a routerLink="/astrologers" class="link">{{ tx().see_all }}</a>
        </div>
        @if (online().length) {
          <ul class="strip">
            @for (a of online(); track a.id) {
              <li>
                <a class="astro" [routerLink]="['/astrologer', a.id]">
                  <span class="av-wrap">
                    @if (comm.astroPhoto(a)) { <img class="av" [src]="comm.astroPhoto(a)" alt="" /> }
                    @else { <span class="av av-empty" aria-hidden="true">{{ (a['name'] || '?').slice(0, 1) }}</span> }
                    <span class="dot" aria-hidden="true"></span>
                  </span>
                  <span class="nm">{{ a['name'] }}</span>
                </a>
              </li>
            }
          </ul>
        } @else {
          <p class="muted small">{{ tx().none_online }}</p>
        }

        <!-- Latest notification -->
        @if (latest(); as n) {
          <a class="note" routerLink="/notifications">
            <ion-icon name="notifications" aria-hidden="true"></ion-icon>
            <span><small>{{ tx().latest }}</small><b>{{ n['title'] }}</b>@if (n['body']) { <span class="nb">{{ n['body'] }}</span> }</span>
          </a>
        }

        <!-- Plans -->
        <a class="plans" routerLink="/home">
          <span><b>{{ tx().plans_title }}</b><small>{{ tx().plans_cta }}</small></span>
          <ion-icon name="chevron-forward" aria-hidden="true"></ion-icon>
        </a>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .wrap { max-width: 820px; margin: 0 auto; }
      .hello { margin: 4px 0 14px; font-size: 22px; }
      h3 { margin: 18px 0 10px; font-size: 16px; }
      .small { font-size: 13px; margin: 4px 0; }
      .muted { color: var(--ion-color-medium); }
      .link { display: inline-flex; align-items: center; gap: 2px; font-weight: 600; font-size: 14px; color: var(--ion-color-primary); text-decoration: none; }
      .today { border-radius: 16px; padding: 14px 16px; background: linear-gradient(135deg, rgba(var(--ion-color-primary-rgb), 0.14), rgba(var(--ion-color-primary-rgb), 0.04)); border: 1px solid rgba(var(--ion-color-primary-rgb), 0.18); }
      .today h3 { margin: 0 0 6px; }
      .today .tara { margin: 0; font-size: 18px; font-weight: 700; }
      .today[data-r='very_good'] .tara, .today[data-r='good'] .tara { color: #0f7a4d; }
      .today[data-r='bad'] .tara { color: #b25e00; }
      .today[data-r='very_bad'] .tara { color: #c62828; }
      .tiles { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
      @media (min-width: 700px) { .tiles { grid-template-columns: repeat(6, 1fr); } }
      .tile { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 14px 6px; border-radius: 16px; text-decoration: none; color: var(--ion-text-color); background: var(--ion-color-light); text-align: center; font-size: 12.5px; font-weight: 600; min-height: 92px; }
      .tile ion-icon { font-size: 22px; width: 44px; height: 44px; padding: 11px; box-sizing: border-box; border-radius: 50%; color: #fff; }
      .tile:active { transform: scale(0.97); }
      .c1 ion-icon { background: #534ab7; } .c2 ion-icon { background: #1fa855; } .c3 ion-icon { background: #185fa5; }
      .c4 ion-icon { background: #d4537e; } .c5 ion-icon { background: #e0a100; } .c6 ion-icon { background: #993c1d; }
      .row-head { display: flex; align-items: baseline; justify-content: space-between; }
      .strip { list-style: none; padding: 2px 0 6px; margin: 0; display: flex; gap: 12px; overflow-x: auto; scrollbar-width: thin; }
      .astro { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 76px; text-decoration: none; color: var(--ion-text-color); }
      .av-wrap { position: relative; }
      .av { width: 62px; height: 62px; border-radius: 50%; object-fit: cover; display: block; border: 2px solid #1fa855; }
      .av-empty { display: flex; align-items: center; justify-content: center; background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); font-weight: 700; font-size: 24px; text-transform: uppercase; }
      .dot { position: absolute; right: 2px; bottom: 2px; width: 13px; height: 13px; border-radius: 50%; background: #1fa855; border: 2px solid var(--ion-background-color, #fff); }
      .nm { font-size: 12px; text-align: center; max-width: 76px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .note { display: flex; gap: 12px; align-items: flex-start; margin-top: 16px; padding: 12px 14px; border-radius: 14px; text-decoration: none; color: inherit; background: var(--ion-color-light); }
      .note ion-icon { font-size: 22px; color: var(--ion-color-primary); flex: none; margin-top: 2px; }
      .note span { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .note small { color: var(--ion-color-medium); }
      .nb { font-size: 13px; color: var(--ion-color-medium-shade); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .plans { display: flex; align-items: center; justify-content: space-between; margin: 16px 0 8px; padding: 14px 16px; border-radius: 14px; text-decoration: none; color: var(--ion-color-primary-contrast); background: var(--ion-color-primary); }
      .plans span { display: flex; flex-direction: column; gap: 2px; }
      .plans small { opacity: 0.85; }
      .bell { position: relative; }
      .wallet-chip { --padding-start: 10px; --padding-end: 10px; font-weight: 700; font-size: 13px; border: 1px solid rgba(255, 255, 255, 0.5); border-radius: 16px; height: 30px; }
      .bell-badge { position: absolute; top: 2px; right: 0; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; background: #e24b4a; color: #fff; font-size: 10px; font-weight: 700; line-height: 16px; text-align: center; }
    `,
  ],
})
export class StartPage implements OnInit {
  readonly comm = inject(CommService);
  readonly notify = inject(NotifyService);
  private pbs = inject(PbService);
  private i18n = inject(I18nService);
  readonly t = this.i18n.t;
  readonly tx = computed(() => START_TEXT[this.i18n.lang()]);
  readonly tt = computed(() => TARA_TEXT[this.i18n.lang()]);
  readonly fill = fillText;

  readonly name = signal(String(this.pbs.user?.['name'] ?? ''));
  readonly birthStar = signal<number | null>(null);
  readonly noKundli = signal(false);
  readonly latest = signal<RecordModel | null>(null);
  readonly now = signal(Date.now());

  readonly online = computed(() => this.comm.astrologers().filter((a) => astroStatus(a).online));

  readonly today = computed(() => {
    const b = this.birthStar();
    if (b === null) return null;
    const star = nakshatraSpan(this.now()).index;
    const tara = taraNumber(b, star);
    return { birth: b, star, tara, result: TARA_RESULT[tara] };
  });

  constructor() {
    addIcons({ call, chatbubbles, chevronForward, heart, notifications, notificationsOutline, people, planet, star, wallet });
  }

  async ngOnInit(): Promise<void> {
    this.comm.startPresence();
    this.notify.start();
    void this.comm.loadAstrologers();
    void this.loadLatest();
    // Birth star: saved by Tara Balam on this phone, else from the kundli.
    try {
      const v = JSON.parse(localStorage.getItem('astro.tara.' + (this.pbs.user?.id ?? '')) ?? 'null');
      if (v && typeof v.birthStar === 'number') this.birthStar.set(v.birthStar);
    } catch {
      /* none saved */
    }
    try {
      const state = await this.pbs.kundliState();
      const lon = moonLongitude(state.kundli?.['data']?.planets);
      if (lon === null) {
        if (this.birthStar() === null) this.noKundli.set(true);
      } else {
        this.birthStar.set(Math.floor(lon / NAK) % 27);
      }
    } catch {
      /* offline: keep the saved one */
    }
  }

  ionViewWillEnter(): void {
    this.now.set(Date.now());
    this.name.set(String(this.pbs.user?.['name'] ?? ''));
    void this.loadLatest();
  }

  private async loadLatest(): Promise<void> {
    try {
      const r = await this.notify.list();
      this.latest.set(r[0] ?? null);
    } catch {
      /* none */
    }
  }

  starName(i: number): string {
    return NAKSHATRA_NAMES[this.i18n.lang()][i] ?? '';
  }

  taraName(n: number): string {
    return this.tt().names[n] ?? '';
  }
}
