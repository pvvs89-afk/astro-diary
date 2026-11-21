import { Component, computed, input } from '@angular/core';
import { ChartCell } from '../kundli/kundli-view';

/** Fixed geometry of a North Indian chart (300 x 300): house 1 is the top diamond, houses run anticlockwise. */
interface House {
  n: number;
  /** Centre of the planet labels. */
  cx: number;
  cy: number;
  /** Where the rasi number sits (next to the centre of the chart). */
  sx: number;
  sy: number;
}
const HOUSES: House[] = [
  { n: 1, cx: 150, cy: 68, sx: 150, sy: 128 },
  { n: 2, cx: 75, cy: 26, sx: 75, sy: 60 },
  { n: 3, cx: 24, cy: 75, sx: 58, sy: 75 },
  { n: 4, cx: 70, cy: 150, sx: 128, sy: 150 },
  { n: 5, cx: 24, cy: 225, sx: 58, sy: 225 },
  { n: 6, cx: 75, cy: 274, sx: 75, sy: 240 },
  { n: 7, cx: 150, cy: 232, sx: 150, sy: 172 },
  { n: 8, cx: 225, cy: 274, sx: 225, sy: 240 },
  { n: 9, cx: 276, cy: 225, sx: 242, sy: 225 },
  { n: 10, cx: 230, cy: 150, sx: 172, sy: 150 },
  { n: 11, cx: 276, cy: 75, sx: 242, sy: 75 },
  { n: 12, cx: 225, cy: 26, sx: 225, sy: 60 },
];

/**
 * North Indian (diamond) chart drawn from the same cells as the South Indian chart -
 * no Prokerala call. House 1 = Lagna's rasi, then the rasis follow in order.
 */
@Component({
  selector: 'app-north-chart',
  standalone: true,
  template: `
    <svg class="north" viewBox="0 0 300 300" role="img" [attr.aria-label]="label()">
      <polygon class="lagna" points="150,2 224,76 150,150 76,76" />
      <rect class="ln" x="2" y="2" width="296" height="296" />
      <line class="ln" x1="2" y1="2" x2="298" y2="298" />
      <line class="ln" x1="298" y1="2" x2="2" y2="298" />
      <polygon class="ln" points="150,2 298,150 150,298 2,150" />
      @for (h of houses(); track h.n) {
        <text class="sign" [attr.x]="h.sx" [attr.y]="h.sy" text-anchor="middle" dominant-baseline="central">{{ h.sign }}</text>
        @for (it of h.items; track $index; let i = $index) {
          <text
            class="pl"
            [class.asc]="it.asc"
            [attr.x]="h.cx"
            [attr.y]="h.cy + (i - (h.items.length - 1) / 2) * 13"
            text-anchor="middle"
            dominant-baseline="central"
          >{{ it.text }}{{ it.retro ? retro() : '' }}</text>
        }
      }
    </svg>
  `,
  styles: [
    `
      :host { display: block; }
      .north { display: block; width: 100%; max-width: 360px; height: auto; margin: 0 auto; }
      .ln { fill: none; stroke: var(--pc, var(--ion-color-primary, #13245e)); stroke-width: 1.4; }
      .lagna { fill: var(--pc-soft, rgba(19, 36, 94, 0.1)); stroke: none; }
      .sign { font-size: 10px; fill: var(--ion-color-medium, #777); }
      .pl { font-size: 12px; fill: var(--ion-text-color, #1d1d1f); }
      .pl.asc { font-weight: 700; fill: var(--pc, var(--ion-color-primary, #13245e)); }
    `,
  ],
})
export class NorthChartComponent {
  readonly cells = input.required<ChartCell[]>();
  /** Screen-reader description of the chart. */
  readonly label = input('');
  /** Retrograde mark in the current language, e.g. "(R)". */
  readonly retro = input('(R)');

  readonly houses = computed(() => {
    const cells = this.cells() ?? [];
    const lagna = cells.find((c) => c.isLagna)?.rasiId ?? 0;
    return HOUSES.map((h) => {
      const rasiId = (lagna + h.n - 1) % 12;
      const cell = cells.find((c) => c.rasiId === rasiId);
      return { ...h, sign: rasiId + 1, items: cell?.items ?? [] };
    });
  });
}
