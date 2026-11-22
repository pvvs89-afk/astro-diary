import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { RecordModel } from 'pocketbase';
import { I18nService } from '../i18n/i18n.service';
import { LangButtonComponent } from '../i18n/lang-button.component';
import { CommService, astroStatus } from '../services/comm.service';
import { COMM_TEXT, fill } from './comm-text';
import { CallService } from '../call/call.service';
import { ASTRO_LANG_NAMES, SKILL_IDS, SKILL_NAMES, START_TEXT, fillText } from '../start/start-text';
import { addIcons } from 'ionicons';
import { call, chatbubbles, heart, heartOutline, star, videocam } from 'ionicons/icons';
import { IonIcon } from '@ionic/angular';

/**
 * All astrologers: every astrologer with photo, status, rating, price, specialities and
 * languages. Customers can chat with or call anyone; ♡ keeps favourites in their chats.
 */
@Component({
  selector: 'app-astrologers',
  standalone: true,
  imports: [RouterLink, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonMenuButton, IonContent, IonSpinner, IonIcon, LangButtonComponent],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button [attr.aria-label]="t('back')" defaultHref="/messages"></ion-back-button>
          <ion-menu-button [attr.aria-label]="t('menu')"></ion-menu-button>
        </ion-buttons>
        <ion-title>{{ tx().dir_menu }}</ion-title>
        <ion-buttons slot="end"><app-lang-button></app-lang-button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="wrap">
        <p class="muted intro">{{ st().fav_intro }}</p>
        <div class="tools">
          <input type="search" class="search" [placeholder]="tx().astro_search" [attr.aria-label]="tx().astro_search"
                 [value]="search()" (input)="search.set($any($event.target).value)" />
          <button type="button" class="only" [class.on]="onlineOnly()" [attr.aria-pressed]="onlineOnly()" (click)="onlineOnly.set(!onlineOnly())">
            <span class="g" aria-hidden="true"></span>{{ tx().astro_online_only }}
          </button>
          <select class="sel" [value]="skill()" (change)="skill.set($any($event.target).value)" [attr.aria-label]="st().skills">
            <option value="">{{ st().all_skills }}</option>
            @for (k of skillIds; track k) { <option [value]="k" [selected]="k === skill()">{{ skillName(k) }}</option> }
          </select>
          <select class="sel" [value]="lang()" (change)="lang.set($any($event.target).value)" [attr.aria-label]="st().langs">
            <option value="">{{ st().all_langs }}</option>
            @for (l of langIds; track l) { <option [value]="l" [selected]="l === lang()">{{ langNames[l] }}</option> }
          </select>
        </div>
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

        @if (loading()) {
          <div class="center" role="status"><ion-spinner name="crescent" aria-hidden="true"></ion-spinner><span class="sr-only">{{ t('loading') }}</span></div>
        } @else {
          <ul class="grid">
            @for (a of shown(); track a.id) {
              <li class="card" [class.mine]="a['mine']">
                <a class="top" [routerLink]="['/astrologer', a.id]" [attr.aria-label]="st().profile + ': ' + a['name']">
                  <span class="av-wrap">
                    @if (comm.astroPhoto(a, '300x300')) { <img class="av" [src]="comm.astroPhoto(a, '300x300')" alt="" /> }
                    @else { <span class="av av-empty" aria-hidden="true">{{ (a['name'] || '?').slice(0, 1) }}</span> }
                    @if (online(a)) { <span class="dot" aria-hidden="true"></span> }
                  </span>
                  <span class="body">
                    <b>{{ a['name'] }}</b>
                    @if (a['role'] === 'super') { <small class="chief">{{ tx().astro_chief }}</small> }
                    <small class="state" [class.on]="online(a)">{{ online(a) ? tx().st_online : tx().st_offline }}</small>
                    <span class="badges">
                      @if (a['reviews']) { <span class="stars"><ion-icon name="star" aria-hidden="true"></ion-icon> {{ a['rating'] }} <small>({{ a['reviews'] }})</small></span> }
                      @if (a['rate']) { <span class="price">{{ fillText(st().per_min, { n: a['rate'] }) }}</span> }
                    </span>
                  </span>
                </a>
                @if (a['role'] !== 'super') {
                  <button type="button" class="fav" [class.on]="a['mine']" [disabled]="busy() === a.id" (click)="toggle(a, !a['mine'])"
                          [attr.aria-pressed]="!!a['mine']" [attr.aria-label]="(a['mine'] ? st().fav_remove : st().fav_add) + ': ' + a['name']"
                          [title]="a['mine'] ? st().fav_remove : st().fav_add">
                    <ion-icon [name]="a['mine'] ? 'heart' : 'heart-outline'" aria-hidden="true"></ion-icon>
                  </button>
                }
                @if (skillsOf(a)) { <p class="meta">🔮 {{ skillsOf(a) }}</p> }
                @if (langsOf(a) || a['experience']) {
                  <p class="meta">
                    @if (langsOf(a)) { 🗣️ {{ langsOf(a) }} }
                    @if (langsOf(a) && a['experience']) { · }
                    @if (a['experience']) { {{ fillText(st().exp, { n: a['experience'] }) }} }
                  </p>
                }
                @if (a['bio']) { <p class="bio">{{ a['bio'] }}</p> }
                <div class="actions">
                  <button type="button" class="btn primary" (click)="chat(a)"><ion-icon name="chatbubbles" aria-hidden="true"></ion-icon> {{ tx().dir_chat }}</button>
                  <button type="button" class="btn callb" (click)="callNow(a)" [disabled]="calls.state() !== 'idle'" [attr.aria-label]="st().call + ' ' + a['name']" [title]="st().call">
                    <ion-icon name="call" aria-hidden="true"></ion-icon>
                  </button>
                </div>
              </li>
            } @empty {
              <li class="muted">{{ search() || onlineOnly() ? tx().astro_no_match : tx().astro_none }}</li>
            }
          </ul>
        }
      </div>
    </ion-content>
  `,
  styles: [
    `
      .wrap { max-width: 1000px; margin: 0 auto; }
      .intro { margin: 0 0 12px; }
      .tools { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
      .count { font-weight: 600; font-size: 14px; padding: 6px 12px; border-radius: 16px; background: var(--ion-color-light); }
      .count.full { background: #fff6e8; color: #854f0b; }
      .search { flex: 1 1 180px; min-width: 0; height: 36px; padding: 0 14px; border-radius: 18px; border: 1px solid var(--ion-color-step-200, #ccc); font: inherit; font-size: 14px; background: var(--ion-background-color); color: var(--ion-text-color); }
      .only { height: 36px; padding: 0 14px; border-radius: 18px; border: 1px solid var(--ion-color-step-200, #ccc); background: var(--ion-background-color); color: var(--ion-text-color); font: inherit; font-size: 13px; cursor: pointer; display: inline-flex; gap: 6px; align-items: center; }
      .only.on { border-color: var(--ion-color-primary); background: rgba(var(--ion-color-primary-rgb), 0.1); font-weight: 600; }
      .g { width: 8px; height: 8px; border-radius: 50%; background: #1fa855; }
      .note-full { margin: 0 0 10px; padding: 8px 12px; border-radius: 10px; background: #fff6e8; color: #854f0b; font-size: 13px; }
      .error { color: var(--ion-color-danger); }
      .grid { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
      .card { background: var(--ion-color-light); border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 10px; border: 1px solid transparent; }
      .card.mine { border-color: rgba(var(--ion-color-primary-rgb), 0.35); }
      .top { display: flex; gap: 12px; align-items: center; }
      .av-wrap { position: relative; flex: none; }
      .av { width: 60px; height: 60px; border-radius: 50%; object-fit: cover; display: block; }
      .av-empty { display: flex; align-items: center; justify-content: center; background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); font-weight: 700; font-size: 24px; text-transform: uppercase; }
      .dot { position: absolute; right: 2px; bottom: 2px; width: 13px; height: 13px; border-radius: 50%; background: #1fa855; border: 2px solid var(--ion-color-light); }
      .body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .body b { font-size: 16px; }
      .chief { color: var(--ion-color-primary); font-weight: 600; }
      .state { color: var(--ion-color-medium); }
      .state.on { color: #1a8a47; font-weight: 600; }
      .bio { margin: 0; font-size: 14px; color: var(--ion-color-medium-shade); }
      .actions { display: flex; gap: 8px; margin-top: auto; }
      a.top { text-decoration: none; color: inherit; }
      .meta { margin: 0; font-size: 13px; color: var(--ion-color-medium-shade); }
      .card { position: relative; }
      .badges { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 2px; }
      .stars { display: inline-flex; align-items: center; gap: 3px; font-weight: 700; font-size: 13px; color: #b7791f; }
      .stars small { color: var(--ion-color-medium); font-weight: 400; }
      .price { font-weight: 700; font-size: 13px; color: var(--ion-color-primary); }
      .fav { position: absolute; top: 10px; right: 10px; width: 36px; height: 36px; border-radius: 50%; border: 0; cursor: pointer;
        background: var(--ion-background-color, #fff); color: var(--ion-color-medium); font-size: 20px; display: flex; align-items: center; justify-content: center;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12); }
      .fav.on { color: #e24b4a; }
      .fav:disabled { opacity: 0.6; }
      .sel { height: 36px; padding: 0 10px; border-radius: 18px; border: 1px solid var(--ion-color-step-200, #ccc); background: var(--ion-background-color); color: var(--ion-text-color); font: inherit; font-size: 13px; }
      .btn ion-icon { font-size: 17px; margin-right: 4px; }
      .btn.callb { flex: 0 0 auto; width: 38px; padding: 0; border-radius: 50%; background: #1fa855; color: #fff; }
      .btn.callb ion-icon { margin: 0; }
      .btn { flex: 1; height: 38px; border-radius: 19px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; border: 1px solid transparent; display: inline-flex; align-items: center; justify-content: center; }
      .btn.primary { background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); }
      .btn.add { background: transparent; color: var(--ion-color-primary); border-color: var(--ion-color-primary); }
      .btn.ghost { flex: 0 0 auto; padding: 0 16px; background: transparent; color: var(--ion-color-medium-shade); border-color: var(--ion-color-step-250, #bbb); }
      .btn:disabled { opacity: 0.45; cursor: default; }
      .btn ion-spinner { width: 18px; height: 18px; }
      .center { display: flex; justify-content: center; padding: 40px; }
      .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    `,
  ],
})
export class AstrologersPage implements OnInit {
  constructor() {
    addIcons({ call, chatbubbles, heart, heartOutline, star, videocam });
  }

  readonly comm = inject(CommService);
  private i18n = inject(I18nService);
  private router = inject(Router);
  readonly t = this.i18n.t;
  readonly tx = computed(() => COMM_TEXT[this.i18n.lang()]);
  readonly fill = fill;
  readonly loading = signal(true);
  readonly busy = signal('');
  readonly error = signal('');
  readonly search = signal('');
  readonly onlineOnly = signal(false);
  readonly skill = signal('');
  readonly lang = signal('');
  readonly calls = inject(CallService);
  readonly st = computed(() => START_TEXT[this.i18n.lang()]);
  readonly skillIds = SKILL_IDS;
  readonly langIds = Object.keys(ASTRO_LANG_NAMES);
  readonly langNames = ASTRO_LANG_NAMES;
  readonly fillText = fillText;

  /** Chief astrologer first, then the customer's own, then online ones, then by name. */
  readonly shown = computed(() => {
    const q = this.search().trim().toLowerCase();
    const only = this.onlineOnly();
    return [...this.comm.astrologers()]
      .filter((a) => (!q || `${a['name'] ?? ''} ${a['bio'] ?? ''}`.toLowerCase().includes(q)) && (!only || this.online(a)))
      .filter((a) => !this.skill() || ((a['skills'] as string[] | undefined) ?? []).includes(this.skill()))
      .filter((a) => !this.lang() || ((a['languages'] as string[] | undefined) ?? []).includes(this.lang()))
      .sort(
        (a, b) =>
          Number(b['role'] === 'super') - Number(a['role'] === 'super') ||
          Number(!!b['mine']) - Number(!!a['mine']) ||
          Number(b['rating'] || 0) - Number(a['rating'] || 0) ||
          Number(this.online(b)) - Number(this.online(a)) ||
          String(a['name'] ?? '').localeCompare(String(b['name'] ?? '')),
      );
  });

  async ngOnInit(): Promise<void> {
    this.comm.startPresence();
    await this.comm.loadAstrologers();
    this.loading.set(false);
  }

  online(a: RecordModel): boolean {
    return astroStatus(a).online;
  }

  async toggle(a: RecordModel, add: boolean): Promise<void> {
    this.error.set('');
    this.busy.set(a.id);
    try {
      await this.comm.setMine(a.id, add);
    } catch (e) {
      this.error.set(this.i18n.err(e));
    } finally {
      this.busy.set('');
    }
  }

  skillName(k: string): string {
    return SKILL_NAMES[this.i18n.lang()][k] ?? k;
  }

  skillsOf(a: RecordModel): string {
    return ((a['skills'] as string[] | undefined) ?? []).map((k) => this.skillName(k)).join(', ');
  }

  langsOf(a: RecordModel): string {
    return ((a['languages'] as string[] | undefined) ?? []).map((l) => ASTRO_LANG_NAMES[l] ?? l).join(', ');
  }

  callNow(a: RecordModel): void {
    void this.calls.call('audio', a.id);
  }

  chat(a: RecordModel): void {
    void this.router.navigate(['/messages', a.id]);
  }
}
