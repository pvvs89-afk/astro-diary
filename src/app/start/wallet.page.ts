import { Component, computed, inject } from '@angular/core';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { receiptOutline, wallet } from 'ionicons/icons';
import { I18nService } from '../i18n/i18n.service';
import { LangButtonComponent } from '../i18n/lang-button.component';
import { START_TEXT, fillText } from './start-text';

/** Recharge packs: amount (₹) and bonus %. */
const PACKS = [
  { amount: 100, extra: 0 },
  { amount: 200, extra: 0 },
  { amount: 500, extra: 5 },
  { amount: 1000, extra: 10 },
  { amount: 2000, extra: 15 },
  { amount: 5000, extra: 20 },
];

/**
 * Wallet - DESIGN MOCKUP. Shows how the wallet will look (balance, recharge packs,
 * transactions). Nothing is charged: payments are switched on later with Razorpay,
 * when chats and calls will also be billed per minute from this balance.
 */
@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonMenuButton, IonContent, IonIcon, LangButtonComponent],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button [attr.aria-label]="t('back')" defaultHref="/main"></ion-back-button>
          <ion-menu-button [attr.aria-label]="t('menu')"></ion-menu-button>
        </ion-buttons>
        <ion-title>{{ st().wallet }}</ion-title>
        <ion-buttons slot="end"><app-lang-button></app-lang-button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="wrap">
        <section class="bal" aria-labelledby="bal-h">
          <ion-icon name="wallet" aria-hidden="true"></ion-icon>
          <div>
            <small id="bal-h">{{ st().balance }}</small>
            <b>₹0</b>
          </div>
        </section>
        <p class="soon" role="note">{{ st().coming_soon }}</p>

        <h3>{{ st().add_money }}</h3>
        <ul class="packs">
          @for (p of packs; track p.amount) {
            <li>
              <button type="button" class="pack" (click)="soon()">
                <b>₹{{ p.amount }}</b>
                @if (p.extra) { <span class="extra">{{ fill(st().extra, { n: p.extra }) }}</span> }
              </button>
            </li>
          }
        </ul>
        <p class="muted small">{{ st().wallet_note }}</p>

        <h3>{{ st().history }}</h3>
        <p class="empty"><ion-icon name="receipt-outline" aria-hidden="true"></ion-icon> {{ st().no_history }}</p>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .wrap { max-width: 640px; margin: 0 auto; }
      .bal { display: flex; align-items: center; gap: 14px; padding: 18px; border-radius: 18px; color: var(--ion-color-primary-contrast);
        background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade)); }
      .bal ion-icon { font-size: 36px; }
      .bal div { display: flex; flex-direction: column; }
      .bal small { opacity: 0.85; }
      .bal b { font-size: 30px; }
      .soon { margin: 12px 0 0; padding: 10px 12px; border-radius: 10px; background: #fff6e8; color: #854f0b; font-size: 13px; }
      h3 { margin: 20px 0 10px; font-size: 16px; }
      .packs { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
      .pack { width: 100%; min-height: 72px; border-radius: 14px; border: 1px solid rgba(var(--ion-color-primary-rgb), 0.3); cursor: pointer;
        background: var(--ion-background-color); color: var(--ion-text-color); font: inherit; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
      .pack b { font-size: 18px; }
      .extra { font-size: 11px; font-weight: 700; color: #0f7a4d; background: #e1f5ee; padding: 2px 8px; border-radius: 10px; }
      .muted { color: var(--ion-color-medium); }
      .small { font-size: 13px; }
      .empty { display: flex; align-items: center; gap: 8px; color: var(--ion-color-medium); }
    `,
  ],
})
export class WalletPage {
  private i18n = inject(I18nService);
  private toasts = inject(ToastController);
  readonly t = this.i18n.t;
  readonly st = computed(() => START_TEXT[this.i18n.lang()]);
  readonly fill = fillText;
  readonly packs = PACKS;

  constructor() {
    addIcons({ receiptOutline, wallet });
  }

  async soon(): Promise<void> {
    const toast = await this.toasts.create({ message: this.st().coming_soon, duration: 3500, position: 'bottom' });
    await toast.present();
  }
}
