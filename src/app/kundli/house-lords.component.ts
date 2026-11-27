import { Component, computed, effect, input, signal } from '@angular/core';
import { HOUSE_LORD_TEXT, HouseLordRow, houseLordTitle } from './kundli-view';
import { LangCode } from '../i18n/astro-names';

/**
 * "Lords of the 12 houses" section of the Kundli, kept on its own so it can be
 * shown, hidden or limited separately (e.g. later: only for subscribed customers).
 *  - The table (house, rasi, lord, where the lord sits) is worked out from the Rasi
 *    chart - no Prokerala call.
 *  - The results text for each placement comes from house-lord-results.ts (the
 *    customer's document, English) or its translation (house-lord-results.te.ts for
 *    Telugu ...), loaded only when this section is shown, in the chosen language.
 *    A language without a translation file shows the English text.
 * Inputs:
 *  - rows: view.houseLords from buildKundliView()
 *  - lang: language of the labels
 *  - showResults: false hides the results text (e.g. for customers without a plan)
 *  - lockedNote: optional text shown instead of the results when they are hidden
 */
@Component({
  selector: 'app-house-lords',
  standalone: true,
  template: `
    @if (rows().length) {
      <section class="hl-section">
        <h3>{{ tx().title }}</h3>
        <p class="muted small">{{ tx().hint }}</p>
        <div class="table-wrap">
          <table class="house-lords">
            <thead>
              <tr><th scope="col">{{ tx().house }}</th><th scope="col">{{ tx().rasi }}</th><th scope="col">{{ tx().lord }}</th><th scope="col">{{ tx().placed }}</th></tr>
            </thead>
            <tbody>
              @for (h of rows(); track h.house) {
                <tr [class.lagna-row]="h.house === 1">
                  <td><b>{{ h.house }}</b></td>
                  <td>{{ h.rasi }}</td>
                  <td>{{ h.lord }}</td>
                  <td>
                    @if (h.lordHouse) { {{ h.lordHouse }} · {{ h.lordRasi }} }
                    @if (h.status) { <span class="hl-tag" [attr.data-s]="h.status">{{ tx()[h.status] }}</span> }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (showResults()) {
          @if (results(); as res) {
            <h3>{{ tx().results }}</h3>
            @if (tx().resultsNote) { <p class="muted small">{{ tx().resultsNote }}</p> }
            <div class="hl-results">
              @for (h of rows(); track h.house) {
                @if (h.lordHouse && res[h.house - 1]?.[h.lordHouse - 1]; as text) {
                  <div class="hl-card">
                    <div class="hl-card-head">
                      <span class="hl-num">{{ h.house }}</span>
                      <b>{{ title(h) }}</b>
                      @if (h.status) { <span class="hl-tag" [attr.data-s]="h.status">{{ tx()[h.status] }}</span> }
                    </div>
                    <p [attr.lang]="resultsLang()">{{ text }}</p>
                  </div>
                }
              }
            </div>
          }
        } @else if (lockedNote()) {
          <p class="hl-locked">{{ lockedNote() }}</p>
        }
      </section>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .muted { color: var(--ion-color-medium); }
      .small { font-size: 13px; }
      .table-wrap { overflow-x: auto; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--ad-line, rgba(0, 0, 0, 0.08)); font-size: 14px; }
      th { font-weight: 600; color: var(--ion-color-medium); }
      .house-lords .lagna-row td { background: rgba(var(--ion-color-primary-rgb), 0.08); }
      .hl-tag { display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 8px; font-size: 11px; font-weight: 700; vertical-align: middle; }
      .hl-tag[data-s='own'] { background: rgba(37, 99, 235, 0.12); color: #1d4ed8; }
      .hl-tag[data-s='exalted'] { background: rgba(22, 163, 74, 0.14); color: #15803d; }
      .hl-tag[data-s='debilitated'] { background: rgba(220, 38, 38, 0.12); color: #b91c1c; }
      .hl-results { display: flex; flex-direction: column; gap: 10px; margin-bottom: 8px; }
      .hl-card { padding: 12px 14px; border-radius: 14px; background: var(--ad-card, var(--ion-card-background, #fff)); border: 1px solid var(--ad-line, rgba(0, 0, 0, 0.08)); }
      .hl-card-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
      .hl-card-head b { font-size: 14.5px; }
      .hl-card-head .hl-tag { margin-left: 0; }
      .hl-num { width: 26px; height: 26px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; flex: none;
        font-size: 13px; font-weight: 700; color: var(--ion-color-primary-contrast); background: var(--ion-color-primary); }
      .hl-card p { margin: 0; font-size: 14px; line-height: 1.55; color: var(--ion-text-color); }
      .hl-locked { padding: 12px 14px; border-radius: 14px; border: 1px dashed var(--ion-color-primary); color: var(--ion-color-primary); font-weight: 600; }
    `,
  ],
})
export class HouseLordsComponent {
  readonly rows = input<HouseLordRow[]>([]);
  readonly lang = input<LangCode>('en');
  readonly showResults = input(true);
  readonly lockedNote = input('');

  readonly tx = computed(() => HOUSE_LORD_TEXT[this.lang()]);
  readonly results = signal<string[][] | null>(null);
  /** Language of the results text actually shown (English when not translated yet). */
  readonly resultsLang = signal<string>('en');

  constructor() {
    // Load the results text in the chosen language (again when the language changes).
    effect(() => void this.load(this.lang()));
  }

  private async load(lang: LangCode): Promise<void> {
    try {
      if (lang === 'te') {
        const m = await import('./house-lord-results.te');
        this.results.set(m.HOUSE_LORD_RESULTS_TE);
        this.resultsLang.set('te');
        return;
      }
      const m = await import('./house-lord-results');
      this.results.set(m.HOUSE_LORD_RESULTS);
      this.resultsLang.set('en');
    } catch {
      /* results stay hidden */
    }
  }

  title(h: HouseLordRow): string {
    return houseLordTitle(this.tx().resultTitle, h);
  }
}
