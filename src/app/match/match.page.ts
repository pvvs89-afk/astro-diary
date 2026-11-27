import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ActionSheetController,
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { downloadOutline } from 'ionicons/icons';
import { RecordModel } from 'pocketbase';
import { I18nService } from '../i18n/i18n.service';
import { LangButtonComponent } from '../i18n/lang-button.component';
import { PbService } from '../services/pb.service';
import { elementToPdf, safeFileName, saveBlob } from '../shared/pdf-export';
import { PersonChartsComponent } from '../shared/person-charts.component';
import { ChartStyleToggleComponent } from '../shared/chart-style-toggle.component';
import { askPdfLanguage, nextPaint } from '../shared/pdf-language';
import { buildMatchView } from './match-view';

/** One saved match report: score, gunas / poruthams, mangal dosha, PDF. */
@Component({
  selector: 'app-match',
  standalone: true,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonMenuButton,
    IonButton,
    IonContent,
    IonSpinner,
    IonIcon,
    PersonChartsComponent,
    ChartStyleToggleComponent,
    LangButtonComponent,
  ],
  templateUrl: './match.page.html',
  styleUrls: ['./match.page.scss'],
})
export class MatchPage implements OnInit {
  private pbs = inject(PbService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private alerts = inject(AlertController);
  private i18n = inject(I18nService);
  private sheets = inject(ActionSheetController);
  readonly t = this.i18n.t;

  readonly rec = signal<RecordModel | null>(null);
  /** Report text follows the app language (fetched once per language when needed). */
  readonly view = computed(() => buildMatchView(this.rec(), this.i18n.lang()));
  /** Fetching Prokerala's text in the chosen language (first time only). */
  readonly loading = signal(true);
  readonly error = signal('');
  readonly exporting = signal(false);
  /** Fetching charts for a match saved without them (first view only). */
  readonly chartsLoading = signal(false);
  private readonly pdfArea = viewChild<ElementRef<HTMLElement>>('pdfArea');

  constructor() {
    addIcons({ downloadOutline });
  }

  async ngOnInit(): Promise<void> {
    try {
      this.rec.set(await this.pbs.getMatch(this.route.snapshot.paramMap.get('id') ?? ''));
    } catch (e) {
      this.error.set(this.i18n.err(e));
    } finally {
      this.loading.set(false);
    }
    void this.ensureCharts();
  }

  /** Matches saved without charts get them once from the server. */
  private async ensureCharts(): Promise<void> {
    const r = this.rec();
    if (!r || (this.personData('boy') && this.personData('girl'))) return;
    this.chartsLoading.set(true);
    try {
      this.rec.set(await this.pbs.ensureMatchCharts(r.id));
    } catch {
      /* charts stay hidden; the rest of the report is shown */
    } finally {
      this.chartsLoading.set(false);
    }
  }

  /** { planets, navamsa } saved for this person, or null. */
  personData(p: 'boy' | 'girl'): unknown {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (this.rec()?.['data'] as any)?.[p];
    return d?.planets ? d : null;
  }

  /** "1990-05-12T06:30:00+05:30" for the dasha calculation. */
  birthIso(p: 'boy' | 'girl'): string {
    const r = this.rec();
    if (!r) return '';
    return `${r[p + '_dob']}T${r[p + '_time']}:00${r[p + '_offset'] || '+05:30'}`;
  }

  /** "12 May 1990, 06:30 · Hyderabad, Telangana, India" */
  personText(p: 'boy' | 'girl'): string {
    const r = this.rec();
    if (!r) return '';
    const dob = String(r[p + '_dob'] ?? '');
    const time = String(r[p + '_time'] ?? '');
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
    const t = /^(\d{2}):(\d{2})$/.exec(time);
    const date = m ? `${Number(m[3])} ${this.i18n.months()[Number(m[2]) - 1]} ${m[1]}` : dob;
    let clock = time;
    if (t) {
      const h = Number(t[1]);
      clock = `${String(h).padStart(2, '0')}:${t[2]}`;
    }
    const place = String(r[p + '_place'] ?? '').split(',').slice(0, 2).join(',');
    return `${date}, ${clock} · ${place}`;
  }

  todayText(): string {
    const d = new Date();
    return `${d.getDate()} ${this.i18n.months()[d.getMonth()]} ${d.getFullYear()}`;
  }

  /** Asks the PDF language, shows the page in it for a moment, saves, then switches back. */
  async downloadPdf(): Promise<void> {
    if (this.exporting()) return;
    const la = await askPdfLanguage(this.sheets, this.i18n);
    if (!la) return;
    const before = this.i18n.lang();
    try {
      if (la !== before) {
        this.exporting.set(true);
        await this.i18n.use(la);
        await nextPaint();
        this.exporting.set(false);
      }
      await this.savePdf();
    } catch (e) {
      this.error.set(this.i18n.err(e));
    } finally {
      this.exporting.set(false);
      if (la !== before) await this.i18n.use(before);
    }
  }

  private async savePdf(): Promise<void> {
    const area = this.pdfArea()?.nativeElement;
    const v = this.view();
    if (!area || !v || this.exporting()) return;
    this.exporting.set(true);
    this.error.set('');
    try {
      const blob = await elementToPdf(area, {
        title: `Match - ${v.boyName} & ${v.girlName}`,
        width: 1040, // wide, so the 4 charts stay in one line in the PDF
        breakAt: 'h3, .card, .table-wrap, .pair, tr',
      });
      saveBlob(blob, `Match-${safeFileName(v.boyName)}-${safeFileName(v.girlName)}.pdf`);
    } catch (e) {
      console.error('Match PDF failed', e);
      this.error.set(this.t('pdf_failed'));
    } finally {
      this.exporting.set(false);
    }
  }

  async remove(): Promise<void> {
    const r = this.rec();
    if (!r) return;
    const alert = await this.alerts.create({
      header: this.t('delete_match_q'),
      buttons: [
        { text: this.t('cancel'), role: 'cancel' },
        { text: this.t('delete'), role: 'destructive' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'destructive') return;
    try {
      await this.pbs.deleteMatch(r.id);
      await this.router.navigateByUrl('/matches', { replaceUrl: true });
    } catch (e) {
      this.error.set(this.i18n.err(e));
    }
  }
}
