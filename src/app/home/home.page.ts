import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonCard,
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
import { RecordModel } from 'pocketbase';
import { PbService, errorText } from '../services/pb.service';

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
    IonCardTitle,
    IonCardSubtitle,
    IonList,
    IonItem,
    IonLabel,
    IonSpinner,
  ],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {
  private pbs = inject(PbService);
  private router = inject(Router);
  private toast = inject(ToastController);

  name = (this.pbs.user?.['name'] as string | undefined) ?? '';
  readonly plans = signal<RecordModel[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    addIcons({ logOutOutline });
  }

  async ngOnInit(): Promise<void> {
    try {
      this.plans.set(await this.pbs.activePlans());
    } catch (e) {
      this.error.set(errorText(e));
    } finally {
      this.loading.set(false);
    }
  }

  async subscribe(): Promise<void> {
    const t = await this.toast.create({
      message: 'Payments coming soon',
      duration: 2000,
      position: 'bottom',
    });
    await t.present();
  }

  async logout(): Promise<void> {
    this.pbs.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
