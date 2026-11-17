import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmarkCircle, locationOutline, searchOutline } from 'ionicons/icons';
import { I18nService } from '../i18n/i18n.service';
import { LangButtonComponent } from '../i18n/lang-button.component';
import { PbService, Place } from '../services/pb.service';

@Component({
  selector: 'app-birth-details',
  standalone: true,
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonButtons,
    IonSpinner,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    LangButtonComponent,
  ],
  templateUrl: './birth-details.page.html',
  styleUrls: ['./birth-details.page.scss'],
})
export class BirthDetailsPage {
  private pbs = inject(PbService);
  private router = inject(Router);
  private toast = inject(ToastController);
  private i18n = inject(I18nService);
  readonly t = this.i18n.t;

  readonly busy = signal(false);

  fullName = (this.pbs.user?.['name'] as string | undefined) ?? '';
  gender = '';

  // Birth date and time as dropdowns, like the Prokerala kundli form:
  // Year / Month / Day and Hour (12-hour) / Minute / AM-PM.
  readonly years = Array.from({ length: new Date().getFullYear() - 1900 }, (_, i) =>
    String(new Date().getFullYear() - i),
  );
  /** Month names follow the chosen language. */
  readonly months = computed(() =>
    this.i18n.months().map((label, i) => ({ value: String(i + 1).padStart(2, '0'), label })),
  );
  readonly days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
  readonly hours = ['12', ...Array.from({ length: 11 }, (_, i) => String(i + 1).padStart(2, '0'))];
  readonly minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  year = '';
  month = '';
  day = '';
  hour = '';
  minute = '';
  ampm = 'AM';

  /** Selected date as YYYY-MM-DD, or '' if incomplete / not a real date. */
  private get dob(): string {
    if (!this.year || !this.month || !this.day) return '';
    const y = Number(this.year);
    const m = Number(this.month);
    const d = Number(this.day);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return ''; // e.g. 31 Feb
    return `${this.year}-${this.month}-${this.day}`;
  }

  /** Selected time as 24-hour HH:mm, or '' if incomplete. */
  private get time(): string {
    if (!this.hour || !this.minute) return '';
    let h = Number(this.hour) % 12; // 12 AM -> 0
    if (this.ampm === 'PM') h += 12; // 12 PM -> 12, 01 PM -> 13
    return `${String(h).padStart(2, '0')}:${this.minute}`;
  }

  // Birth place typeahead (any country)
  placeQuery = '';
  readonly searching = signal(false);
  /** Suggestions under the box; null = list closed. */
  readonly places = signal<Place[] | null>(null);
  readonly selectedPlace = signal<Place | null>(null);
  /** Increases on every keystroke so slow, older answers are ignored. */
  private searchSeq = 0;

  constructor() {
    addIcons({ searchOutline, locationOutline, checkmarkCircle });
  }

  /** Called (debounced) while the user types in the birth place box. */
  async onPlaceInput(value: string | null | undefined): Promise<void> {
    this.placeQuery = value ?? '';
    const q = this.placeQuery.trim();
    const seq = ++this.searchSeq;

    // Typing again after picking a place means they want a different one.
    if (this.selectedPlace() && q !== this.selectedPlace()!.name) this.selectedPlace.set(null);
    if (this.selectedPlace()) return;

    if (q.length < 3) {
      this.places.set(null);
      this.searching.set(false);
      return;
    }
    this.searching.set(true);
    try {
      const items = await this.pbs.searchPlaces(q);
      if (seq !== this.searchSeq) return;
      this.places.set(items);
    } catch (e) {
      if (seq === this.searchSeq) await this.show(this.i18n.err(e));
    } finally {
      if (seq === this.searchSeq) this.searching.set(false);
    }
  }

  /** Enter in the box picks the top suggestion. */
  pickFirst(): void {
    const first = this.places()?.[0];
    if (first) this.choosePlace(first);
  }

  choosePlace(p: Place): void {
    this.searchSeq++; // drop any search still running
    this.searching.set(false);
    this.selectedPlace.set(p);
    this.placeQuery = p.name;
    this.places.set(null);
  }

  private validate(): string | null {
    if (!this.fullName.trim()) return this.t('err_full_name');
    if (!this.gender) return this.t('err_gender');
    if (!this.year || !this.month || !this.day) return this.t('err_date');
    if (!this.dob) return this.t('err_bad_date');
    if (this.dob > new Date().toISOString().slice(0, 10)) return this.t('err_future');
    if (!this.hour || !this.minute) return this.t('err_time');
    if (!this.selectedPlace()) return this.t('err_place');
    return null;
  }

  async save(): Promise<void> {
    const problem = this.validate();
    if (problem) {
      await this.show(problem);
      return;
    }
    this.busy.set(true);
    try {
      await this.pbs.saveBirthDetails({
        fullName: this.fullName.trim(),
        gender: this.gender,
        dob: this.dob,
        time: this.time,
        place: this.selectedPlace()!,
      });
      await this.router.navigateByUrl('/kundli', { replaceUrl: true });
    } catch (e) {
      await this.show(this.i18n.err(e));
    } finally {
      this.busy.set(false);
    }
  }

  private async show(message: string): Promise<void> {
    const t = await this.toast.create({ message, duration: 3000, position: 'bottom' });
    await t.present();
  }
}
