import { Component, OnInit, inject, signal } from '@angular/core';
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
  ToastController,
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
export class HomePage implements OnInit {
  private pbs = inject(PbService);
  private router = inject(Router);
  private toast = inject(ToastController);
  private i18n = inject(I18nService);
  readonly t = this.i18n.t;

  name = (this.pbs.user?.['name'] as string | undefined) ?? '';
  readonly plans = signal<PlanOffer[]>([]);
  readonly money = money;
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    addIcons({ logOutOutline });
  }

  async ngOnInit(): Promise<void> {
    try {
      this.plans.set(await this.pbs.activePlans());
    } catch (e) {
      this.error.set(this.i18n.err(e));
    } finally {
      this.loading.set(false);
    }
  }

  async subscribe(): Promise<void> {
    const t = await this.toast.create({
      message: this.t('payments_soon'),
      duration: 2000,
      position: 'bottom',
    });
    await t.present();
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
