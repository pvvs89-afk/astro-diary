import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  ActionSheetController,
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
import { askPdfLanguage, nextPaint } from '../shared/pdf-language';
import { ChartStyleService } from '../services/chart-style.service';
import { ChartStyleToggleComponent } from '../shared/chart-style-toggle.component';
import { NorthChartComponent } from '../shared/north-chart.component';
import { birthText, buildKundliView, chartSummary } from './kundli-view';
import { HouseLordsComponent } from './house-lords.component';

@Component({
  selector: 'app-kundli',
  standalone: true,
  imports: [HouseLordsComponent, 
    NorthChartComponent,
    ChartStyleToggleComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonBackButton,
    IonButton,
    IonContent,
    IonSpinner,
    IonIcon,
    LangButtonComponent,
  ],
  templateUrl: './kundli.page.html',
  styleUrls: ['./kundli.page.scss'],
})
export class KundliPage implements OnInit {
  private pbs = inject(PbService);
  private router = inject(Router);
  private i18n = inject(I18nService);
  private sheets = inject(ActionSheetController);
  readonly t = this.i18n.t;
  readonly cs = inject(ChartStyleService);
  readonly chartSummary = chartSummary;

  readonly loading = signal(true);
  readonly generating = signal(false);
  /** Fetching Prokerala's report in the chosen language (first time only). */
  readonly error = signal('');
  readonly birth = signal<RecordModel | null>(null);
  readonly kundli = signal<RecordModel | null>(null);

  readonly view = computed(() => buildKundliView(this.kundli()?.['data'], this.i18n.lang()));
  /** App language (for the house lords section). */
  readonly lang = this.i18n.lang;

  readonly hasPlace = computed(() => {
    const b = this.birth();
    return !!b && (Number(b['latitude']) !== 0 || Number(b['longitude']) !== 0);
  });
  readonly openDasha = signal<string | null>(null);

  /** The part of the page that goes into the PDF. */
  private readonly pdfArea = viewChild<ElementRef<HTMLElement>>('pdfArea');
  readonly exporting = signal(false);

  constructor() {
    addIcons({ downloadOutline });
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

  /** Today's date for the PDF header, e.g. "17 Nov 2026" (month in the app language). */
  todayText(): string {
    const d = new Date();
    return `${d.getDate()} ${this.i18n.months()[d.getMonth()]} ${d.getFullYear()}`;
  }

  /**
   * Saves the kundli as an A4 PDF. The page is drawn as a picture (so Telugu,
   * Hindi, Tamil and Malayalam text look exactly like on screen) and split into
   * pages between sections, never through the middle of a chart.
   * The two libraries are loaded only when this button is pressed.
   */
  /**
   * Download PDF: asks the language first. If it differs from the app language,
   * the page is shown in that language for a moment (fetching Prokerala's text
   * in that language once if needed), the PDF is made, then the language is put back.
   */
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
    const openBefore = this.openDasha();
    // Show the running mahadasha's antardashas in the PDF.
    const running = v.dashas.find((d) => d.current);
    if (running) this.openDasha.set(running.name + running.start);

    let holder: HTMLElement | null = null;
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
      ]);

      // Let Angular show the opened antardashas first.
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60)));

      // Draw a COPY placed directly in <body>, outside Ionic's scrolling page
      // (html2canvas draws content inside ion-content as blank). The copy sits
      // behind the app, so the customer doesn't see the page jump.
      holder = document.createElement('div');
      holder.style.cssText =
        'position:fixed;left:0;top:0;width:760px;z-index:-1;pointer-events:none;background:#fff;';
      const copy = area.cloneNode(true) as HTMLElement;
      copy.classList.add('pdf-print'); // light colours, fixed width, brand header
      holder.appendChild(copy);
      document.body.appendChild(holder);

      // Wait for the logo image in the copy to load.
      await Promise.all(
        Array.from(copy.querySelectorAll('img')).map((img) =>
          img.complete ? null : new Promise((r) => (img.onload = img.onerror = r)),
        ),
      );
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));

      const scale = 2;
      const top = copy.getBoundingClientRect().top;
      // Good places to start a new page: the top of each section.
      const breaks = Array.from(
        copy.querySelectorAll<HTMLElement>('h3, .card, .facts, .chart, .table-wrap, .dasha, .antar-row, tr, .footer'),
      )
        .map((el) => Math.round((el.getBoundingClientRect().top - top) * scale))
        .filter((y) => y > 0)
        .sort((a, b) => a - b);

      const canvas = await html2canvas(copy, {
        scale,
        backgroundColor: '#ffffff',
        useCORS: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 760,
        windowHeight: Math.max(copy.scrollHeight + 40, window.innerHeight),
      });
      if (!canvas.width || !canvas.height) throw new Error('Empty capture');

      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const margin = 10;
      const pageW = 210 - margin * 2;
      const pageH = 297 - margin * 2;
      const pxPerMm = canvas.width / pageW;
      const pagePx = Math.floor(pageH * pxPerMm);

      let y = 0;
      let first = true;
      while (y < canvas.height - 2) {
        let end = Math.min(y + pagePx, canvas.height);
        if (end < canvas.height) {
          // Cut at the last section start on this page (if it isn't too high up).
          const cut = breaks.filter((b) => b > y + pagePx * 0.4 && b <= end).pop();
          if (cut) end = cut;
        }
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = end - y;
        slice.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, end - y, 0, 0, canvas.width, end - y);
        if (!first) pdf.addPage();
        pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, pageW, (end - y) / pxPerMm);
        first = false;
        y = end;
      }

      const safeName = (v.name || 'kundli').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
      pdf.setProperties({ title: `Kundli - ${v.name}`, creator: 'Astro Diary' });
      // Browser: downloads the file. (On the Android/iOS app we will add sharing
      // with Capacitor Filesystem + Share when the mobile build is set up.)
      pdf.save(`Kundli-${safeName || 'Astro-Diary'}.pdf`);
    } catch (e) {
      console.error('PDF export failed', e);
      this.error.set(this.t('pdf_failed'));
    } finally {
      holder?.remove();
      this.openDasha.set(openBefore);
      this.exporting.set(false);
    }
  }

  toggleDasha(name: string): void {
    this.openDasha.set(this.openDasha() === name ? null : name);
  }

  editBirthDetails(): void {
    this.router.navigateByUrl('/birth-details');
  }
}
