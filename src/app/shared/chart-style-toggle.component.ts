import { Component, inject } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { ChartStyleService } from '../services/chart-style.service';

/** "South Indian | North Indian" switch for the charts (not printed in the PDF). */
@Component({
  selector: 'app-chart-style-toggle',
  standalone: true,
  template: `
    <div class="cst no-pdf" role="group" [attr.aria-label]="t('chart_style')">
      <button type="button" [class.on]="cs.style() === 'south'" [attr.aria-pressed]="cs.style() === 'south'" (click)="cs.set('south')">
        {{ t('south_indian') }}
      </button>
      <button type="button" [class.on]="cs.style() === 'north'" [attr.aria-pressed]="cs.style() === 'north'" (click)="cs.set('north')">
        {{ t('north_indian') }}
      </button>
    </div>
  `,
  styles: [
    `
      .cst { display: inline-flex; border: 1px solid var(--ion-color-primary); border-radius: 20px; overflow: hidden; margin: 6px 0; }
      button { background: transparent; border: 0; padding: 6px 14px; font-size: 13px; color: var(--ion-color-primary); cursor: pointer; }
      button.on { background: var(--ion-color-primary); color: #fff; }
    `,
  ],
})
export class ChartStyleToggleComponent {
  readonly cs = inject(ChartStyleService);
  readonly t = inject(I18nService).t;
}
