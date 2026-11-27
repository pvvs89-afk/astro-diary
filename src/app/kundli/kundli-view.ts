// Turns the stored Prokerala response into simple values for the kundli page.
// Every field is read defensively: if Prokerala leaves something out,
// that part of the page is simply hidden instead of breaking.

//
// Languages: Prokerala is only ever asked in English (other languages cost double).
// Every name - rasi, planet, nakshatra, lords, months, dasha - is shown in the chosen
// language from our own lists (astro-names.ts). Longer texts Prokerala writes
// (yoga and mangal dosha descriptions, nakshatra extras) stay in English.
// Kundlis that already have a translated report saved in data.langs still use it.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { LangCode, MONTH_NAMES, RASI_NAMES, nakshatraName, planetName, planetShort } from '../i18n/astro-names';
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
  /** text = short chart label; full = planet name for screen readers. */
  items: { text: string; full: string; asc: boolean; retro: boolean }[];
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
  /** Lords of the 12 houses from the Rasi chart (empty when the Lagna is unknown). */
  houseLords: HouseLordRow[];
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

/**
 * Always true now: every language is shown from the English report with our own
 * name lists, so nothing has to be fetched from Prokerala for another language.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function hasLanguage(data: any, lang: LangCode): boolean {
  return true;
}

/** Planet lord in the chosen language ("Mars" -> "కుజుడు"); English keeps Prokerala's vedic name. */
function lordName(lord: any, lang: LangCode): string {
  if (!lord) return '';
  return lang === 'en' ? str(lord.vedic_name || lord.name) : planetName(str(lord.name), lang);
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
    rasiLord: lordName(p?.rasi?.lord, lang),
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
    ? (lang === 'en' || lk !== k ? str(db.description) : '') ||
      [planetName(str(db.lord?.name), lang), str(db.duration)].filter(Boolean).join(' – ')
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
    nakshatra: lk === k ? nakshatraName(nd.nakshatra?.id, str(nd.nakshatra?.name), lang) : str(nd.nakshatra?.name),
    nakshatraLord: lk === k ? lordName(nd.nakshatra?.lord, lang) : str(nd.nakshatra?.lord?.vedic_name || nd.nakshatra?.lord?.name),
    pada: str(nd.nakshatra?.pada),
    moonRasi: lk === k ? rasiName(Number(nd.chandra_rasi?.id), str(nd.chandra_rasi?.name)) : str(nd.chandra_rasi?.name),
    moonRasiLord: lk === k ? lordName(nd.chandra_rasi?.lord, lang) : str(nd.chandra_rasi?.lord?.vedic_name || nd.chandra_rasi?.lord?.name),
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
    // Prokerala's Navamsa if stored (older kundlis), else calculated here from the
    // planet positions - same result, no extra Prokerala call.
    navamsa: buildNavamsa(data.navamsa, lang) ?? navamsaFromPlanets(planetsRaw, lang),
    houseLords: buildHouseLords(planetsRaw, lang),
  };
}

// ---------------------------------------------------------------------------
// 12 house lords (bhava adhipati) from the Rasi chart: whole-sign houses counted
// from the Lagna. For each house: its rasi, the rasi's lord, and where that lord
// sits (house and rasi), with own sign / exalted / debilitated marks.
// ---------------------------------------------------------------------------
export interface HouseLordRow {
  house: number;
  rasi: string;
  lord: string;
  lordHouse: number | null;
  lordRasi: string;
  /** '' | 'own' | 'exalted' | 'debilitated' */
  status: '' | 'own' | 'exalted' | 'debilitated';
}

/** Lord of each rasi, Mesha (0) to Meena (11). */
const RASI_LORD = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];
const OWN_SIGNS: Record<string, number[]> = { Sun: [4], Moon: [3], Mars: [0, 7], Mercury: [2, 5], Jupiter: [8, 11], Venus: [1, 6], Saturn: [9, 10] };
const EXALTED: Record<string, number> = { Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3, Venus: 11, Saturn: 6 };

export const HOUSE_LORD_TEXT: Record<LangCode, { title: string; hint: string; house: string; rasi: string; lord: string; placed: string; own: string; exalted: string; debilitated: string; results: string; resultTitle: string; resultsNote: string }> = {
  en: { title: 'Lords of the 12 houses', hint: 'From the Rasi chart, counting houses from the Lagna.', house: 'House', rasi: 'Rasi', lord: 'Lord', placed: 'Lord sits in', own: 'Own sign', exalted: 'Exalted', debilitated: 'Debilitated', results: 'What your house lords mean', resultTitle: 'Lord of house {h} ({l}) in house {p}', resultsNote: '' },
  hi: { title: '12 भावों के स्वामी', hint: 'राशि चार्ट से, लग्न से भाव गिनकर।', house: 'भाव', rasi: 'राशि', lord: 'स्वामी', placed: 'स्वामी की स्थिति', own: 'स्वराशि', exalted: 'उच्च', debilitated: 'नीच', results: 'आपके भाव स्वामियों के फल', resultTitle: 'भाव {h} का स्वामी ({l}) भाव {p} में', resultsNote: 'फल अभी अंग्रेज़ी में दिखाए गए हैं।' },
  ta: { title: '12 பாவ அதிபதிகள்', hint: 'ராசி கட்டத்திலிருந்து, லக்னத்திலிருந்து பாவங்களை எண்ணி.', house: 'பாவம்', rasi: 'ராசி', lord: 'அதிபதி', placed: 'அதிபதி இருக்கும் இடம்', own: 'ஆட்சி', exalted: 'உச்சம்', debilitated: 'நீசம்', results: 'உங்கள் பாவ அதிபதிகளின் பலன்கள்', resultTitle: '{h}-ஆம் பாவ அதிபதி ({l}) {p}-ஆம் பாவத்தில்', resultsNote: 'பலன்கள் தற்போது ஆங்கிலத்தில் உள்ளன.' },
  te: { title: '12 భావాధిపతులు', hint: 'రాశి చక్రం నుండి, లగ్నం నుండి భావాలను లెక్కించి.', house: 'భావం', rasi: 'రాశి', lord: 'అధిపతి', placed: 'అధిపతి ఉన్న స్థానం', own: 'స్వక్షేత్రం', exalted: 'ఉచ్ఛ', debilitated: 'నీచ', results: 'మీ భావాధిపతుల ఫలితాలు', resultTitle: '{h}వ భావాధిపతి ({l}) {p}వ భావంలో', resultsNote: '' },
  ml: { title: '12 ഭാവാധിപന്മാർ', hint: 'രാശി ചക്രത്തിൽ നിന്ന്, ലഗ്നം മുതൽ ഭാവങ്ങൾ എണ്ണി.', house: 'ഭാവം', rasi: 'രാശി', lord: 'അധിപൻ', placed: 'അധിപൻ നിൽക്കുന്നത്', own: 'സ്വക്ഷേത്രം', exalted: 'ഉച്ചം', debilitated: 'നീചം', results: 'നിങ്ങളുടെ ഭാവാധിപന്മാരുടെ ഫലങ്ങൾ', resultTitle: '{h}-ാം ഭാവാധിപൻ ({l}) {p}-ാം ഭാവത്തിൽ', resultsNote: 'ഫലങ്ങൾ ഇപ്പോൾ ഇംഗ്ലീഷിൽ ആണ്.' },
};

/** "Lord of house {h} ({l}) in house {p}" with the values filled in. */
export function houseLordTitle(template: string, row: HouseLordRow): string {
  return template.replace('{h}', String(row.house)).replace('{l}', row.lord).replace('{p}', String(row.lordHouse ?? ''));
}

function buildHouseLords(planetsRaw: any[], lang: LangCode): HouseLordRow[] {
  const rasiOf = (name: string): number | null => {
    const p = planetsRaw.find((x) => str(x?.name) === name);
    if (!p) return null;
    const id = Number(p?.rasi?.id);
    if (Number.isInteger(id) && id >= 0 && id < 12) return id;
    const lon = Number(p?.longitude);
    return isFinite(lon) ? Math.floor((((lon % 360) + 360) % 360) / 30) : null;
  };
  const lagna = rasiOf('Ascendant');
  if (lagna === null) return [];
  return Array.from({ length: 12 }, (_, i) => {
    const rasiId = (lagna + i) % 12;
    const lordEn = RASI_LORD[rasiId];
    const at = rasiOf(lordEn);
    let status: HouseLordRow['status'] = '';
    if (at !== null) {
      if (EXALTED[lordEn] === at) status = 'exalted';
      else if ((EXALTED[lordEn] + 6) % 12 === at) status = 'debilitated';
      else if (OWN_SIGNS[lordEn]?.includes(at)) status = 'own';
    }
    return {
      house: i + 1,
      rasi: RASI_NAMES[lang][rasiId],
      lord: planetName(lordEn, lang),
      lordHouse: at === null ? null : ((at - lagna + 12) % 12) + 1,
      lordRasi: at === null ? '' : RASI_NAMES[lang][at],
      status,
    };
  });
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
      .map((p) => ({
        text: p.short,
        full: planetName(p.name, lang),
        asc: p.name === 'Ascendant',
        retro: p.retro && p.name !== 'Ascendant',
      })),
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

/**
 * Navamsa (D9) from sidereal longitudes: each sign is split into 9 parts of 3°20';
 * counting those parts from 0° Aries, the part number mod 12 is the navamsa sign.
 * (Checked against Prokerala's divisional chart: 30 of 30 positions matched.)
 */
export function navamsaSign(longitude: number): number {
  const lon = ((longitude % 360) + 360) % 360;
  return Math.floor((lon * 9) / 30) % 12;
}

function navamsaFromPlanets(planetsRaw: any[], lang: LangCode): ChartCell[] | null {
  const planets: ChartPlanet[] = [];
  let lagnaRasiId: number | undefined;
  for (const p of planetsRaw ?? []) {
    const name = str(p?.name);
    const lon = Number(p?.longitude);
    if (!name || !isFinite(lon)) continue;
    const rasiId = navamsaSign(lon);
    if (name === 'Ascendant') lagnaRasiId = rasiId;
    planets.push({ name, short: planetShort(name, lang), rasiId, retro: !!p?.is_retrograde });
  }
  return planets.length ? southChart(planets, lagnaRasiId, lang) : null;
}

/**
 * Text description of a chart for screen readers, e.g.
 * "Rasi chart. Mesha: Ascendant. Simha: Mars, Jupiter (R). Other signs empty."
 */
export function chartSummary(cells: ChartCell[] | null | undefined, title: string, retroMark = '(R)'): string {
  if (!cells?.length) return title;
  const filled = cells
    .filter((c) => c.items.length)
    .map((c) => `${c.rasi}: ${c.items.map((i) => i.full + (i.retro ? ' ' + retroMark : '')).join(', ')}`);
  return `${title}. ${filled.join('. ')}.`;
}

/** "1990-05-12T06:30:00+05:30" -> "12 May 1990, 6:30 am" (birth time as entered). */
export function birthText(iso: string, lang: LangCode = 'en'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  const months = MONTH_NAMES[lang];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}, ${m[4]}:${m[5]}`;
}
