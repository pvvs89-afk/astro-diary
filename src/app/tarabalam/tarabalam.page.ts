import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { NAKSHATRA_NAMES } from '../i18n/astro-names';
import { I18nService } from '../i18n/i18n.service';
import { LangButtonComponent } from '../i18n/lang-button.component';
import { PbService } from '../services/pb.service';
import { moonLongitude } from '../shared/vimshottari';
import { NAK, TARA_RESULT, TaraDay, TaraResult, nakshatraSpan, taraNumber, taraWeek } from './tara-calc';
import { TARA_TEXT } from './tara-text';

interface Where {
  lat: number;
  lon: number;
  name: string;
  /** true = birth place used because the current location wasn't available. */
  fallback: boolean;
}

/**
 * Tara Balam: the customer's birth star (from the saved kundli) against the day's
 * star at their current location, for today and the next 6 days.
 * Everything is calculated on the phone - no Prokerala call.
 */
@Component({
  selector: 'app-tarabalam',
  standalone: true,
  imports: [
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonMenuButton,
    IonButton,
    IonContent,
    IonSpinner,
    LangButtonComponent,
  ],
  templateUrl: './tarabalam.page.html',
  styleUrls: ['./tarabalam.page.scss'],
})
export class TarabalamPage implements OnInit {
  private pbs = inject(PbService);
  private i18n = inject(I18nService);
  readonly t = this.i18n.t;

  readonly loading = signal(true);
  readonly error = signal('');
  /** Birth nakshatra 0-26, null = no kundli yet. */
  readonly birthStar = signal<number | null>(null);
  readonly where = signal<Where | null>(null);
  /** Re-calculated when the page opens again. */
  readonly now = signal(Date.now());

  readonly tx = computed(() => TARA_TEXT[this.i18n.lang()]);
  private readonly locale = computed(() => `${this.i18n.lang()}-IN`);

  readonly week = computed<TaraDay[]>(() => {
    const b = this.birthStar();
    const w = this.where();
    return b === null || !w ? [] : taraWeek(b, w.lat, w.lon, this.now(), 7);
  });

  readonly current = computed(() => {
    const b = this.birthStar();
    if (b === null) return null;
    const span = nakshatraSpan(this.now());
    const next = (span.index + 1) % 27;
    return { ...span, tara: taraNumber(b, span.index), next, nextTara: taraNumber(b, next) };
  });

  /** The 27 stars grouped by tara 1-9 (3 stars each). */
  readonly groups = computed(() => {
    const b = this.birthStar();
    if (b === null) return [];
    return [1, 2, 3, 4, 5, 6, 7, 8, 9].map((tara) => ({
      tara,
      stars: Array.from({ length: 27 }, (_, s) => s).filter((s) => taraNumber(b, s) === tara),
    }));
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  ionViewWillEnter(): void {
    this.now.set(Date.now());
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [state, here] = await Promise.all([this.pbs.kundliState(), this.pbs.currentPlace()]);
      const lon = moonLongitude(state.kundli?.['data']?.planets);
      this.birthStar.set(lon === null ? null : Math.floor(lon / NAK) % 27);
      const b = state.birth;
      if (here) {
        this.where.set({ lat: here.lat, lon: here.lon, name: here.title || here.name, fallback: false });
      } else if (b && (Number(b['latitude']) || Number(b['longitude']))) {
        this.where.set({
          lat: Number(b['latitude']),
          lon: Number(b['longitude']),
          name: String(b['birth_place'] ?? ''),
          fallback: true,
        });
      } else {
        // Last resort: centre of India, so the stars still show.
        this.where.set({ lat: 20.59, lon: 78.96, name: 'India', fallback: true });
      }
      this.now.set(Date.now());
    } catch (e) {
      this.error.set(this.i18n.err(e));
    } finally {
      this.loading.set(false);
    }
  }

  star(i: number): string {
    return NAKSHATRA_NAMES[this.i18n.lang()][i] ?? '';
  }

  result(tara: number): TaraResult {
    return TARA_RESULT[tara];
  }

  /** "6:24 am"; adds the date when it isn't on `sameDayAs`. */
  time(ms: number, sameDayAs?: number): string {
    const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
    if (sameDayAs !== undefined && new Date(ms).toDateString() !== new Date(sameDayAs).toDateString()) {
      opts.day = 'numeric';
      opts.month = 'short';
    }
    return new Intl.DateTimeFormat(this.locale(), opts).format(ms);
  }

  dayLabel(ms: number): string {
    return new Intl.DateTimeFormat(this.locale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(ms);
  }

  isToday(ms: number): boolean {
    return new Date(ms).toDateString() === new Date(this.now()).toDateString();
  }

  fill(text: string, vars: Record<string, string>): string {
    return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  }
}
