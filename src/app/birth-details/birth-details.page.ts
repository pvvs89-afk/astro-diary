import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
import { arrowBackOutline, checkmarkCircle, locationOutline, searchOutline } from 'ionicons/icons';
import { RecordModel } from 'pocketbase';
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
export class BirthDetailsPage implements OnInit {
  private pbs = inject(PbService);
  private router = inject(Router);
  private toast = inject(ToastController);
  private i18n = inject(I18nService);
  readonly t = this.i18n.t;

  readonly busy = signal(false);
  /** Spinner until the saved details are loaded into the form. */
  readonly loading = signal(true);
  /** Saved details being edited (null = first time, nothing to go back to). */
  readonly existing = signal<RecordModel | null>(null);

  fullName = (this.pbs.user?.['name'] as string | undefined) ?? '';
  gender = '';

  // Birth date and time as dropdowns, like the Prokerala kundli form:
  // Year / Month / Day and Hour (24-hour) / Minute.
  readonly years = Array.from({ length: new Date().getFullYear() - 1900 }, (_, i) =>
    String(new Date().getFullYear() - i),
  );
  /** Month names follow the chosen language. */
  readonly months = computed(() =>
    this.i18n.months().map((label, i) => ({ value: String(i + 1).padStart(2, '0'), label })),
  );
  readonly days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
  readonly hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')); // 24-hour: 00 - 23
  readonly minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  year = '';
  month = '';
  day = '';
  hour = '';
  minute = '';

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
    return `${this.hour}:${this.minute}`;
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
    addIcons({ searchOutline, locationOutline, checkmarkCircle, arrowBackOutline });
  }

  /**
   * When changing details, start from what is already saved. First time (new
   * customer): start with today's date, the current time and the current place
   * (the phone asks for location once; if refused, the place stays empty).
   * The page shows a spinner until all of this is in.
   */
  async ngOnInit(): Promise<void> {
    let b: RecordModel | null = null;
    try {
      b = await this.pbs.latestBirthDetails();
    } catch {
      /* offline - the form just starts empty */
    }
    if (b) {
      this.fill(b);
    } else {
      this.setNow();
      try {
        const p = await this.pbs.currentPlace();
        if (p && !this.selectedPlace() && !this.placeQuery.trim()) this.choosePlace(p);
      } catch {
        /* no location - typed by the customer */
      }
    }
    this.loading.set(false);
  }

  /** Today's date and the current time from this phone. */
  private setNow(): void {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    this.year = String(d.getFullYear());
    this.month = pad(d.getMonth() + 1);
    this.day = pad(d.getDate());
    const h = d.getHours();
    this.hour = pad(h);
    this.minute = pad(d.getMinutes());
  }

  private fill(b: RecordModel): void {
    this.existing.set(b);
    this.fullName = (b['full_name'] as string) || this.fullName;
    this.gender = (b['gender'] as string) || '';
    const dob = String(b['dob'] ?? '').slice(0, 10); // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) [this.year, this.month, this.day] = dob.split('-');
    const m = /^(\d{2}):(\d{2})$/.exec(String(b['birth_time'] ?? ''));
    if (m) {
      this.hour = m[1];
      this.minute = m[2];
    }
    const lat = Number(b['latitude']);
    const lon = Number(b['longitude']);
    if (b['birth_place'] && (lat || lon)) {
      this.choosePlace({ name: String(b['birth_place']), lat, lon });
    } else {
      this.placeQuery = String(b['birth_place'] ?? '');
    }
  }

  /** True when nothing differs from the saved details (no need to save again). */
  private unchanged(): boolean {
    const b = this.existing();
    const p = this.selectedPlace();
    if (!b || !p) return false;
    return (
      b['full_name'] === this.fullName.trim() &&
      b['gender'] === this.gender &&
      String(b['dob'] ?? '').slice(0, 10) === this.dob &&
      b['birth_time'] === this.time &&
      b['birth_place'] === p.name &&
      Number(b['latitude']) === p.lat &&
      Number(b['longitude']) === p.lon
    );
  }

  /** Back / Cancel: return to Home without saving. */
  async cancel(): Promise<void> {
    await this.router.navigateByUrl('/home', { replaceUrl: true });
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
    if (this.unchanged()) {
      // Nothing changed: don't save a copy (a new copy would make a new kundli).
      await this.router.navigateByUrl('/home', { replaceUrl: true });
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
