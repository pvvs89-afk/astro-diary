import { Injectable, signal } from '@angular/core';
import { ClientResponseError } from 'pocketbase';
import { LangCode, MONTH_NAMES } from './astro-names';
import { Dict, Key, en } from './en';

export type { LangCode } from './astro-names';

/** The languages Prokerala gives kundli reports in. */
export const LANGUAGES: { code: LangCode; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'ml', label: 'മലയാളം' },
];

const STORAGE_KEY = 'ad-lang';

// Each language file is downloaded only when it is chosen, keeping the app light.
const LOADERS: Record<Exclude<LangCode, 'en'>, () => Promise<{ dict: Dict }>> = {
  hi: () => import('./hi'),
  ta: () => import('./ta'),
  te: () => import('./te'),
  ml: () => import('./ml'),
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  /** Current language code. */
  readonly lang = signal<LangCode>('en');
  private readonly dict = signal<Dict>(en);

  constructor() {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      saved = null;
    }
    const code = LANGUAGES.find((l) => l.code === saved)?.code ?? 'en';
    void this.use(code);
  }

  get label(): string {
    return LANGUAGES.find((l) => l.code === this.lang())?.label ?? 'English';
  }

  /** Short month names in the current language (Jan..Dec). */
  months(): string[] {
    return MONTH_NAMES[this.lang()];
  }

  async use(code: LangCode): Promise<void> {
    const dict = code === 'en' ? en : (await LOADERS[code]()).dict;
    this.dict.set(dict);
    this.lang.set(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* private mode - language just isn't remembered */
    }
    document.documentElement.lang = code;
  }

  /**
   * Text for a key in the current language, e.g. t('namaste_name', { name: 'Ravi' }).
   * Reads a signal, so templates update instantly when the language changes.
   */
  readonly t = (key: Key, params?: Record<string, string | number>): string => {
    let text = this.dict()[key] ?? en[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) text = text.replace(`{${k}}`, String(v));
    }
    return text;
  };

  /** Turns a server error into a short message in the current language. */
  err(e: unknown): string {
    if (e instanceof ClientResponseError) {
      if (e.status === 0) return this.t('err_server');
      const data = e.response?.['data'] as Record<string, { message?: string }> | undefined;
      if (data && typeof data === 'object') {
        const key = Object.keys(data)[0];
        if (key && data[key]?.message) return `${key}: ${data[key].message}`;
      }
      const msg = e.response?.['message'];
      if (typeof msg === 'string' && msg) return msg;
    }
    return this.t('err_generic');
  }
}
