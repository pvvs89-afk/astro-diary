// Turns a saved Prokerala match report into simple values for the match page.
// Read defensively: if Prokerala leaves something out, that part is hidden.

/* eslint-disable @typescript-eslint/no-explicit-any */

// Languages: the report is fetched from Prokerala once, in English. In other languages
// the koota / porutham names, nakshatras and rasis come from our own lists; the longer
// descriptions stay as Prokerala wrote them.

import { LangCode, RASI_NAMES, matchPartName, nakshatraName } from '../i18n/astro-names';

export type Verdict = 'verdict_low' | 'verdict_avg' | 'verdict_good' | 'verdict_excellent';

export interface MatchRow {
  name: string;
  boy: string;
  girl: string;
  max: number | null;
  got: number | null;
  /** Porutham: present or not. Ashta Koota: null. */
  ok: boolean | null;
  area: string;
  text: string;
}

export interface MangalInfo {
  has: boolean;
  text: string;
}

export interface MatchView {
  method: 'ashta_koota' | 'porutham';
  boyName: string;
  girlName: string;
  score: number | null;
  max: number;
  verdict: Verdict | null;
  /** Prokerala's summary: type "good" / "bad" / ... and a sentence. */
  message: { type: string; text: string } | null;
  rows: MatchRow[];
  boyMangal: MangalInfo | null;
  girlMangal: MangalInfo | null;
  boyStar: string;
  girlStar: string;
  notes: string[];
}

const str = (v: any): string => (v === null || v === undefined ? '' : String(v));
const num = (v: any): number | null => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v));
const pick = (...vals: any[]): any => vals.find((v) => v !== undefined && v !== null && v !== '');

function mangal(m: any): MangalInfo | null {
  if (!m || typeof m !== 'object') return null;
  return { has: !!pick(m.has_dosha, m.is_present, false), text: str(pick(m.description, m.dosha_type)) };
}

function star(info: any, lang: LangCode, translate: boolean): string {
  if (!info) return '';
  let nak = str(pick(info.nakshatra?.name, info.nakshatra));
  let rasi = str(pick(info.rasi?.name, info.rasi));
  if (translate) {
    if (info.nakshatra && typeof info.nakshatra === 'object') nak = nakshatraName(info.nakshatra.id, nak, lang);
    const rid = Number(info.rasi?.id);
    if (Number.isInteger(rid) && rid >= 0 && rid < 12) rasi = RASI_NAMES[lang][rid];
  }
  return [nak, rasi].filter((x) => x && x !== '[object Object]').join(' · ');
}

/** Ashta Koota bands: below 18 not recommended, 18-24 average, 25-32 good, above 32 excellent. */
function verdictFor(method: string, score: number | null, max: number): Verdict | null {
  if (score === null) return null;
  const s = method === 'porutham' ? (score / max) * 36 : score;
  if (s < 18) return 'verdict_low';
  if (s < 25) return 'verdict_avg';
  if (s <= 32) return 'verdict_good';
  return 'verdict_excellent';
}

/** Always true now: other languages are shown from the saved report with our own names. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function hasMatchLanguage(rec: any, lang: string): boolean {
  return true;
}

const LANGS: LangCode[] = ['en', 'hi', 'ta', 'te', 'ml'];

export function buildMatchView(rec: any, lang = ''): MatchView | null {
  if (!rec?.data) return null;
  // Report text in the chosen language when stored, else the language it was made in.
  const made = rec.language || 'en';
  const r = (lang && lang !== made && rec.data.langs?.[lang]?.report) || rec.data.report || {};
  const method: 'ashta_koota' | 'porutham' = rec.method === 'porutham' ? 'porutham' : 'ashta_koota';
  // Translate names ourselves when the saved report isn't in the chosen language.
  const want = (LANGS as string[]).includes(lang) ? (lang as LangCode) : null;
  const translate = !!want && r === rec.data.report && want !== made;
  const tl = want ?? 'en';
  const partName = (n: string) => (translate ? matchPartName(n, method, tl) : n);

  let rows: MatchRow[] = [];
  if (method === 'ashta_koota') {
    const gm = r.guna_milan ?? {};
    const list: any[] = pick(gm.guna, gm.gunas, r.guna, r.gunas) ?? [];
    rows = (Array.isArray(list) ? list : []).map((g) => ({
      name: partName(str(pick(g.name, g.koot, g.title))),
      boy: str(pick(g.boy_koot, g.boy_value, g.boy)),
      girl: str(pick(g.girl_koot, g.girl_value, g.girl)),
      max: num(pick(g.maximum_points, g.max_points, g.total)),
      got: num(pick(g.obtained_points, g.points, g.received_points)),
      ok: null,
      area: str(pick(g.area_of_life, g.area)),
      text: str(g.description),
    }));
  } else {
    const list: any[] = pick(r.matches, r.porutham, r.poruthams) ?? [];
    rows = (Array.isArray(list) ? list : []).map((m) => {
      const got = num(pick(m.points, m.obtained_points));
      return {
        name: partName(str(pick(m.name, m.title))),
        boy: '',
        girl: '',
        max: num(pick(m.maximum_points, m.max_points)),
        got,
        ok: m.has_porutham !== undefined ? !!m.has_porutham : got !== null ? got > 0 : null,
        area: '',
        text: str(m.description),
      };
    });
  }

  const gm = r.guna_milan ?? {};
  const score = num(pick(rec.score, gm.total_points, r.total_points));
  const max = num(pick(rec.max_score, gm.maximum_points, r.maximum_points)) ?? (method === 'porutham' ? 10 : 36);
  const msg = r.message;

  const notes: string[] = [];
  for (const x of Array.isArray(r.exceptions) ? r.exceptions : []) notes.push(str(typeof x === 'object' ? pick(x.description, x.name) : x));

  return {
    method,
    boyName: str(rec.boy_name),
    girlName: str(rec.girl_name),
    score,
    max,
    verdict: verdictFor(method, score, max),
    message: msg ? { type: str(msg.type), text: str(pick(msg.description, msg.text)) } : null,
    rows: rows.filter((x) => x.name),
    boyMangal: mangal(pick(r.boy_mangal_dosha_details, r.boy_mangal_dosha)),
    girlMangal: mangal(pick(r.girl_mangal_dosha_details, r.girl_mangal_dosha)),
    boyStar: star(r.boy_info, tl, translate),
    girlStar: star(r.girl_info, tl, translate),
    notes: notes.filter(Boolean),
  };
}
