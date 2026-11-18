// Vimshottari dasha from the Moon's sidereal (Lahiri) longitude - standard formula,
// so match making needs no extra Prokerala credits for dashas.
//   Nakshatra = Moon longitude / 13°20'. Its lord starts the cycle; the part of the
//   nakshatra already passed at birth = part of that first dasha already over.
// Years: Ketu 7, Venus 20, Sun 6, Moon 10, Mars 7, Rahu 18, Jupiter 16, Saturn 19, Mercury 17 (= 120).
// Year = 365.25 days, so dates can differ by a day or two from other software.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { LangCode, MONTH_NAMES, planetName } from '../i18n/astro-names';

const LORDS = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
const YEARS = [7, 20, 6, 10, 7, 18, 16, 19, 17];
const YEAR_MS = 365.25 * 86_400_000;
const NAK = 360 / 27;

export interface DashaPeriod {
  name: string;
  start: string;
  end: string;
  current: boolean;
  antardasha: { name: string; start: string; end: string; current: boolean }[];
}

export interface VimshottariResult {
  /** e.g. "Venus 12y 4m 3d" (what remained of the first dasha at birth). */
  balance: string;
  dashas: DashaPeriod[];
}

/** The Moon's longitude (0-360°) from a Prokerala planet-position answer. */
export function moonLongitude(planetData: any): number | null {
  const list: any[] = planetData?.planet_position ?? [];
  const moon = list.find((p) => p?.name === 'Moon' || Number(p?.id) === 1);
  if (!moon) return null;
  const lon = Number(moon.longitude);
  if (isFinite(lon)) return ((lon % 360) + 360) % 360;
  const rasi = Number(moon.rasi?.id);
  const deg = Number(moon.degree);
  return isFinite(rasi) && isFinite(deg) ? rasi * 30 + deg : null;
}

function fmt(ms: number, lang: LangCode): string {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')} ${MONTH_NAMES[lang][d.getMonth()]} ${d.getFullYear()}`;
}

function ymd(years: number): string {
  const y = Math.floor(years);
  const mFloat = (years - y) * 12;
  const m = Math.floor(mFloat);
  const d = Math.round((mFloat - m) * 30.4375);
  return `${y}y ${m}m ${d}d`;
}

/**
 * @param moonLon Moon's sidereal longitude in degrees
 * @param birthIso birth date-time with offset, e.g. "1990-05-12T06:30:00+05:30"
 */
export function vimshottari(moonLon: number, birthIso: string, lang: LangCode = 'en'): VimshottariResult | null {
  const birth = new Date(birthIso).getTime();
  if (!isFinite(moonLon) || !isFinite(birth)) return null;

  const nakIndex = Math.floor(moonLon / NAK);
  const passed = (moonLon - nakIndex * NAK) / NAK; // 0..1 of the nakshatra already passed
  const first = nakIndex % 9;
  const now = Date.now();

  // The first mahadasha began before birth.
  let start = birth - passed * YEARS[first] * YEAR_MS;
  const dashas: DashaPeriod[] = [];
  for (let i = 0; i < 9; i++) {
    const md = (first + i) % 9;
    const mdLen = YEARS[md] * YEAR_MS;
    const end = start + mdLen;

    const antardasha = [];
    let aStart = start;
    for (let j = 0; j < 9; j++) {
      const ad = (md + j) % 9;
      const aEnd = aStart + (YEARS[md] * YEARS[ad] * YEAR_MS) / 120;
      antardasha.push({
        name: planetName(LORDS[ad], lang),
        start: fmt(aStart, lang),
        end: fmt(aEnd, lang),
        current: aStart <= now && now < aEnd,
      });
      aStart = aEnd;
    }

    dashas.push({
      name: planetName(LORDS[md], lang),
      start: fmt(start, lang),
      end: fmt(end, lang),
      current: start <= now && now < end,
      antardasha,
    });
    start = end;
  }

  return {
    balance: `${planetName(LORDS[first], lang)} ${ymd((1 - passed) * YEARS[first])}`,
    dashas,
  };
}
