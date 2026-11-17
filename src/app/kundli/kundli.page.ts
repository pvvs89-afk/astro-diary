import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
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
} from '@ionic/angular';
import { RecordModel } from 'pocketbase';
import { I18nService, LangCode } from '../i18n/i18n.service';
import { LangButtonComponent } from '../i18n/lang-button.component';
import { PbService } from '../services/pb.service';
import { birthText, buildKundliView, hasLanguage } from './kundli-view';

@Component({
  selector: 'app-kundli',
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
  ],
  templateUrl: './kundli.page.html',
  styleUrls: ['./kundli.page.scss'],
})
export class KundliPage implements OnInit {
  private pbs = inject(PbService);
  private router = inject(Router);
  private i18n = inject(I18nService);
  readonly t = this.i18n.t;

  readonly loading = signal(true);
  readonly generating = signal(false);
  /** Fetching Prokerala's report in the chosen language (first time only). */
  readonly translating = signal(false);
  readonly error = signal('');
  readonly birth = signal<RecordModel | null>(null);
  readonly kundli = signal<RecordModel | null>(null);

  readonly view = computed(() => buildKundliView(this.kundli()?.['data'], this.i18n.lang()));
  readonly hasPlace = computed(() => {
    const b = this.birth();
    return !!b && (Number(b['latitude']) !== 0 || Number(b['longitude']) !== 0);
  });
  readonly openDasha = signal<string | null>(null);

  /** Languages already asked for on this visit, so a failure isn't retried in a loop. */
  private requested = new Set<string>();

  constructor() {
    // When the kundli is shown in a language whose report isn't stored yet,
    // ask the server once to fetch it from Prokerala and save it.
    effect(() => {
      const lang = this.i18n.lang();
      const rec = this.kundli();
      if (!rec || hasLanguage(rec['data'], lang)) return;
      const key = rec.id + ':' + lang;
      if (this.requested.has(key)) return;
      this.requested.add(key);
      untracked(() => void this.translate(lang));
    });
  }

  birthText(iso: string): string {
    return birthText(iso, this.i18n.lang());
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const state = await this.pbs.kundliState();
      this.birth.set(state.birth);
      this.kundli.set(state.kundli);
    } catch (e) {
      this.error.set(this.i18n.err(e));
    } finally {
      this.loading.set(false);
    }
  }

  async generate(): Promise<void> {
    this.generating.set(true);
    this.error.set('');
    try {
      this.kundli.set(await this.pbs.generateKundli(this.i18n.lang()));
    } catch (e) {
      this.error.set(this.i18n.err(e));
    } finally {
      this.generating.set(false);
    }
  }

  private async translate(lang: LangCode): Promise<void> {
    this.translating.set(true);
    try {
      const rec = await this.pbs.generateKundli(lang);
      // The returned record holds every language stored so far.
      this.kundli.set(rec);
    } catch {
      // Not fatal: names are already translated; texts stay in English.
    } finally {
      this.translating.set(false);
    }
  }

  toggleDasha(name: string): void {
    this.openDasha.set(this.openDasha() === name ? null : name);
  }

  editBirthDetails(): void {
    this.router.navigateByUrl('/birth-details');
  }
}
