import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon, IonInput, IonItem, IonLabel, IonList, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmarkCircle, locationOutline, searchOutline } from 'ionicons/icons';
import { Key } from '../i18n/en';
import { I18nService } from '../i18n/i18n.service';
import { PbService, PersonBirth, Place } from '../services/pb.service';

/** Shown under the birth place while the current location is being found. */
const LOCATING: Record<string, string> = {
  en: 'Finding your current location…',
  hi: 'आपका वर्तमान स्थान ढूँढ रहे हैं…',
  ta: 'உங்கள் தற்போதைய இடத்தைக் கண்டறிகிறது…',
  te: 'మీ ప్రస్తుత స్థానాన్ని కనుగొంటోంది…',
  ml: 'നിങ്ങളുടെ നിലവിലെ സ്ഥലം കണ്ടെത്തുന്നു…',
};

/**
 * One person's birth details: name, date, time and birth place
 * (same dropdowns and place search as the birth details page).
 * Used twice on the match making form (boy and girl).
 */
@Component({
  selector: 'app-person-form',
  standalone: true,
  imports: [FormsModule, IonInput, IonSpinner, IonList, IonItem, IonLabel, IonIcon],
  template: `
    <h3 class="person-title">{{ title() }}</h3>

    <ion-input
      [label]="t('full_name')"
      labelPlacement="floating"
      fill="outline"
      autocapitalize="words"
      [maxlength]="100"
      [(ngModel)]="name"
    ></ion-input>

    <fieldset class="dd-group">
      <legend>{{ t('birth_date') }}</legend>
      <div class="dd-row">
        <select class="dd" [attr.aria-label]="t('year')" [(ngModel)]="year">
          <option value="" disabled>{{ t('year') }}</option>
          @for (y of years; track y) {
            <option [value]="y">{{ y }}</option>
          }
        </select>
        <select class="dd" [attr.aria-label]="t('month')" [(ngModel)]="month">
          <option value="" disabled>{{ t('month') }}</option>
          @for (m of months(); track m.value) {
            <option [value]="m.value">{{ m.label }}</option>
          }
        </select>
        <select class="dd" [attr.aria-label]="t('day')" [(ngModel)]="day">
          <option value="" disabled>{{ t('day') }}</option>
          @for (d of days; track d) {
            <option [value]="d">{{ d }}</option>
          }
        </select>
      </div>
    </fieldset>

    <fieldset class="dd-group">
      <legend>{{ t('birth_time') }}</legend>
      <div class="dd-row">
        <select class="dd" [attr.aria-label]="t('hour')" [(ngModel)]="hour">
          <option value="" disabled>{{ t('hour') }}</option>
          @for (h of hours; track h) {
            <option [value]="h">{{ h }}</option>
          }
        </select>
        <select class="dd" [attr.aria-label]="t('minute')" [(ngModel)]="minute">
          <option value="" disabled>{{ t('minute') }}</option>
          @for (m of minutes; track m) {
            <option [value]="m">{{ m }}</option>
          }
        </select>
        <select class="dd" [attr.aria-label]="t('am_pm')" [(ngModel)]="ampm">
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </fieldset>

    <div class="place-box">
      <ion-input
        [label]="t('birth_place')"
        labelPlacement="floating"
        fill="outline"
        autocapitalize="words"
        autocomplete="off"
        [debounce]="350"
        [value]="placeQuery"
        (ionInput)="onPlaceInput($any($event).detail.value)"
        (keyup.enter)="pickFirst()"
      >
        <span slot="end" class="place-status">
          @if (searching() || locating()) {
            <ion-spinner name="crescent" aria-hidden="true"></ion-spinner>
          } @else if (selectedPlace()) {
            <ion-icon name="checkmark-circle" color="success" role="img" aria-label="OK"></ion-icon>
          } @else {
            <ion-icon name="search-outline" aria-hidden="true"></ion-icon>
          }
        </span>
      </ion-input>

      @if (locating()) {
        <p class="hint" role="status" aria-live="polite">{{ locatingText() }}</p>
      } @else if (places(); as list) {
        @if (list.length) {
          <ion-list lines="full" class="places">
            @for (p of list; track p.name; let i = $index) {
              <ion-item button detail="false" (click)="choosePlace(p)" [class.top]="i === 0">
                <ion-icon slot="start" name="location-outline" aria-hidden="true"></ion-icon>
                <ion-label class="ion-text-wrap">
                  <b>{{ p.title || p.name }}</b>
                  @if (p.area) {
                    <p>{{ p.area }}</p>
                  }
                </ion-label>
              </ion-item>
            }
          </ion-list>
        } @else if (!searching()) {
          <p class="hint">{{ t('no_places') }}</p>
        }
      } @else if (!selectedPlace()) {
        <p class="hint">{{ t('place_hint') }}</p>
      }
    </div>
  `,
  styleUrls: ['./person-form.component.scss'],
})
export class PersonFormComponent implements OnInit {
  private pbs = inject(PbService);
  private i18n = inject(I18nService);
  readonly t = this.i18n.t;

  /** Heading, e.g. "Boy's details". */
  readonly title = input('');
  /** Start with today's date and the current time (match making). */
  readonly prefillNow = input(false);
  /** Start with the device's current location as the place (match making). */
  readonly prefillLocation = input(false);

  name = '';
  readonly years = Array.from({ length: new Date().getFullYear() - 1900 }, (_, i) =>
    String(new Date().getFullYear() - i),
  );
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

  placeQuery = '';
  readonly searching = signal(false);
  readonly places = signal<Place[] | null>(null);
  readonly selectedPlace = signal<Place | null>(null);
  private searchSeq = 0;
  /** Finding the current location for the place (match making), until it arrives or fails. */
  readonly locating = signal(false);
  readonly locatingText = computed(() => LOCATING[this.i18n.lang()] ?? LOCATING['en']);

  constructor() {
    addIcons({ searchOutline, locationOutline, checkmarkCircle });
  }

  ngOnInit(): void {
    if (this.prefillNow()) this.setNow();
    if (this.prefillLocation()) {
      // Asks the phone / browser for the location once (shared by both forms);
      // if the customer says no, the place simply stays empty.
      this.locating.set(true);
      void this.pbs
        .currentPlace()
        .then((p) => {
          if (p && !this.selectedPlace() && !this.placeQuery.trim()) this.choosePlace(p);
        })
        .catch(() => undefined)
        .finally(() => this.locating.set(false));
    }
  }

  /** Today's date and the current time from this device. */
  setNow(): void {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    this.year = String(d.getFullYear());
    this.month = pad(d.getMonth() + 1);
    this.day = pad(d.getDate());
    const h = d.getHours();
    this.hour = pad(h % 12 === 0 ? 12 : h % 12);
    this.minute = pad(d.getMinutes());
    this.ampm = h < 12 ? 'AM' : 'PM';
  }

  /** YYYY-MM-DD, or '' if incomplete / not a real date. */
  private get dob(): string {
    if (!this.year || !this.month || !this.day) return '';
    const y = Number(this.year);
    const m = Number(this.month);
    const d = Number(this.day);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return '';
    return `${this.year}-${this.month}-${this.day}`;
  }

  /** 24-hour HH:mm, or '' if incomplete. */
  private get time(): string {
    if (!this.hour || !this.minute) return '';
    let h = Number(this.hour) % 12;
    if (this.ampm === 'PM') h += 12;
    return `${String(h).padStart(2, '0')}:${this.minute}`;
  }

  /** Translation key of the first missing / wrong field, or null if all fine. */
  problem(): Key | null {
    if (!this.name.trim()) return 'err_full_name';
    if (!this.year || !this.month || !this.day) return 'err_date';
    if (!this.dob) return 'err_bad_date';
    if (this.dob > new Date().toISOString().slice(0, 10)) return 'err_future';
    if (!this.hour || !this.minute) return 'err_time';
    if (!this.selectedPlace()) return 'err_place';
    return null;
  }

  /** The entered details (call problem() first). */
  value(): PersonBirth {
    return { name: this.name.trim(), dob: this.dob, time: this.time, place: this.selectedPlace()! };
  }

  /** Fill from saved birth details (e.g. "use my details"). */
  fill(p: { name: string; dob: string; time: string; place: Place | null }): void {
    this.name = p.name;
    if (/^\d{4}-\d{2}-\d{2}$/.test(p.dob)) [this.year, this.month, this.day] = p.dob.split('-');
    const m = /^(\d{2}):(\d{2})$/.exec(p.time);
    if (m) {
      const h = Number(m[1]);
      this.hour = String(h % 12 === 0 ? 12 : h % 12).padStart(2, '0');
      this.minute = m[2];
      this.ampm = h < 12 ? 'AM' : 'PM';
    }
    if (p.place) this.choosePlace(p.place);
  }

  async onPlaceInput(value: string | null | undefined): Promise<void> {
    this.placeQuery = value ?? '';
    if (this.placeQuery.trim()) this.locating.set(false);
    const q = this.placeQuery.trim();
    const seq = ++this.searchSeq;
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
    } catch {
      if (seq === this.searchSeq) this.places.set([]);
    } finally {
      if (seq === this.searchSeq) this.searching.set(false);
    }
  }

  pickFirst(): void {
    const first = this.places()?.[0];
    if (first) this.choosePlace(first);
  }

  choosePlace(p: Place): void {
    this.locating.set(false);
    this.searchSeq++;
    this.searching.set(false);
    this.selectedPlace.set(p);
    this.placeQuery = p.name;
    this.places.set(null);
  }
}
