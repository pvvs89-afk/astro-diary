import { Injectable, inject, signal } from '@angular/core';
import { PbService } from './pb.service';

export type AppTheme = 'classic' | 'lavender' | 'saffron' | 'dark';
/** App themes with preview colours (bar, page, button). */
export const APP_THEMES: { id: AppTheme; swatch: [string, string, string]; bar: string }[] = [
  { id: 'classic', swatch: ['#13245e', '#ffffff', '#2563eb'], bar: '#13245e' },
  { id: 'lavender', swatch: ['#534ab7', '#faf9ff', '#1d9e75'], bar: '#534ab7' },
  { id: 'saffron', swatch: ['#993c1d', '#fffbf3', '#ba7517'], bar: '#993c1d' },
  { id: 'dark', swatch: ['#0b1438', '#070d26', '#9db4ff'], bar: '#0b1438' },
];
const KEY = 'astro.appTheme';
const isAppTheme = (v: unknown): v is AppTheme => APP_THEMES.some((t) => t.id === v);

/**
 * Whole-app theme chosen by the customer. The phone's dark/light mode is ignored.
 * Saved to the customer's account (and cached on the phone so it shows at once).
 */
@Injectable({ providedIn: 'root' })
export class AppThemeService {
  private pbs = inject(PbService);
  readonly theme = signal<AppTheme>(readLocal());

  constructor() {
    apply(this.theme());
  }

  /** After login / app start: use the theme saved on the account. */
  syncFromAccount(): void {
    const t = this.pbs.user?.['app_theme'];
    if (isAppTheme(t) && t !== this.theme()) this.use(t);
  }

  async set(t: AppTheme): Promise<void> {
    this.use(t);
    const id = this.pbs.user?.id;
    if (!id) return;
    await this.pbs.pb.collection('users').update(id, { app_theme: t });
    await this.pbs.pb.collection('users').authRefresh();
  }

  private use(t: AppTheme): void {
    this.theme.set(t);
    apply(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* not remembered on this phone */
    }
  }
}

function readLocal(): AppTheme {
  try {
    const v = localStorage.getItem(KEY);
    return isAppTheme(v) ? v : 'classic';
  } catch {
    return 'classic';
  }
}

/** Puts the theme class on <html> (and Ionic's dark palette for "dark"). */
export function apply(t: AppTheme): void {
  const el = document.documentElement;
  for (const x of APP_THEMES) el.classList.remove('app-theme-' + x.id);
  el.classList.toggle('ion-palette-dark', t === 'dark');
  if (t !== 'classic') el.classList.add('app-theme-' + t);
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', APP_THEMES.find((x) => x.id === t)?.bar ?? '#13245e');
}
