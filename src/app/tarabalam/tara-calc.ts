// Tara Balam, calculated on the phone - no Prokerala call.
//
// Moon: Jean Meeus, "Astronomical Algorithms" (2nd ed.), chapter 47 - the published
//   series for the Moon's longitude (accurate to about 10 arc-seconds; the Moon moves
//   that far in about 20 seconds of time).
// Nutation: Meeus chapter 22 (main terms).  Sunrise: Meeus / NOAA solar formulas.
// Sidereal = tropical - Lahiri ayanamsa (Swiss Ephemeris "Lahiri": 22.460148° at
//   J1900 + general precession).
// The day's star is the one in force at local sunrise (panchang custom).

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
/** One nakshatra = 13°20'. */
export const NAK = 360 / 27;
/** TT - UT, about 69 s in the 2020s (only shifts times by about a second). */
const DELTA_T_DAYS = 69 / 86_400;

const norm = (x: number) => ((x % 360) + 360) % 360;
const sin = (d: number) => Math.sin(d * RAD);
const cos = (d: number) => Math.cos(d * RAD);

/** Julian centuries (TT) since J2000.0 for a JS time in ms. */
function centuries(ms: number): number {
  const jd = ms / DAY_MS + 2440587.5 + DELTA_T_DAYS;
  return (jd - 2451545.0) / 36525;
}

// Meeus table 47.A (longitude terms): D, M, M', F, coefficient (1e-6 degree).
const TERMS: [number, number, number, number, number][] = [
  [0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314], [0, 0, 2, 0, 213618],
  [0, 1, 0, 0, -185116], [0, 0, 0, 2, -114332], [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066],
  [2, 0, 1, 0, 53322], [2, -1, 0, 0, 45758], [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720],
  [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528], [0, 0, 1, -2, 10980],
  [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034], [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888],
  [2, 1, 0, 0, -6766], [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036],
  [2, 0, 2, 0, 3994], [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665], [0, 1, -2, 0, -2689],
  [2, 0, -1, 2, -2602], [2, -1, -2, 0, 2390], [1, 0, 1, 0, -2348], [2, -2, 0, 0, 2236],
  [0, 1, 2, 0, -2120], [0, 2, 0, 0, -2069], [2, -2, -1, 0, 2048], [2, 0, 1, -2, -1773],
  [2, 0, 0, 2, -1595], [4, -1, -1, 0, 1215], [0, 0, 2, 2, -1110], [3, 0, -1, 0, -892],
  [2, 1, 1, 0, -810], [4, -1, -2, 0, 759], [0, 2, -1, 0, -713], [2, 2, -1, 0, -700],
  [2, 1, -2, 0, 691], [2, -1, 0, -2, 596], [4, 0, 1, 0, 549], [0, 0, 4, 0, 537],
  [4, -1, 0, 0, 520], [1, 0, -2, 0, -487], [2, 1, 0, -2, -399], [0, 0, 2, -2, -381],
  [1, 1, 1, 0, 351], [3, 0, -2, 0, -340], [4, 0, -3, 0, 330], [2, -1, 2, 0, 327],
  [0, 2, 1, 0, -323], [1, 1, -1, 0, 299], [2, 0, 3, 0, 294],
];

/** Nutation in longitude, degrees (Meeus ch. 22, main terms). */
function nutationLon(T: number): number {
  const om = 125.04452 - 1934.136261 * T;
  const ls = 280.4665 + 36000.7698 * T;
  const lm = 218.3165 + 481267.8813 * T;
  return (-17.2 * sin(om) - 1.32 * sin(2 * ls) - 0.23 * sin(2 * lm) + 0.21 * sin(2 * om)) / 3600;
}

/** The Moon's apparent tropical longitude (degrees) at a JS time. */
export function moonTropical(ms: number): number {
  const T = centuries(ms);
  const T2 = T * T, T3 = T2 * T, T4 = T3 * T;
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000;
  const F = 93.272095 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const A1 = 119.75 + 131.849 * T;
  const A2 = 53.09 + 479264.29 * T;
  let sl = 0;
  for (const [d, m, mp, f, c] of TERMS) {
    const e = m === 0 ? 1 : Math.abs(m) === 1 ? E : E * E;
    sl += c * e * sin(d * D + m * M + mp * Mp + f * F);
  }
  sl += 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2);
  return norm(Lp + sl / 1e6 + nutationLon(T));
}

/** Lahiri ayanamsa (degrees) at a JS time. */
export function lahiri(ms: number): number {
  const T = centuries(ms); // from J2000
  // 23.857092° at J2000 (= 22.460148° at J1900 + precession), 5028.796"/century.
  return 23.857092 + (5028.796195 * T + 1.1054348 * T * T) / 3600;
}

/** The Moon's sidereal (Lahiri) longitude, 0-360. */
export function moonSidereal(ms: number): number {
  return norm(moonTropical(ms) - lahiri(ms));
}

/** Nakshatra index 0 (Ashwini) .. 26 (Revati) at a JS time. */
export function nakshatraAt(ms: number): number {
  return Math.floor(moonSidereal(ms) / NAK) % 27;
}

/** When the Moon reaches sidereal longitude `target`, searching from `fromMs` (either way). */
function moonReaches(target: number, fromMs: number): number {
  let t = fromMs;
  for (let i = 0; i < 12; i++) {
    let d = norm(target - moonSidereal(t));
    if (d > 180) d -= 360;
    if (Math.abs(d) < 1e-6) break;
    t += (d / 13.176) * DAY_MS; // Moon's mean speed 13.176°/day
  }
  return t;
}

/** Start and end time of the nakshatra in force at `ms`. */
export function nakshatraSpan(ms: number): { index: number; start: number; end: number } {
  const index = nakshatraAt(ms);
  const start = moonReaches(index * NAK, ms - 0.5 * DAY_MS);
  const end = moonReaches(((index + 1) % 27) * NAK, ms + 0.5 * DAY_MS);
  return { index, start, end };
}

/**
 * Sunrise (JS ms) on the local calendar day that starts at `dayStartMs`, for a place.
 * Sun's centre 0.833° below the horizon (refraction + half the disc), like panchangs.
 * Polar day/night (no sunrise) falls back to 6 a.m. local mean time.
 */
export function sunrise(dayStartMs: number, lat: number, lon: number): number {
  // Start from 6 a.m. local mean solar time, then refine twice.
  const utcMidnight = Date.UTC(
    new Date(dayStartMs + 12 * 3600_000).getUTCFullYear(),
    new Date(dayStartMs + 12 * 3600_000).getUTCMonth(),
    new Date(dayStartMs + 12 * 3600_000).getUTCDate(),
  );
  let t = utcMidnight + (6 - lon / 15) * 3600_000;
  // Pick the UTC date whose local morning falls on the wanted local day.
  if (t < dayStartMs) t += DAY_MS;
  if (t > dayStartMs + DAY_MS) t -= DAY_MS;
  for (let i = 0; i < 3; i++) {
    const T = centuries(t);
    const L0 = norm(280.46646 + 36000.76983 * T);
    const M = 357.52911 + 35999.05029 * T;
    const e = 0.016708634 - 0.000042037 * T;
    const C = (1.914602 - 0.004817 * T) * sin(M) + (0.019993 - 0.000101 * T) * sin(2 * M) + 0.000289 * sin(3 * M);
    const om = 125.04 - 1934.136 * T;
    const lam = L0 + C - 0.00569 - 0.00478 * sin(om);
    const eps = 23.439291 - 0.0130042 * T + 0.00256 * cos(om);
    const decl = Math.asin(sin(eps) * sin(lam)) / RAD;
    const y = Math.tan((eps / 2) * RAD) ** 2;
    const eot =
      (4 / RAD) *
      (y * sin(2 * L0) - 2 * e * sin(M) + 4 * e * y * sin(M) * cos(2 * L0) - 0.5 * y * y * sin(4 * L0) - 1.25 * e * e * sin(2 * M)); // minutes
    const cosH = (cos(90.833) - sin(lat) * sin(decl)) / (cos(lat) * cos(decl));
    if (cosH < -1 || cosH > 1) break;
    const H = Math.acos(cosH) / RAD;
    const dayUtc = Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth(), new Date(t).getUTCDate());
    let rise = dayUtc + (720 - 4 * lon - eot - 4 * H) * 60_000;
    if (rise < t - 0.5 * DAY_MS) rise += DAY_MS;
    if (rise > t + 0.5 * DAY_MS) rise -= DAY_MS;
    t = rise;
  }
  return t;
}

/** Tara 1..9 for a day star, counting from the birth star (birth star = 1). */
export function taraNumber(birthIndex: number, dayIndex: number): number {
  const count = ((dayIndex - birthIndex + 27) % 27) + 1;
  return ((count - 1) % 9) + 1;
}

export type TaraResult = 'very_good' | 'good' | 'mixed' | 'bad' | 'very_bad';
/** Classical results: 2, 4, 6, 8 good; 9 very good; 3, 5 bad; 7 very bad; 1 mixed. */
export const TARA_RESULT: Record<number, TaraResult> = {
  1: 'mixed', 2: 'good', 3: 'bad', 4: 'good', 5: 'bad', 6: 'good', 7: 'very_bad', 8: 'good', 9: 'very_good',
};

export interface TaraDay {
  /** Local midnight of the day. */
  day: number;
  sunrise: number;
  /** Star at sunrise and its span. */
  star: number;
  starEnd: number;
  tara: number;
  /** The star that follows it the same day (before next sunrise), if any. */
  next?: { star: number; from: number; tara: number };
}

/** Star, tara and sunrise for `days` days from the local day containing `nowMs`. */
export function taraWeek(birthIndex: number, lat: number, lon: number, nowMs: number, days = 7): TaraDay[] {
  const first = new Date(nowMs);
  const out: TaraDay[] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i).getTime();
    const nextDay = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i + 1).getTime();
    const rise = sunrise(day, lat, lon);
    const nextRise = sunrise(nextDay, lat, lon);
    const span = nakshatraSpan(rise + 60_000);
    const d: TaraDay = { day, sunrise: rise, star: span.index, starEnd: span.end, tara: taraNumber(birthIndex, span.index) };
    if (span.end < nextRise) {
      const ns = (span.index + 1) % 27;
      d.next = { star: ns, from: span.end, tara: taraNumber(birthIndex, ns) };
    }
    out.push(d);
  }
  return out;
}
