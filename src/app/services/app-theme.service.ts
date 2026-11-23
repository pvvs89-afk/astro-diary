import { Injectable, inject, signal } from '@angular/core';
import { PbService } from './pb.service';

export type AppTheme = 'sunrise' | 'cosmic' | 'saffron' | 'pastel' | 'emerald' | 'rose' | 'ocean';
/** App themes with preview colours (page, card, accent) and the phone's top-bar colour. */
export const APP_THEMES: { id: AppTheme; swatch: [string, string, string]; bar: string; dark: boolean }[] = [
  { id: 'sunrise', swatch: ['#FFF5EB', '#D9580B', '#FFA62B'], bar: '#D9580B', dark: false },
  { id: 'cosmic', swatch: ['#0D0A2B', '#251E63', '#F2C14E'], bar: '#120E36', dark: true },
  { id: 'saffron', swatch: ['#FFF7EC', '#7A1F3D', '#E8641B'], bar: '#7A1F3D', dark: false },
  { id: 'pastel', swatch: ['#F6F2FF', '#6D4AFF', '#FF5C8A'], bar: '#6D4AFF', dark: false },
  { id: 'emerald', swatch: ['#0A231E', '#123A31', '#E9C46A'], bar: '#0E2D26', dark: true },
  { id: 'rose', swatch: ['#FFF4F6', '#8E2C5A', '#E85D8E'], bar: '#8E2C5A', dark: false },
  { id: 'ocean', swatch: ['#EFFAFB', '#0E7C86', '#FF7A59'], bar: '#0E7C86', dark: false },
];
const KEY = 'astro.appTheme';
/** Theme used when the customer hasn't chosen one, after a reset, and after logout. */
export const DEFAULT_APP_THEME: AppTheme = 'sunrise';
const OLD: Record<string, AppTheme> = { classic: 'cosmic', dark: 'cosmic', lavender: 'pastel' };
const isAppTheme = (v: unknown): v is AppTheme => APP_THEMES.some((t) => t.id === v);
/** New theme id for a saved value (older app versions saved other names). */
const normal = (v: unknown): AppTheme | null => (isAppTheme(v) ? v : typeof v === 'string' && OLD[v] ? OLD[v] : null);

/**
 * Whole-app theme chosen by the customer: Sunrise Orange (default), Cosmic Night, Saffron Sunrise,
 * Celestial Pastel, Emerald Temple, Rose Moon or Ocean Zodiac. The phone's dark/light mode is ignored. Saved to the customer's
 * account (and cached on the phone so it shows at once).
 */
@Injectable({ providedIn: 'root' })
export class AppThemeService {
  private pbs = inject(PbService);
  readonly theme = signal<AppTheme>(readLocal());

  constructor() {
    apply(this.theme());
    // Logged out (from any screen): back to the default, so the next person starts fresh.
    this.pbs.pb.authStore.onChange((token) => {
      if (!token) this.use(DEFAULT_APP_THEME);
    });
  }

  /** After login / app start: use the theme saved on the account. */
  syncFromAccount(): void {
    // Nothing chosen on the account yet: the default theme.
    const t = normal(this.pbs.user?.['app_theme']) ?? DEFAULT_APP_THEME;
    if (t !== this.theme()) this.use(t);
  }

  async set(t: AppTheme): Promise<void> {
    this.use(t);
    const id = this.pbs.user?.id;
    if (!id) return;
    await this.pbs.pb.collection('users').update(id, { app_theme: t });
    await this.pbs.pb.collection('users').authRefresh();
  }

  /** Back to the default theme (Sunrise Orange); the account's choice is cleared. */
  async reset(): Promise<void> {
    this.use(DEFAULT_APP_THEME);
    const id = this.pbs.user?.id;
    if (!id) return;
    await this.pbs.pb.collection('users').update(id, { app_theme: '' });
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
    return normal(localStorage.getItem(KEY)) ?? DEFAULT_APP_THEME;
  } catch {
    return DEFAULT_APP_THEME;
  }
}

/** Puts the theme class on <html> (plus Ionic's dark palette for the dark themes). */
export function apply(t: AppTheme): void {
  const el = document.documentElement;
  for (const x of ['classic', 'lavender', 'dark', ...APP_THEMES.map((a) => a.id)]) el.classList.remove('app-theme-' + x);
  const th = APP_THEMES.find((x) => x.id === t) ?? APP_THEMES[0];
  el.classList.toggle('ion-palette-dark', th.dark);
  el.classList.add('app-theme-' + th.id);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', th.bar);
}
