import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonMenuButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { RecordModel } from 'pocketbase';
import { I18nService } from '../i18n/i18n.service';
import { LangButtonComponent } from '../i18n/lang-button.component';
import { PbService } from '../services/pb.service';

/** The customer's saved match reports. */
@Component({
  selector: 'app-matches',
  standalone: true,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonMenuButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonSpinner,
    LangButtonComponent,
  ],
  templateUrl: './matches.page.html',
  styleUrls: ['./matches.page.scss'],
})
export class MatchesPage {
  private pbs = inject(PbService);
  private router = inject(Router);
  private i18n = inject(I18nService);
  readonly t = this.i18n.t;

  readonly matches = signal<RecordModel[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  /** Reload every time the page is shown (e.g. after deleting a match). */
  async ionViewWillEnter(): Promise<void> {
    try {
      this.matches.set(await this.pbs.listMatches());
      this.error.set('');
    } catch (e) {
      this.error.set(this.i18n.err(e));
    } finally {
      this.loading.set(false);
    }
  }

  dateText(v: unknown): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? ''));
    return m ? `${Number(m[3])} ${this.i18n.months()[Number(m[2]) - 1]} ${m[1]}` : '';
  }

  open(id: string): void {
    this.router.navigate(['/match', id]);
  }

  newMatch(): void {
    this.router.navigateByUrl('/match-new');
  }
}
