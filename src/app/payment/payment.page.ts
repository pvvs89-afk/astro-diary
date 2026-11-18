import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmarkCircle, closeCircle, lockClosedOutline, informationCircleOutline } from 'ionicons/icons';
import { I18nService } from '../i18n/i18n.service';
import { LangButtonComponent } from '../i18n/lang-button.component';
import { money } from '../services/countries';
import { PaymentService } from '../services/payment.service';
import { PbService, PlanOffer } from '../services/pb.service';

type Step = 'review' | 'paying' | 'success' | 'failed' | 'not_ready';

/** Checkout for one plan: summary -> pay -> result. Opened from the plan list on Home. */
@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonContent, IonIcon, IonSpinner, LangButtonComponent],
  templateUrl: './payment.page.html',
  styleUrls: ['./payment.page.scss'],
})
export class PaymentPage implements OnInit {
  private pbs = inject(PbService);
  private payments = inject(PaymentService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private i18n = inject(I18nService);
  readonly t = this.i18n.t;
  readonly money = money;

  readonly plan = signal<PlanOffer | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly step = signal<Step>('review');
  readonly failMessage = signal('');
  readonly note = signal('');

  readonly user = this.pbs.user;
  readonly name = (this.user?.['name'] as string) || '';
  readonly email = (this.user?.['email'] as string) || '';
  readonly phone = (this.user?.['phone'] as string) || '';

  readonly price = computed(() => {
    const p = this.plan();
    return p ? money(p.price, p.currency) : '';
  });

  constructor() {
    addIcons({ checkmarkCircle, closeCircle, lockClosedOutline, informationCircleOutline });
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('planId') ?? '';
    try {
      // Price comes from the server for this customer's country - never from the URL.
      const plans = await this.pbs.activePlans();
      this.plan.set(plans.find((p) => p.id === id) ?? null);
      if (!this.plan()) this.error.set(this.t('plan_not_found'));
    } catch (e) {
      this.error.set(this.i18n.err(e));
    } finally {
      this.loading.set(false);
    }
  }

  async pay(): Promise<void> {
    const p = this.plan();
    if (!p || this.step() === 'paying') return;
    this.note.set('');
    this.step.set('paying');
    try {
      const r = await this.payments.pay(p);
      switch (r.status) {
        case 'success':
          this.step.set('success');
          break;
        case 'cancelled':
          this.step.set('review');
          this.note.set(this.t('payment_cancelled'));
          break;
        case 'not_ready':
          this.step.set('not_ready');
          break;
        default:
          this.failMessage.set(r.message);
          this.step.set('failed');
      }
    } catch (e) {
      this.failMessage.set(this.i18n.err(e));
      this.step.set('failed');
    }
  }

  retry(): void {
    this.failMessage.set('');
    this.step.set('review');
  }

  goHome(): void {
    this.router.navigateByUrl('/home', { replaceUrl: true });
  }
}
