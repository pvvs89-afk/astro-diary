import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
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
import { CommService, MAX_MY_ASTROLOGERS, astroStatus } from '../services/comm.service';
import { COMM_TEXT, fill } from './comm-text';

/**
 * All astrologers: every astrologer, with photo, about and online status. The customer
 * adds up to 5 of them to their chats (Message Astrologer); the chief astrologer is
 * always there and doesn't count.
 */
@Component({
  selector: 'app-astrologers',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonMenuButton, IonContent, IonSpinner, LangButtonComponent],
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
        <p class="muted intro">{{ fill(tx().dir_intro, { max: max }) }}</p>
        <div class="tools">
          <span class="count" [class.full]="full()" role="status">{{ fill(tx().dir_count, { n: comm.myAddedCount(), max: max }) }}</span>
          <input type="search" class="search" [placeholder]="tx().astro_search" [attr.aria-label]="tx().astro_search"
                 [value]="search()" (input)="search.set($any($event.target).value)" />
          <button type="button" class="only" [class.on]="onlineOnly()" [attr.aria-pressed]="onlineOnly()" (click)="onlineOnly.set(!onlineOnly())">
            <span class="g" aria-hidden="true"></span>{{ tx().astro_online_only }}
          </button>
        </div>
        @if (full()) { <p class="note-full" role="note">{{ fill(tx().dir_full, { max: max }) }}</p> }
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

        @if (loading()) {
          <div class="center" role="status"><ion-spinner name="crescent" aria-hidden="true"></ion-spinner><span class="sr-only">{{ t('loading') }}</span></div>
        } @else {
          <ul class="grid">
            @for (a of shown(); track a.id) {
              <li class="card" [class.mine]="a['mine']">
                <div class="top">
                  <span class="av-wrap">
                    @if (comm.astroPhoto(a, '300x300')) { <img class="av" [src]="comm.astroPhoto(a, '300x300')" alt="" /> }
                    @else { <span class="av av-empty" aria-hidden="true">{{ (a['name'] || '?').slice(0, 1) }}</span> }
                    @if (online(a)) { <span class="dot" aria-hidden="true"></span> }
                  </span>
                  <span class="body">
                    <b>{{ a['name'] }}</b>
                    @if (a['role'] === 'super') { <small class="chief">{{ tx().astro_chief }}</small> }
                    <small class="state" [class.on]="online(a)">{{ online(a) ? tx().st_online : tx().st_offline }}</small>
                  </span>
                </div>
                @if (a['bio']) { <p class="bio">{{ a['bio'] }}</p> }
                <div class="actions">
                  @if (a['mine']) {
                    <button type="button" class="btn primary" (click)="chat(a)">{{ tx().dir_chat }}</button>
                    @if (a['role'] !== 'super') {
                      <button type="button" class="btn ghost" [disabled]="busy() === a.id" (click)="toggle(a, false)">{{ tx().dir_remove }}</button>
                    }
                  } @else {
                    <button type="button" class="btn add" [disabled]="full() || busy() === a.id" (click)="toggle(a, true)">
                      @if (busy() === a.id) { <ion-spinner name="crescent"></ion-spinner> } @else { + {{ tx().dir_add }} }
                    </button>
                  }
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
  readonly comm = inject(CommService);
  private i18n = inject(I18nService);
  private router = inject(Router);
  readonly t = this.i18n.t;
  readonly tx = computed(() => COMM_TEXT[this.i18n.lang()]);
  readonly fill = fill;
  readonly max = MAX_MY_ASTROLOGERS;
  readonly loading = signal(true);
  readonly busy = signal('');
  readonly error = signal('');
  readonly search = signal('');
  readonly onlineOnly = signal(false);
  readonly full = computed(() => this.comm.myAddedCount() >= this.max);

  /** Chief astrologer first, then the customer's own, then online ones, then by name. */
  readonly shown = computed(() => {
    const q = this.search().trim().toLowerCase();
    const only = this.onlineOnly();
    return [...this.comm.astrologers()]
      .filter((a) => (!q || `${a['name'] ?? ''} ${a['bio'] ?? ''}`.toLowerCase().includes(q)) && (!only || this.online(a)))
      .sort(
        (a, b) =>
          Number(b['role'] === 'super') - Number(a['role'] === 'super') ||
          Number(!!b['mine']) - Number(!!a['mine']) ||
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

  chat(a: RecordModel): void {
    void this.router.navigate(['/messages', a.id]);
  }
}
