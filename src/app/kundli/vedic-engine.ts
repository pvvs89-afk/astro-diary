import * as A from 'astronomy-engine';

/**
 * Astro Diary's own astrology engine - no Prokerala.
 *
 * Planet positions from Astronomy Engine (MIT licence, VSOP87 / NOVAS models), turned
 * into Vedic (sidereal) positions with the Lahiri ayanamsa (Swiss Ephemeris definition:
 * 23.245524743° at 21 Mar 1956 + IAU 1976 precession, plus nutation). Rahu/Ketu use
 * the mean lunar node, like Prokerala. Tested against Prokerala charts: within about
 * 20 arc-seconds, same rasi, nakshatra and pada.
 */
export type GrahaKey = 'Sun' | 'Moon' | 'Mars' | 'Mercury' | 'Jupiter' | 'Venus' | 'Saturn' | 'Rahu' | 'Ketu' | 'Ascendant';

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const norm = (x: number) => ((x % 360) + 360) % 360;

/** Julian centuries (TT) since J2000.0. */
const centuries = (t: A.AstroTime) => t.tt / 36525;

/** Lahiri ayanamsa (mean), degrees. */
export function lahiriAyanamsa(t: A.AstroTime): number {
  const T = centuries(t);
  const T0 = (2435553.5 - 2451545.0) / 36525;
  const pA = (x: number) => (5029.0966 * x + 1.11113 * x * x - 0.000006 * x * x * x) / 3600;
  return 23.245524743 + (pA(T) - pA(T0));
}

/** Nutation in longitude (main IAU 1980 terms), degrees. */
function nutationLon(t: A.AstroTime): number {
  const T = centuries(t);
  const om = (125.04452 - 1934.136261 * T) * D2R;
  const L = (280.4665 + 36000.7698 * T) * D2R;
  const Lm = (218.3165 + 481267.8813 * T) * D2R;
  return (-17.2 * Math.sin(om) - 1.32 * Math.sin(2 * L) - 0.23 * Math.sin(2 * Lm) + 0.21 * Math.sin(2 * om)) / 3600;
}

function obliquity(t: A.AstroTime): number {
  const T = centuries(t);
  const mean = 23.439291111 - (46.815 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600;
  return mean + 0.00256 * Math.cos((125.04 - 1934.136 * T) * D2R);
}

/** Mean lunar node (Rahu), tropical degrees. */
function meanNode(t: A.AstroTime): number {
  const T = centuries(t);
  return norm(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + (T * T * T) / 467441 - T ** 4 / 60616000);
}

function tropical(body: 'Sun' | 'Moon' | 'Mars' | 'Mercury' | 'Jupiter' | 'Venus' | 'Saturn', t: A.AstroTime): number {
  if (body === 'Moon') return A.EclipticGeoMoon(t).lon;
  if (body === 'Sun') return A.SunPosition(t).elon;
  return A.Ecliptic(A.GeoVector(body as A.Body, t, true)).elon;
}

/** Tropical ascendant for a place (latitude, east longitude in degrees). */
function ascendant(t: A.AstroTime, lat: number, lon: number): number {
  const ramc = norm(A.SiderealTime(t) * 15 + lon) * D2R;
  const eps = obliquity(t) * D2R;
  const phi = lat * D2R;
  return norm(Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps))) * R2D);
}

/**
 * Sidereal (Lahiri) longitudes of the grahas and the Lagna for a birth.
 * @param iso birth date-time with its UTC offset, e.g. "1990-05-12T06:30:00+05:30"
 * @returns null when the input is not usable
 */
export function siderealPositions(iso: string, lat: number, lon: number): Record<GrahaKey, number> | null {
  const date = new Date(iso);
  if (isNaN(date.getTime()) || !isFinite(lat) || !isFinite(lon)) return null;
  const t = A.MakeTime(date);
  const ay = lahiriAyanamsa(t) + nutationLon(t);
  const out = {} as Record<GrahaKey, number>;
  for (const b of ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'] as const) out[b] = norm(tropical(b, t) - ay);
  out.Rahu = norm(meanNode(t) + nutationLon(t) - ay);
  out.Ketu = norm(out.Rahu + 180);
  out.Ascendant = norm(ascendant(t, lat, lon) - ay);
  return out;
}

/** Rasi number 0 (Mesha) .. 11 (Meena) of a sidereal longitude. */
export const rasiOf = (lon: number) => Math.floor(norm(lon) / 30);
