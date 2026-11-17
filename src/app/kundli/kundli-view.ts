// Turns the stored Prokerala response into simple values for the kundli page.
// Every field is read defensively: if Prokerala leaves something out,
// that part of the page is simply hidden instead of breaking.

//
// Languages: the chart, planet table and dasha list are always built from the
// English data and shown with our own name lists (astro-names.ts). Texts that
// Prokerala writes (nakshatra details, mangal dosha, yogas, dasha balance) come
// from the translated report in data.langs[lang] once the server has fetched it.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { LangCode, MONTH_NAMES, RASI_NAMES, planetName, planetShort } from '../i18n/astro-names';
import { Key } from '../i18n/en';

/** South Indian chart: fixed grid cell (row, col) for each rasi id 0..11. */
const SOUTH_CELLS: [number, number][] = [
  [1, 2], // 0 Mesha
  [1, 3], // 1 Vrishabha
  [1, 4], // 2 Mithuna
  [2, 4], // 3 Karka
  [3, 4], // 4 Simha
  [4, 4], // 5 Kanya
  [4, 3], // 6 Tula
  [4, 2], // 7 Vrischika
  [4, 1], // 8 Dhanu
  [3, 1], // 9 Makara
  [2, 1], // 10 Kumbha
  [1, 1], // 11 Meena
];

export interface PlanetRow {
  /** English name from Prokerala (used as the key). */
  name: string;
  /** Name in the chosen language. */
  label: string;
  short: string;
  rasi: string;
  rasiId: number;
  rasiLord: string;
  degree: string;
  house: number | null;
  retro: boolean;
}

export interface ChartCell {
  rasiId: number;
  rasi: string;
  row: number;
  col: number;
  items: { text: string; asc: boolean; retro: boolean }[];
  isLagna: boolean;
}

export interface DashaRow {
  name: string;
  start: string;
  end: string;
  current: boolean;
  antardasha: { name: string; start: string; end: string; current: boolean }[];
}

export interface KundliView {
  name: string;
  datetime: string;
  place: string;
  nakshatra: string;
  nakshatraLord: string;
  pada: string;
  moonRasi: string;
  moonRasiLord: string;
  sunRasi: string;
  lagna: string;
  zodiac: string;
  extra: { label: Key; value: string }[];
  mangal: { hasDosha: boolean; text: string } | null;
  dashaBalance: string;
  dashas: DashaRow[];
  yogas: { name: string; text: string }[];
  planets: PlanetRow[];
  chart: ChartCell[];
  /** Navamsa (D9) chart; null when this kundli was made before Navamsa was added. */
  navamsa: ChartCell[] | null;
}

const str = (v: any): string => (v === null || v === undefined ? '' : String(v));

function degreeText(d: any): string {
  const n = Number(d);
  if (!isFinite(n)) return '';
  const deg = Math.floor(n);
  const min = Math.floor((n - deg) * 60);
  return `${deg}° ${String(min).padStart(2, '0')}'`;
}

/** "2031-04-12T..." -> "12 Apr 2031" with the month in the chosen language. */
function dateText(v: any, lang: LangCode): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(v));
  if (!m) return '';
  return `${m[3]} ${MONTH_NAMES[lang][Number(m[2]) - 1]} ${m[1]}`;
}

function isNow(start: any, end: any): boolean {
  const s = new Date(str(start)).getTime();
  const e = new Date(str(end)).getTime();
  const now = Date.now();
  return isFinite(s) && isFinite(e) && s <= now && now < e;
}

/** True when the translated report for this language is stored. */
export function hasLanguage(data: any, lang: LangCode): boolean {
  return lang === 'en' || !!data?.langs?.[lang]?.kundli;
}

export function buildKundliView(data: any, lang: LangCode = 'en'): KundliView | null {
  if (!data) return null;
  const k = data.kundli ?? {};
  // Translated report (texts only) - falls back to English until it is ready.
  const lk = (lang !== 'en' && data.langs?.[lang]?.kundli) || k;
  const nd = lk.nakshatra_details ?? {};
  const planetsRaw: any[] = data.planets?.planet_position ?? [];
  const rasiName = (id: number, fallback: string) =>
    Number.isInteger(id) && id >= 0 && id < 12 ? RASI_NAMES[lang][id] : fallback;

  // Planets
  const planets: PlanetRow[] = planetsRaw.map((p) => ({
    name: str(p?.name),
    label: planetName(str(p?.name), lang),
    short: planetShort(str(p?.name), lang),
    rasi: rasiName(Number(p?.rasi?.id), str(p?.rasi?.name)),
    rasiId: Number(p?.rasi?.id),
    rasiLord: str(p?.rasi?.lord?.vedic_name || p?.rasi?.lord?.name),
    degree: degreeText(p?.degree),
    house: p?.position !== undefined && p?.position !== null ? Number(p.position) : null,
    retro: !!p?.is_retrograde,
  }));

  const asc = planets.find((p) => p.name === 'Ascendant');

  // South Indian chart
  const chart = southChart(planets, asc?.rasiId, lang);

  // Extra nakshatra info
  const info = nd.additional_info ?? {};
  const extraLabels: [string, Key][] = [
    ['deity', 'deity'],
    ['ganam', 'ganam'],
    ['nadi', 'nadi'],
    ['animal_sign', 'yoni'],
    ['symbol', 'symbol'],
    ['color', 'lucky_colour'],
    ['best_direction', 'best_direction'],
    ['syllables', 'name_syllables'],
    ['birth_stone', 'birth_stone'],
  ];
  const extra = extraLabels
    .map(([key, label]) => ({ label, value: str(info[key]) }))
    .filter((x) => x.value);

  // Mangal dosha
  const md = lk.mangal_dosha ?? k.mangal_dosha;
  const mangal = md
    ? { hasDosha: !!md.has_dosha, text: str(md.description) }
    : null;

  // Dasha
  const dashas: DashaRow[] = (k.dasha_periods ?? []).map((d: any) => ({
    name: planetName(str(d?.name), lang),
    start: dateText(d?.start, lang),
    end: dateText(d?.end, lang),
    current: isNow(d?.start, d?.end),
    antardasha: (d?.antardasha ?? []).map((a: any) => ({
      name: planetName(str(a?.name), lang),
      start: dateText(a?.start, lang),
      end: dateText(a?.end, lang),
      current: isNow(a?.start, a?.end),
    })),
  }));

  const db = lk.dasha_balance ?? k.dasha_balance;
  const dashaBalance = db
    ? str(db.description) || [planetName(str(db.lord?.name), lang), str(db.duration)].filter(Boolean).join(' – ')
    : '';

  // Yogas (Prokerala groups them; flatten the ones that apply)
  const yogas: { name: string; text: string }[] = [];
  for (const group of lk.yoga_details ?? k.yoga_details ?? []) {
    const list = group?.yoga_list;
    if (Array.isArray(list)) {
      for (const y of list) {
        if (y?.has_yoga) yogas.push({ name: str(y.name), text: str(y.description) });
      }
    } else if (group?.name) {
      yogas.push({ name: str(group.name), text: str(group.description) });
    }
  }

  return {
    name: str(data.input?.name),
    datetime: str(data.input?.datetime),
    place: str(data.input?.place),
    nakshatra: str(nd.nakshatra?.name),
    nakshatraLord: str(nd.nakshatra?.lord?.vedic_name || nd.nakshatra?.lord?.name),
    pada: str(nd.nakshatra?.pada),
    moonRasi: lk === k ? rasiName(Number(nd.chandra_rasi?.id), str(nd.chandra_rasi?.name)) : str(nd.chandra_rasi?.name),
    moonRasiLord: str(nd.chandra_rasi?.lord?.vedic_name || nd.chandra_rasi?.lord?.name),
    sunRasi: lk === k ? rasiName(Number(nd.soorya_rasi?.id), str(nd.soorya_rasi?.name)) : str(nd.soorya_rasi?.name),
    lagna: asc ? `${asc.rasi} ${asc.degree}` : '',
    zodiac: str(nd.zodiac?.name),
    extra,
    mangal,
    dashaBalance,
    dashas,
    yogas,
    planets: planets.filter((p) => p.name !== 'Ascendant'),
    chart,
    navamsa: buildNavamsa(data.navamsa, lang),
  };
}

interface ChartPlanet {
  name: string;
  short: string;
  rasiId: number;
  retro: boolean;
}

/** South Indian grid: put each planet into the cell of its rasi. */
function southChart(planets: ChartPlanet[], lagnaRasiId: number | undefined, lang: LangCode): ChartCell[] {
  return SOUTH_CELLS.map(([row, col], rasiId) => ({
    rasiId,
    rasi: RASI_NAMES[lang][rasiId],
    row,
    col,
    isLagna: lagnaRasiId === rasiId,
    items: planets
      .filter((p) => p.rasiId === rasiId)
      .map((p) => ({ text: p.short, asc: p.name === 'Ascendant', retro: p.retro && p.name !== 'Ascendant' })),
  }));
}

/**
 * Prokerala divisional-planet-position (chart_type=navamsa):
 * { divisional_positions: [{ house, rasi, planet_positions: [{ name, ... }] }] }
 * Lagna is the rasi holding the Ascendant, or else the rasi of house 1.
 */
function buildNavamsa(d: any, lang: LangCode): ChartCell[] | null {
  const groups: any[] = d?.divisional_positions ?? [];
  if (!Array.isArray(groups) || !groups.length) return null;

  const planets: ChartPlanet[] = [];
  let lagnaRasiId: number | undefined;
  let house1RasiId: number | undefined;
  for (const g of groups) {
    const rasiId = Number(g?.rasi?.id);
    if (!Number.isInteger(rasiId) || rasiId < 0 || rasiId > 11) continue;
    if (Number(g?.house?.number ?? g?.house?.id) === 1) house1RasiId = rasiId;
    for (const p of g?.planet_positions ?? []) {
      const name = str(p?.name ?? p?.planet?.name);
      if (!name) continue;
      if (name === 'Ascendant') lagnaRasiId = rasiId;
      planets.push({
        name,
        short: planetShort(name, lang),
        rasiId,
        retro: !!p?.is_retrograde,
      });
    }
  }
  return planets.length ? southChart(planets, lagnaRasiId ?? house1RasiId, lang) : null;
}

/** "1990-05-12T06:30:00+05:30" -> "12 May 1990, 6:30 am" (birth time as entered). */
export function birthText(iso: string, lang: LangCode = 'en'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  const months = MONTH_NAMES[lang];
  const h = Number(m[4]);
  const ampm = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}, ${h12}:${m[5]} ${ampm}`;
}
