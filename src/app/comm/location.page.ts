import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  AlertController,
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
import { RecordModel } from 'pocketbase';
import { I18nService } from '../i18n/i18n.service';
import { LangButtonComponent } from '../i18n/lang-button.component';
import { CommService, HereNow, mapsLink } from '../services/comm.service';
import { COMM_TEXT, CommKey, fill } from './comm-text';
import { osmEmbed } from './osm';

/** "Share my location": the customer checks the reading, then saves it for the astrologer. */
@Component({
  selector: 'app-location',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonMenuButton, IonButton, IonContent, IonSpinner, LangButtonComponent],
  templateUrl: './location.page.html',
  styleUrls: ['./comm.scss'],
})
export class LocationPage implements OnInit {
  private comm = inject(CommService);
  private i18n = inject(I18nService);
  private alerts = inject(AlertController);
  private sanitizer = inject(DomSanitizer);
  readonly t = this.i18n.t;
  readonly tx = computed(() => COMM_TEXT[this.i18n.lang()]);
  readonly mapsLink = mapsLink;

  readonly loading = signal(true);
  readonly locating = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly done = signal('');
  readonly here = signal<HereNow | null>(null);
  readonly map = signal<SafeResourceUrl | null>(null);
  readonly history = signal<RecordModel[]>([]);

  async ngOnInit(): Promise<void> {
    try {
      this.history.set(await this.comm.locations());
    } catch (e) {
      this.error.set(this.i18n.err(e));
    } finally {
      this.loading.set(false);
    }
  }

  text(key: CommKey, vars: Record<string, string | number> = {}): string {
    return fill(this.tx()[key], vars);
  }

  async locate(): Promise<void> {
    this.locating.set(true);
    this.error.set('');
    this.done.set('');
    try {
      const h = await this.comm.locate();
      this.here.set(h);
      this.map.set(osmEmbed(this.sanitizer, h.lat, h.lon));
    } catch {
      this.error.set(this.tx().msg_loc_denied);
    } finally {
      this.locating.set(false);
    }
  }

  cancel(): void {
    this.here.set(null);
    this.map.set(null);
  }

  async save(): Promise<void> {
    const h = this.here();
    if (!h) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const rec = await this.comm.saveLocation(h);
      this.history.update((l) => [rec, ...l]);
      this.cancel();
      this.done.set(this.tx().loc_saved);
    } catch (e) {
      this.error.set(this.i18n.err(e));
    } finally {
      this.saving.set(false);
    }
  }

  async remove(r: RecordModel): Promise<void> {
    const a = await this.alerts.create({
      message: this.tx().loc_delete_q,
      buttons: [
        { text: this.tx().cancel, role: 'cancel' },
        { text: this.tx().msg_delete, role: 'destructive' },
      ],
    });
    await a.present();
    if ((await a.onDidDismiss()).role !== 'destructive') return;
    try {
      await this.comm.deleteLocation(r.id);
      this.history.update((l) => l.filter((x) => x.id !== r.id));
    } catch (e) {
      this.error.set(this.i18n.err(e));
    }
  }

  round(n: number): number {
    return Math.round(n);
  }

  time(v: unknown): string {
    const d = new Date(String(v).replace(' ', 'T'));
    return isNaN(d.getTime())
      ? ''
      : new Intl.DateTimeFormat(`${this.i18n.lang()}-IN`, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
  }
}
