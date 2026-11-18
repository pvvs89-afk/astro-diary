import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logOutOutline } from 'ionicons/icons';
import { I18nService } from '../i18n/i18n.service';
import { LangButtonComponent } from '../i18n/lang-button.component';
import { money } from '../services/countries';
import { PbService, PlanOffer } from '../services/pb.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardContent,
    IonCardTitle,
    IonCardSubtitle,
    IonList,
    IonItem,
    IonLabel,
    IonSpinner,
    LangButtonComponent,
  ],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit, OnDestroy {
  private pbs = inject(PbService);
  private router = inject(Router);
  private i18n = inject(I18nService);
  readonly t = this.i18n.t;

  name = (this.pbs.user?.['name'] as string | undefined) ?? '';
  readonly plans = signal<PlanOffer[]>([]);
  readonly money = money;
  readonly loading = signal(true);
  /** Whether the customer has saved their own birth details (for My Kundli). */
  readonly hasBirth = signal(true);
  readonly error = signal('');

  constructor() {
    addIcons({ logOutOutline });
  }

  /** Stops the live updates (set while this page is open). */
  private stopWatching: (() => Promise<void>) | null = null;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;

  async ngOnInit(): Promise<void> {
    void this.checkBirth();
    await this.loadPlans();
    // Live: when the admin changes plans or prices, reload them right away.
    try {
      this.stopWatching = await this.pbs.watchPricing(() => this.scheduleReload());
    } catch {
      /* realtime not available - plans still reload each time Home opens */
    }
  }

  /** Coming back to Home (Ionic keeps the page alive): refresh quietly. */
  ionViewWillEnter(): void {
    if (!this.loading()) {
      void this.loadPlans();
      void this.checkBirth();
    }
  }

  private async checkBirth(): Promise<void> {
    try {
      this.hasBirth.set(await this.pbs.hasBirthDetails());
    } catch {
      /* keep showing the kundli buttons */
    }
  }

  newMatch(): void {
    this.router.navigateByUrl('/match-new');
  }

  myMatches(): void {
    this.router.navigateByUrl('/matches');
  }

  ngOnDestroy(): void {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    void this.stopWatching?.();
  }

  /** "Save all" sends several changes at once - reload only once after they settle. */
  private scheduleReload(): void {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => {
      this.name = (this.pbs.user?.['name'] as string | undefined) ?? this.name;
      void this.loadPlans();
    }, 400);
  }

  private async loadPlans(): Promise<void> {
    try {
      this.plans.set(await this.pbs.activePlans());
      this.error.set('');
    } catch (e) {
      this.error.set(this.i18n.err(e));
    } finally {
      this.loading.set(false);
    }
  }

  /** Opens the payment screen for this plan. */
  subscribe(p: PlanOffer): void {
    this.router.navigateByUrl('/payment/' + encodeURIComponent(p.id));
  }

  openKundli(): void {
    this.router.navigateByUrl('/kundli');
  }

  editBirthDetails(): void {
    this.router.navigateByUrl('/birth-details');
  }

  async logout(): Promise<void> {
    this.pbs.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
