import { Injectable, computed, inject, signal } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';

export type ChartStyle = 'south' | 'north';
const KEY = 'astro.chartStyle';

/**
 * South / North Indian chart style, remembered on this device.
 * Until the customer chooses, Hindi shows North Indian and other languages South Indian.
 */
@Injectable({ providedIn: 'root' })
export class ChartStyleService {
  private i18n = inject(I18nService);
  private readonly chosen = signal<ChartStyle | null>(read());
  readonly style = computed<ChartStyle>(() => this.chosen() ?? (this.i18n.lang() === 'hi' ? 'north' : 'south'));

  set(s: ChartStyle): void {
    this.chosen.set(s);
    try {
      localStorage.setItem(KEY, s);
    } catch {
      /* private mode - just not remembered */
    }
  }
}

function read(): ChartStyle | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'north' || v === 'south' ? v : null;
  } catch {
    return null;
  }
}
