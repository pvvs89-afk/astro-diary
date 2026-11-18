import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { RecordModel } from 'pocketbase';
import { I18nService } from '../i18n/i18n.service';
import { LangButtonComponent } from '../i18n/lang-button.component';
import { MatchMethod, PbService } from '../services/pb.service';
import { PersonFormComponent } from '../shared/person-form.component';

/** Match making form: method + boy's and girl's birth details (any two people). */
@Component({
  selector: 'app-match-new',
  standalone: true,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonContent,
    IonSpinner,
    LangButtonComponent,
    PersonFormComponent,
  ],
  templateUrl: './match-new.page.html',
  styleUrls: ['./match-new.page.scss'],
})
export class MatchNewPage implements OnInit {
  private pbs = inject(PbService);
  private router = inject(Router);
  private toast = inject(ToastController);
  private i18n = inject(I18nService);
  readonly t = this.i18n.t;

  /** South Indian languages default to Porutham, others to Ashta Koota. */
  readonly method = signal<MatchMethod>(['ta', 'te', 'ml'].includes(this.i18n.lang()) ? 'porutham' : 'ashta_koota');
  readonly system = signal<'tamil' | 'kerala'>(this.i18n.lang() === 'ml' ? 'kerala' : 'tamil');
  readonly busy = signal(false);
  /** The customer's own saved birth details (for the "use my details" button). */
  readonly mine = signal<RecordModel | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.mine.set(await this.pbs.latestBirthDetails());
    } catch {
      /* not needed */
    }
  }

  mineLabel(): string {
    const name = (this.mine()?.['full_name'] as string) || '';
    return name ? `${this.t('my_kundli')}: ${name}` : this.t('my_kundli');
  }

  /** Fills a person form with the customer's own saved birth details. */
  useMine(form: PersonFormComponent): void {
    const b = this.mine();
    if (!b) return;
    const lat = Number(b['latitude']);
    const lon = Number(b['longitude']);
    form.fill({
      name: String(b['full_name'] ?? ''),
      dob: String(b['dob'] ?? '').slice(0, 10),
      time: String(b['birth_time'] ?? ''),
      place: b['birth_place'] && (lat || lon) ? { name: String(b['birth_place']), lat, lon } : null,
    });
  }

  async submit(boyForm: PersonFormComponent, girlForm: PersonFormComponent): Promise<void> {
    const boyProblem = boyForm.problem();
    if (boyProblem) return this.show(`${this.t('boy')}: ${this.t(boyProblem)}`);
    const girlProblem = girlForm.problem();
    if (girlProblem) return this.show(`${this.t('girl')}: ${this.t(girlProblem)}`);

    this.busy.set(true);
    try {
      const rec = await this.pbs.createMatch(
        this.method(),
        this.i18n.lang(),
        boyForm.value(),
        girlForm.value(),
        this.system(),
      );
      await this.router.navigate(['/match', rec.id], { replaceUrl: true });
    } catch (e) {
      await this.show(this.i18n.err(e));
    } finally {
      this.busy.set(false);
    }
  }

  cancel(): void {
    this.router.navigateByUrl('/home');
  }

  private async show(message: string): Promise<void> {
    const t = await this.toast.create({ message, duration: 3000, position: 'bottom' });
    await t.present();
  }
}
