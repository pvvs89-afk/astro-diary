import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { call, chatbubbles, heart, heartOutline, star, starOutline, videocam } from 'ionicons/icons';
import { RecordModel } from 'pocketbase';
import { CallService } from '../call/call.service';
import { I18nService } from '../i18n/i18n.service';
import { LangButtonComponent } from '../i18n/lang-button.component';
import { CommService, ReviewSummary, astroStatus } from '../services/comm.service';
import { ASTRO_LANG_NAMES, SKILL_NAMES, START_TEXT, fillText } from '../start/start-text';
import { COMM_TEXT } from './comm-text';

/** One astrologer: photo, status, rating, price, specialities, languages, about, reviews; chat / call / favourite. */
@Component({
  selector: 'app-astrologer',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonSpinner, IonIcon, LangButtonComponent],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start"><ion-back-button [attr.aria-label]="t('back')" defaultHref="/astrologers"></ion-back-button></ion-buttons>
        <ion-title>{{ a()?.['name'] || st().profile }}</ion-title>
        <ion-buttons slot="end"><app-lang-button></app-lang-button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="wrap">
        @if (loading()) {
          <div class="center" role="status"><ion-spinner name="crescent" aria-hidden="true"></ion-spinner></div>
        } @else if (a(); as x) {
          <section class="hero">
            <span class="av-wrap">
              @if (comm.astroPhoto(x, '300x300')) { <img class="av" [src]="comm.astroPhoto(x, '300x300')" alt="" /> }
              @else { <span class="av av-empty" aria-hidden="true">{{ (x['name'] || '?').slice(0, 1) }}</span> }
              @if (online()) { <span class="dot" aria-hidden="true"></span> }
            </span>
            <h2>{{ x['name'] }}</h2>
            @if (x['role'] === 'super') { <p class="chief">{{ ct().astro_chief }}</p> }
            <p class="state" [class.on]="online()">{{ online() ? ct().st_online : ct().st_offline }}</p>
            <p class="facts">
              @if (rev()?.count) { <span class="stars"><ion-icon name="star" aria-hidden="true"></ion-icon> {{ rev()!.rating }} · {{ fill(st().reviews_n, { n: rev()!.count }) }}</span> }
              @if (x['experience']) { <span>{{ fill(st().exp, { n: x['experience'] }) }}</span> }
              @if (x['rate']) { <span class="price">{{ fill(st().per_min, { n: x['rate'] }) }}</span> }
            </p>
            @if (x['role'] !== 'super') {
              <button type="button" class="fav" [class.on]="x['mine']" [disabled]="busy()" (click)="toggleFav()" [attr.aria-pressed]="!!x['mine']">
                <ion-icon [name]="x['mine'] ? 'heart' : 'heart-outline'" aria-hidden="true"></ion-icon>
                {{ x['mine'] ? st().fav_remove : st().fav_add }}
              </button>
            }
          </section>

          <div class="actions">
            <button type="button" class="btn chat" (click)="chat()"><ion-icon name="chatbubbles" aria-hidden="true"></ion-icon> {{ st().chat }}</button>
            <button type="button" class="btn audio" (click)="callNow('audio')" [disabled]="calls.state() !== 'idle'"><ion-icon name="call" aria-hidden="true"></ion-icon> {{ st().call }}</button>
            <button type="button" class="btn video" (click)="callNow('video')" [disabled]="calls.state() !== 'idle'"><ion-icon name="videocam" aria-hidden="true"></ion-icon> {{ st().video }}</button>
          </div>
          @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

          @if (skills()) {
            <section class="block"><h3>{{ st().skills }}</h3><ul class="chips">@for (s of skillList(); track s) { <li>{{ s }}</li> }</ul></section>
          }
          @if (langs()) {
            <section class="block"><h3>{{ st().langs }}</h3><ul class="chips">@for (l of langList(); track l) { <li>{{ l }}</li> }</ul></section>
          }
          @if (x['bio']) {
            <section class="block"><h3>{{ st().about }}</h3><p class="bio">{{ x['bio'] }}</p></section>
          }

          <!-- Reviews -->
          <section class="block">
            <h3>{{ st().reviews }} @if (rev()?.count) { <small class="muted">({{ rev()!.count }})</small> }</h3>
            <form class="rate" (submit)="$event.preventDefault(); saveReview()">
              <span class="lbl">{{ st().your_rating }}</span>
              <span class="pick" role="radiogroup" [attr.aria-label]="st().your_rating">
                @for (n of [1, 2, 3, 4, 5]; track n) {
                  <button type="button" role="radio" [attr.aria-checked]="myStars() === n" [attr.aria-label]="n + ' ★'" (click)="myStars.set(n)">
                    <ion-icon [name]="n <= myStars() ? 'star' : 'star-outline'" aria-hidden="true"></ion-icon>
                  </button>
                }
              </span>
              <textarea rows="2" maxlength="500" [placeholder]="st().comment_ph" [value]="myComment()" (input)="myComment.set($any($event.target).value)"></textarea>
              <div class="rate-actions">
                <button type="submit" class="btn chat small" [disabled]="saving()">{{ rev()?.mine ? st().update_review : st().submit_review }}</button>
                @if (rev()?.mine) { <button type="button" class="linkbtn" (click)="removeReview()">{{ st().delete_review }}</button> }
              </div>
              @if (rateMsg()) { <p class="hint" role="status">{{ rateMsg() }}</p> }
            </form>
            <ul class="reviews">
              @for (r of rev()?.items ?? []; track $index) {
                <li>
                  <span class="r-top"><b>{{ r.name }}</b> <span class="r-stars" [attr.aria-label]="r.rating + ' / 5'">{{ starsText(r.rating) }}</span></span>
                  @if (r.comment) { <p>{{ r.comment }}</p> }
                  <small class="muted">{{ when(r.created) }}</small>
                </li>
              } @empty {
                <li class="muted">{{ st().no_reviews }}</li>
              }
            </ul>
          </section>
        } @else {
          <p class="muted">{{ st().not_found }}</p>
        }
      </div>
    </ion-content>
  `,
  styles: [
    `
      .wrap { max-width: 640px; margin: 0 auto; }
      .hero { text-align: center; padding: 8px 0 4px; }
      .av-wrap { position: relative; display: inline-block; }
      .av { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; display: block; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15); }
      .av-empty { display: flex; align-items: center; justify-content: center; background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); font-weight: 700; font-size: 48px; text-transform: uppercase; }
      .dot { position: absolute; right: 8px; bottom: 8px; width: 20px; height: 20px; border-radius: 50%; background: #1fa855; border: 3px solid var(--ion-background-color, #fff); }
      h2 { margin: 12px 0 2px; }
      .chief { margin: 0; color: var(--ion-color-primary); font-weight: 700; font-size: 14px; }
      .state { margin: 4px 0 0; color: var(--ion-color-medium); font-size: 14px; }
      .state.on { color: #1a8a47; font-weight: 600; }
      .facts { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin: 6px 0 0; font-size: 14px; }
      .facts .stars { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; color: #b7791f; }
      .facts .price { font-weight: 700; color: var(--ion-color-primary); }
      .fav { margin-top: 10px; display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; border-radius: 17px; cursor: pointer;
        border: 1px solid var(--ion-color-step-200, #ccc); background: var(--ion-background-color); color: var(--ion-text-color); font: inherit; font-size: 13px; font-weight: 600; }
      .fav ion-icon { font-size: 18px; color: var(--ion-color-medium); }
      .fav.on ion-icon { color: #e24b4a; }
      .rate { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 12px; background: var(--ion-color-light); margin-bottom: 12px; }
      .lbl { font-size: 13px; font-weight: 600; }
      .pick { display: flex; gap: 4px; }
      .pick button { border: 0; background: none; padding: 2px; font-size: 28px; color: #e0a100; cursor: pointer; line-height: 1; }
      .rate textarea { padding: 8px 10px; border-radius: 8px; border: 1px solid var(--ion-color-step-200, #ccc); font: inherit; font-size: 14px; resize: vertical; background: var(--ion-background-color); color: var(--ion-text-color); }
      .rate-actions { display: flex; gap: 12px; align-items: center; }
      .btn.small { height: 36px; font-size: 14px; }
      .linkbtn { border: 0; background: none; color: var(--ion-color-danger); cursor: pointer; font: inherit; font-size: 13px; text-decoration: underline; }
      .reviews { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
      .reviews li { padding: 10px 0; border-bottom: 1px solid var(--ion-color-step-100, #eee); }
      .reviews p { margin: 4px 0; white-space: pre-wrap; }
      .r-top { display: flex; gap: 8px; align-items: center; }
      .r-stars { color: #e0a100; letter-spacing: 1px; }
      .actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin: 16px 0 8px; }
      .btn { height: 44px; padding: 0 18px; border-radius: 22px; border: 0; font: inherit; font-weight: 700; font-size: 15px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; color: #fff; }
      .btn ion-icon { font-size: 18px; }
      .btn.chat { background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); }
      .btn.audio { background: #1fa855; }
      .btn.video { background: #185fa5; }
      .btn:disabled { opacity: 0.5; cursor: default; }
      .hint { width: 100%; text-align: center; margin: 0; font-size: 14px; color: var(--ion-color-medium-shade); }
      .hint.warn { color: #854f0b; }
      .block { margin-top: 18px; }
      .block h3 { margin: 0 0 8px; font-size: 15px; }
      .chips { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 8px; }
      .chips li { padding: 5px 12px; border-radius: 14px; background: rgba(var(--ion-color-primary-rgb), 0.1); color: var(--ion-color-primary); font-size: 13px; font-weight: 600; }
      .bio { margin: 0; white-space: pre-wrap; line-height: 1.5; }
      .error { color: var(--ion-color-danger); text-align: center; }
      .muted { color: var(--ion-color-medium); }
      .center { display: flex; justify-content: center; padding: 40px; }
    `,
  ],
})
export class AstrologerPage implements OnInit {
  readonly comm = inject(CommService);
  readonly calls = inject(CallService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private i18n = inject(I18nService);
  readonly t = this.i18n.t;
  readonly st = computed(() => START_TEXT[this.i18n.lang()]);
  readonly ct = computed(() => COMM_TEXT[this.i18n.lang()]);
  readonly fill = fillText;
  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');

  readonly a = computed<RecordModel | null>(() => this.comm.astrologers().find((x) => x.id === this.id) ?? null);
  readonly online = computed(() => astroStatus(this.a()).online);
  readonly rev = signal<ReviewSummary | null>(null);
  readonly myStars = signal(0);
  readonly myComment = signal('');
  readonly saving = signal(false);
  readonly rateMsg = signal('');
  readonly skillList = computed(() =>
    ((this.a()?.['skills'] as string[] | undefined) ?? []).map((k) => SKILL_NAMES[this.i18n.lang()][k] ?? k),
  );
  readonly langList = computed(() => ((this.a()?.['languages'] as string[] | undefined) ?? []).map((l) => ASTRO_LANG_NAMES[l] ?? l));
  readonly skills = computed(() => this.skillList().length > 0);
  readonly langs = computed(() => this.langList().length > 0);

  constructor() {
    addIcons({ call, chatbubbles, heart, heartOutline, star, starOutline, videocam });
  }

  async ngOnInit(): Promise<void> {
    this.comm.startPresence();
    if (!this.a()) await this.comm.loadAstrologers();
    this.loading.set(false);
    await this.loadReviews();
  }

  private async loadReviews(): Promise<void> {
    try {
      const r = await this.comm.reviews(this.id);
      this.rev.set(r);
      if (r.mine) {
        this.myStars.set(r.mine.rating);
        this.myComment.set(r.mine.comment ?? '');
      }
    } catch {
      /* no reviews shown */
    }
  }

  async saveReview(): Promise<void> {
    this.rateMsg.set('');
    if (!this.myStars()) {
      this.rateMsg.set(this.st().choose_stars);
      return;
    }
    this.saving.set(true);
    try {
      await this.comm.saveReview(this.id, this.myStars(), this.myComment().trim());
      this.rateMsg.set(this.st().thanks);
      await this.loadReviews();
    } catch (e) {
      const code = (e as { response?: { code?: string } })?.response?.code;
      this.rateMsg.set(code === 'need_chat' ? this.st().need_chat : this.i18n.err(e));
    } finally {
      this.saving.set(false);
    }
  }

  async removeReview(): Promise<void> {
    try {
      await this.comm.deleteReview(this.id);
      this.myStars.set(0);
      this.myComment.set('');
      this.rateMsg.set('');
      await this.loadReviews();
    } catch (e) {
      this.rateMsg.set(this.i18n.err(e));
    }
  }

  async toggleFav(): Promise<void> {
    const x = this.a();
    if (!x) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.comm.setMine(this.id, !x['mine']);
    } catch (e) {
      this.error.set(this.i18n.err(e));
    } finally {
      this.busy.set(false);
    }
  }

  starsText(n: number): string {
    return '★'.repeat(Math.max(0, Math.min(5, n))) + '☆'.repeat(5 - Math.max(0, Math.min(5, n)));
  }

  when(v: string): string {
    const d = new Date(String(v).replace(' ', 'T'));
    return isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat(`${this.i18n.lang()}-IN`, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  }

  chat(): void {
    void this.router.navigate(['/messages', this.id]);
  }

  callNow(kind: 'audio' | 'video'): void {
    void this.calls.call(kind, this.id);
  }


}
