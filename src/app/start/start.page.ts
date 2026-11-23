import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonSpinner,
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
  alarm,
  alertCircle,
  checkmarkCircle,
  informationCircle,
  pricetag,
  sparkles,
  warning,
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
import { SKILL_NAMES, START_TEXT, fillText } from './start-text';
import { NOTIFY_KIND_CSS, NOTIFY_KIND_NAMES, notifyKind } from '../notify/notify-kinds';

/**
 * Home: greeting, today's star strength, quick actions, astrologers online now,
 * the latest notification and the plans. The first screen after login.
 */
@Component({
  selector: 'app-start',
  standalone: true,
  imports: [RouterLink, IonHeader, IonToolbar, IonButtons, IonMenuButton, IonSpinner, IonContent, IonIcon, LangButtonComponent],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar class="home-bar">
        <ion-buttons slot="start"><ion-menu-button [attr.aria-label]="t('menu')"></ion-menu-button></ion-buttons>
        <div class="hello">
          <small>{{ t('namaste') }}</small>
          <b class="ad-head">{{ name() || 'Astro Diary' }}</b>
        </div>
        <ion-buttons slot="end">
          <a routerLink="/wallet" class="chip" [attr.aria-label]="tx().wallet + ': ₹0'"><ion-icon name="wallet" aria-hidden="true"></ion-icon> ₹0</a>
          <a routerLink="/notifications" class="bell" [attr.aria-label]="'Notifications' + (notify.unread() ? ': ' + notify.unread() : '')">
            <ion-icon [name]="notify.unread() ? 'notifications' : 'notifications-outline'" aria-hidden="true"></ion-icon>
            @if (notify.unread()) { <span class="bell-dot">{{ notify.unread() }}</span> }
          </a>
          <app-lang-button></app-lang-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding ad-sky">
      @if (loading()) {
        <div class="page-loading" role="status" aria-live="polite">
          <ion-spinner name="crescent" aria-hidden="true"></ion-spinner>
          <span>{{ t('loading') }}</span>
        </div>
      }
      <div class="wrap" [class.is-loading]="loading()">
        <!-- Today -->
        <section class="hero" [attr.data-r]="today()?.result" aria-labelledby="today-h">
          <div class="hero-top">
            <span id="today-h" class="over">{{ tx().today }}</span>
            @if (today(); as d) { <span class="pill">{{ tt().result[d.result] }}</span> }
          </div>
          @if (today(); as d) {
            <div class="hero-main">
              <span class="ring" aria-hidden="true"><ion-icon name="star"></ion-icon></span>
              <div>
                <div class="tara ad-head">{{ taraName(d.tara) }} {{ tt().tara }}</div>
                <div class="sub">{{ fill(tx().today_star, { star: starName(d.star) }) }} · {{ fill(tx().your_star, { star: starName(d.birth) }) }}</div>
              </div>
            </div>
            <a class="link" routerLink="/tarabalam">{{ tx().see_week }} <ion-icon name="chevron-forward" aria-hidden="true"></ion-icon></a>
          } @else if (noKundli()) {
            <p class="sub">{{ tx().need_kundli }}</p>
            <a class="link" routerLink="/kundli">{{ tx().make_kundli }} <ion-icon name="chevron-forward" aria-hidden="true"></ion-icon></a>
          } @else {
            <p class="sub">…</p>
          }
        </section>

        <!-- Talk now -->
        <section class="banner">
          <div class="b-text">
            <b class="ad-head">{{ tx().talk_now }}</b>
            <small>{{ online().length ? fill(tx().talk_sub, { n: online().length }) : tx().talk_sub0 }}</small>
          </div>
          <a class="b-btn" routerLink="/astrologers"><ion-icon name="call" aria-hidden="true"></ion-icon> {{ tx().call }}</a>
        </section>

        <!-- Quick actions -->
        <ul class="tiles" [attr.aria-label]="tx().quick">
          <li><a routerLink="/messages" class="tile"><span class="ti t1"><ion-icon name="chatbubbles" aria-hidden="true"></ion-icon></span>{{ tx().tab_chat }}</a></li>
          <li><a routerLink="/astrologers" class="tile"><span class="ti t2"><ion-icon name="call" aria-hidden="true"></ion-icon></span>{{ tx().call }}</a></li>
          <li><a routerLink="/kundli" class="tile"><span class="ti t3"><ion-icon name="planet" aria-hidden="true"></ion-icon></span>{{ tx().tab_kundli }}</a></li>
          <li><a routerLink="/match-new" class="tile"><span class="ti t4"><ion-icon name="heart" aria-hidden="true"></ion-icon></span>{{ tx().q_match }}</a></li>
          <li><a routerLink="/tarabalam" class="tile"><span class="ti t5"><ion-icon name="star" aria-hidden="true"></ion-icon></span>{{ tx().q_tara }}</a></li>
          <li><a routerLink="/astrologers" class="tile"><span class="ti t6"><ion-icon name="people" aria-hidden="true"></ion-icon></span>{{ tx().tab_astro }}</a></li>
        </ul>

        <!-- Astrologers -->
        <div class="row-head">
          <h2>{{ online().length ? tx().live_title : tx().our_astros }}</h2>
          <a routerLink="/astrologers" class="link">{{ tx().see_all }}</a>
        </div>
        <ul class="cards">
          @for (a of featured(); track a.id) {
            <li class="acard">
              <a class="a-top" [routerLink]="['/astrologer', a.id]">
                <span class="av-wrap" [class.live]="isOnline(a)">
                  @if (comm.astroPhoto(a)) { <img class="av" [src]="comm.astroPhoto(a)" alt="" /> }
                  @else { <span class="av av-empty" aria-hidden="true">{{ (a['name'] || '?').slice(0, 1) }}</span> }
                  @if (isOnline(a)) { <span class="dot" aria-hidden="true"></span> }
                </span>
                <b class="nm">{{ a['name'] }}</b>
                @if (skills(a)) { <small class="sk">{{ skills(a) }}</small> }
                <span class="meta">
                  @if (a['reviews']) { <span class="stars">★ {{ a['rating'] }}</span> }
                  @if (a['rate']) { <span class="price">{{ fill(tx().per_min, { n: a['rate'] }) }}</span> }
                </span>
              </a>
              <a class="c-btn" [routerLink]="['/messages', a.id]"><ion-icon name="chatbubbles" aria-hidden="true"></ion-icon> {{ tx().chat }}</a>
            </li>
          } @empty {
            <li class="muted small">{{ tx().none_online }}</li>
          }
        </ul>

        <!-- Latest notification -->
        @if (latest(); as n) {
          <a [class]="'note nk k-' + kindOf(n).id" [style.--k]="kindOf(n).color" routerLink="/notifications">
            <span class="nk-ic" aria-hidden="true"><ion-icon [name]="kindOf(n).icon"></ion-icon></span>
            <span><span class="nk-badge">{{ kindName(n) }}</span><b>{{ n['title'] }}</b>@if (n['body']) { <span class="nb">{{ n['body'] }}</span> }</span>
          </a>
        }

        <!-- Plans -->
        <a class="plans" routerLink="/home">
          <span><b class="ad-head">{{ tx().plans_title }}</b><small>{{ tx().plans_cta }}</small></span>
          <ion-icon name="chevron-forward" aria-hidden="true"></ion-icon>
        </a>
      </div>
    </ion-content>
  `,
  styles: [
    NOTIFY_KIND_CSS,
    `
      .home-bar { --background: transparent; --border-width: 0; --min-height: 64px; }
      .hello { display: flex; flex-direction: column; line-height: 1.2; padding-left: 4px; }
      .hello small { font-size: 12px; color: var(--ion-color-medium); }
      .hello b { font-size: 19px; color: var(--ion-text-color); }
      .chip { height: 34px; padding: 0 12px; margin-right: 6px; border-radius: 17px; display: inline-flex; align-items: center; gap: 5px; text-decoration: none;
        font-weight: 700; font-size: 13px; color: var(--ion-text-color); background: var(--ad-card); border: 1px solid var(--ad-line); }
      .chip ion-icon { color: var(--ion-color-primary); font-size: 17px; }
      .bell { position: relative; width: 38px; height: 38px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
        background: var(--ad-card); border: 1px solid var(--ad-line); color: var(--ion-text-color); font-size: 19px; }
      .bell-dot { position: absolute; top: -3px; right: -3px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; background: #FF4D6A; color: #fff; font-size: 10px; font-weight: 700; line-height: 16px; text-align: center; }
      .wrap.is-loading { display: none; }
      .wrap { max-width: 820px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
      .muted { color: var(--ion-color-medium); }
      .small { font-size: 13px; }
      .link { display: inline-flex; align-items: center; gap: 2px; font-weight: 700; font-size: 13px; color: var(--ion-color-primary); text-decoration: none; }
      .hero { border-radius: 24px; padding: 18px; background: var(--ad-card2); border: 1px solid var(--ad-line); display: flex; flex-direction: column; gap: 10px; }
      .hero-top { display: flex; justify-content: space-between; align-items: center; }
      .over { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ion-color-medium); }
      .pill { font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 12px; background: rgba(var(--ion-color-primary-rgb), 0.14); color: var(--ion-text-color); }
      .hero[data-r='very_good'] .pill, .hero[data-r='good'] .pill { background: color-mix(in srgb, var(--ad-good) 20%, transparent); color: var(--ad-good); }
      .hero[data-r='bad'] .pill { background: rgba(232, 140, 0, 0.18); color: #d97a00; }
      .hero[data-r='very_bad'] .pill { background: rgba(229, 57, 59, 0.16); color: #e5393b; }
      .hero-main { display: flex; align-items: center; gap: 14px; }
      .ring { background: radial-gradient(100% 80% at 30% 15%, rgba(var(--ion-color-primary-rgb), 0.22), rgba(var(--ion-color-primary-rgb), 0.04)); }
      .ring { width: 62px; height: 62px; border-radius: 50%; border: 2px solid var(--ion-color-primary); display: flex; align-items: center; justify-content: center; font-size: 28px; color: var(--ion-color-primary); flex: none; }
      .tara { font-size: 22px; font-weight: 700; line-height: 1.2; }
      .sub { font-size: 13px; color: var(--ion-color-medium); margin: 2px 0 0; }
      .banner { border-radius: 22px; padding: 16px; display: flex; align-items: center; gap: 12px; background: var(--ad-banner); color: var(--ad-banner-ink); border: 1px solid var(--ad-line); }
      .b-text { flex: 1; display: flex; flex-direction: column; gap: 2px; }
      .b-text b { font-size: 18px; line-height: 1.25; }
      .b-text small { font-size: 12.5px; opacity: 0.9; }
      .b-btn { height: 42px; padding: 0 16px; border-radius: 21px; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; font-weight: 700; font-size: 14px;
        background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18); flex: none; }
      .tiles { list-style: none; padding: 4px 0; margin: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px 8px; }
      @media (min-width: 700px) { .tiles { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
      .tile { display: flex; flex-direction: column; align-items: center; gap: 8px; text-decoration: none; color: var(--ion-text-color); font-size: 12px; font-weight: 600; text-align: center; }
      .ti { position: relative; overflow: hidden; width: 54px; height: 54px; border-radius: 18px; display: flex; align-items: center; justify-content: center; font-size: 25px; color: #fff;
        transition: transform 0.15s; }
      /* glossy shine on each tile */
      .ti::before { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
        background: radial-gradient(120% 85% at 28% 10%, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0) 55%),
          linear-gradient(180deg, rgba(255, 255, 255, 0) 55%, rgba(0, 0, 0, 0.14));
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5), inset 0 -2px 4px rgba(0, 0, 0, 0.12); }
      .ti ion-icon { position: relative; filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.25)); }
      .tile:active .ti { transform: scale(0.94); }
      .t1 { background: var(--ad-tile1); box-shadow: 0 6px 14px color-mix(in srgb, var(--ad-tile1) 35%, transparent); }
      .t2 { background: var(--ad-tile2); box-shadow: 0 6px 14px color-mix(in srgb, var(--ad-tile2) 35%, transparent); }
      .t3 { background: var(--ad-tile3); box-shadow: 0 6px 14px color-mix(in srgb, var(--ad-tile3) 35%, transparent); }
      .t4 { background: var(--ad-tile4); box-shadow: 0 6px 14px color-mix(in srgb, var(--ad-tile4) 35%, transparent); }
      .t5 { background: var(--ad-tile5); box-shadow: 0 6px 14px color-mix(in srgb, var(--ad-tile5) 35%, transparent); }
      .t6 { background: var(--ad-tile6); box-shadow: 0 6px 14px color-mix(in srgb, var(--ad-tile6) 35%, transparent); }
      .row-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: -6px; }
      .row-head h2 { margin: 0; font-size: 18px; }
      .cards { list-style: none; padding: 2px 2px 8px; margin: 0 -16px 0 0; display: flex; gap: 12px; overflow-x: auto; scrollbar-width: none; }
      .acard { flex: none; width: 152px; padding: 14px 12px; border-radius: 20px; background: var(--ad-card); border: 1px solid var(--ad-line); display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
      .a-top { display: flex; flex-direction: column; align-items: center; gap: 4px; text-decoration: none; color: inherit; width: 100%; }
      .av-wrap { position: relative; margin-bottom: 4px; }
      .av { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; display: block; }
      .av-wrap.live .av { box-shadow: 0 0 0 3px var(--ad-card), 0 0 0 5px var(--ad-good); }
      .av-empty { display: flex; align-items: center; justify-content: center; background: var(--ad-tile1); color: #fff; font-weight: 700; font-size: 24px; text-transform: uppercase; }
      .dot { position: absolute; right: 2px; bottom: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--ad-good); border: 2px solid var(--ad-card); }
      .nm { font-size: 14px; max-width: 128px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sk { font-size: 11.5px; color: var(--ion-color-medium); max-width: 128px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .meta { display: flex; gap: 8px; font-size: 12px; font-weight: 700; min-height: 16px; }
      .stars { color: #E0A100; }
      .price { color: var(--ion-color-primary); }
      .c-btn { background-image: linear-gradient(180deg, rgba(255,255,255,0.25), rgba(255,255,255,0) 60%) !important; }
      .c-btn { width: 100%; height: 34px; border-radius: 17px; display: flex; align-items: center; justify-content: center; gap: 6px; text-decoration: none; font-size: 13px; font-weight: 700;
        background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); }
      .note { display: flex; gap: 10px; align-items: center; padding: 9px 12px; border-radius: 14px; text-decoration: none; color: inherit; background: var(--ad-card); border: 1px solid var(--ad-line); }
      .note b { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .note .nk-badge { align-self: flex-start; }
      .note span { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .note small { color: var(--ion-color-medium); }
      .nb { font-size: 12.5px; color: var(--ion-color-medium); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .plans { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-radius: 18px; text-decoration: none;
        background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); margin-bottom: 8px; }
      .plans span { display: flex; flex-direction: column; gap: 2px; }
      .plans b { font-size: 17px; }
      .plans small { opacity: 0.85; }
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
  /** First visit: spinner until astrologers, today's star and the latest notification are in. */
  readonly loading = signal(true);
  readonly latest = signal<RecordModel | null>(null);
  readonly now = signal(Date.now());

  readonly online = computed(() => this.comm.astrologers().filter((a) => astroStatus(a).online));
  /** Live astrologers, or (when nobody is online) the best rated, for the Home row. */
  readonly featured = computed(() => {
    const on = this.online();
    const list = on.length ? on : [...this.comm.astrologers()];
    return list.sort((a, b) => Number(b['rating'] || 0) - Number(a['rating'] || 0)).slice(0, 10);
  });

  readonly today = computed(() => {
    const b = this.birthStar();
    if (b === null) return null;
    const star = nakshatraSpan(this.now()).index;
    const tara = taraNumber(b, star);
    return { birth: b, star, tara, result: TARA_RESULT[tara] };
  });

  constructor() {
    addIcons({ call, chatbubbles, chevronForward, heart, notifications, notificationsOutline, people, planet, star, wallet, alarm, alertCircle, checkmarkCircle, informationCircle, pricetag, sparkles, warning });
  }

  async ngOnInit(): Promise<void> {
    this.comm.startPresence();
    this.notify.start();
    const astros = this.comm.loadAstrologers();
    const latest = this.loadLatest();
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
    await Promise.allSettled([astros, latest]);
    this.loading.set(false);
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

  kindOf(n: RecordModel) {
    return notifyKind(n['kind']);
  }

  kindName(n: RecordModel): string {
    return NOTIFY_KIND_NAMES[this.i18n.lang()][this.kindOf(n).id];
  }

  isOnline(a: RecordModel): boolean {
    return astroStatus(a).online;
  }

  skills(a: RecordModel): string {
    return ((a['skills'] as string[] | undefined) ?? []).map((k) => SKILL_NAMES[this.i18n.lang()][k] ?? k).slice(0, 2).join(' · ');
  }

  starName(i: number): string {
    return NAKSHATRA_NAMES[this.i18n.lang()][i] ?? '';
  }

  taraName(n: number): string {
    return this.tt().names[n] ?? '';
  }
}
