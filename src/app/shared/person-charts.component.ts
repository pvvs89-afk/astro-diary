import { Component, computed, inject, input, signal } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { ChartCell, buildKundliView, chartSummary } from '../kundli/kundli-view';
import { moonLongitude, vimshottari } from './vimshottari';

/**
 * One person's Rasi + Navamsa charts (South Indian) and Vimshottari dasha.
 * Used twice on the match result page (boy and girl).
 */
@Component({
  selector: 'app-person-charts',
  standalone: true,
  template: `
    <h4 class="who">{{ title() }}: <b>{{ name() }}</b></h4>
    @if (view(); as v) {
      @if (part() !== 'dasha') {
      @if (v.lagna) {
        <p class="facts muted">{{ t('lagna') }}: <b>{{ v.lagna }}</b></p>
      }
      <div class="charts">
        <div>
          <h4>{{ t('rasi_chart') }}</h4>
          <div class="chart" role="img" [attr.aria-label]="summary(v.chart, t('rasi_chart'))">
            @for (c of v.chart; track c.rasiId) {
              <div class="cell" aria-hidden="true" [class.lagna]="c.isLagna" [style.grid-row]="c.row" [style.grid-column]="c.col">
                <span class="rasi">{{ c.rasi }}</span>
                <span class="items">
                  @for (it of c.items; track $index) {
                    <span [class.asc]="it.asc">{{ it.text }}{{ it.retro ? t('retro') : '' }}</span>
                  }
                </span>
              </div>
            }
            <div class="center-cell" aria-hidden="true"><b>{{ t('rasi') }}</b><span>{{ name() }}</span></div>
          </div>
        </div>
        <div>
          <h4>{{ t('navamsa_chart') }}</h4>
          @if (navamsa(); as nav) {
            <div class="chart" role="img" [attr.aria-label]="summary(nav, t('navamsa_chart'))">
              @for (c of nav; track c.rasiId) {
                <div class="cell" aria-hidden="true" [class.lagna]="c.isLagna" [style.grid-row]="c.row" [style.grid-column]="c.col">
                  <span class="rasi">{{ c.rasi }}</span>
                  <span class="items">
                    @for (it of c.items; track $index) {
                      <span [class.asc]="it.asc">{{ it.text }}{{ it.retro ? t('retro') : '' }}</span>
                    }
                  </span>
                </div>
              }
              <div class="center-cell" aria-hidden="true"><b>{{ t('navamsa') }}</b><span>D9</span></div>
            </div>
          } @else {
            <p class="muted">{{ t('navamsa_not_ready') }}</p>
          }
        </div>
      </div>
      }

      @if (part() !== 'charts' && dasha(); as d) {
        <p class="muted small">{{ t('dasha_balance', { v: d.balance }) }}</p>
        <div class="dashas">
          @for (m of d.dashas; track m.name + m.start) {
            <div class="dasha" [class.current]="m.current">
              <button class="dasha-head" (click)="toggle(m.name + m.start)" [attr.aria-expanded]="isOpen(m.name + m.start, m.current)">
                <b>{{ m.name }}</b>
                <span>{{ m.start }} – {{ m.end }}</span>
                @if (m.current) { <span class="now">{{ t('running_now') }}</span> }
              </button>
              @if (isOpen(m.name + m.start, m.current)) {
                <div class="antar">
                  @for (a of m.antardasha; track a.name + a.start) {
                    <div class="antar-row" [class.current]="a.current">
                      <span>{{ m.name }} – {{ a.name }}</span>
                      <span>{{ a.start }} – {{ a.end }}</span>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
        <p class="muted small no-pdf">{{ t('tap_dasha') }}</p>
      }
    } @else {
      <p class="muted">{{ t('calculating') }}</p>
    }
  `,
  styleUrls: ['./person-charts.component.scss'],
  host: {
    '[class.boy]': "tone() === 'boy'",
    '[class.girl]': "tone() === 'girl'",
  },
})
export class PersonChartsComponent {
  private i18n = inject(I18nService);
  readonly t = this.i18n.t;

  /** Chart description for screen readers. */
  summary(cells: ChartCell[], title: string): string {
    return `${this.title()} ${this.name()} – ${chartSummary(cells, title, this.t('retro'))}`;
  }

  readonly title = input('');
  /** Colour set: boy = blue, girl = green. */
  readonly tone = input<'boy' | 'girl' | ''>('');
  /** 'charts' = Rasi + Navamsa only, 'dasha' = Vimshottari only, 'all' = both. */
  readonly part = input<'charts' | 'dasha' | 'all'>('all');
  readonly name = input('');
  /** { planets, navamsa } saved with the match for this person. */
  readonly data = input<unknown>(null);
  /** Birth date-time with offset, e.g. "1990-05-12T06:30:00+05:30". */
  readonly birthIso = input('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly d = computed(() => this.data() as any);
  readonly view = computed(() =>
    this.d()?.planets ? buildKundliView({ planets: this.d().planets, navamsa: this.d().navamsa, kundli: {}, input: {} }, this.i18n.lang()) : null,
  );
  readonly navamsa = computed<ChartCell[] | null>(() => this.view()?.navamsa ?? null);
  readonly dasha = computed(() => {
    const lon = moonLongitude(this.d()?.planets);
    return lon === null ? null : vimshottari(lon, this.birthIso(), this.i18n.lang());
  });

  /** null = default (running dasha open); otherwise the key the user opened, '' = all closed. */
  private readonly opened = signal<string | null>(null);

  isOpen(key: string, current: boolean): boolean {
    const o = this.opened();
    return o === null ? current : o === key;
  }

  toggle(key: string): void {
    const cur = this.dasha()?.dashas.find((m) => m.current);
    const isOpenNow = this.isOpen(key, !!cur && cur.name + cur.start === key);
    this.opened.set(isOpenNow ? '' : key);
  }
}
