import { Injectable } from '@angular/core';
import tzlookup from '@photostructure/tz-lookup';
import PocketBase, { ClientResponseError, RecordModel } from 'pocketbase';

// Server address - change depending on where you test:
//   Browser (ionic serve):   http://127.0.0.1:8090
//   Android emulator:        http://10.0.2.2:8090
//   Real phone (same Wi-Fi): http://<laptop IPv4 from ipconfig>:8090
export const SERVER_URL = serverUrl();

/**
 * PocketBase address.
 *  - On the online server the apps run at https://app.<domain> / https://admin.<domain>
 *    and PocketBase at https://api.<domain> - worked out from the page address.
 *  - Everywhere else (ionic serve, Android emulator build) the local server.
 */
function serverUrl(): string {
  const local = 'http://127.0.0.1:8090';
  if (typeof location === 'undefined') return local;
  const m = /^(?:app|admin)\.(.+)$/.exec(location.hostname);
  return location.protocol === 'https:' && m ? `https://api.${m[1]}` : local;
}


export type PlaceKind = 'city' | 'town' | 'village' | 'locality' | 'other';

export interface Place {
  /** Full address, saved as the birth place. */
  name: string;
  lat: number;
  lon: number;
  /** Short place name, e.g. "Rajahmundry". */
  title?: string;
  /** District, state and country, e.g. "East Godavari, Andhra Pradesh, India". */
  area?: string;
  kind?: PlaceKind;
}

/** One person's birth details for match making. */
export interface PersonBirth {
  name: string;
  dob: string; // YYYY-MM-DD
  time: string; // HH:mm (24-hour)
  place: Place;
}

export type MatchMethod = 'ashta_koota' | 'porutham';

/** A plan with the price for this customer's country (worked out on the server). */
export interface PlanOffer {
  id: string;
  name: string;
  description: string;
  duration_months: number;
  price: number;
  currency: string;
}

export interface KundliState {
  birth: RecordModel | null;
  kundli: RecordModel | null;
}

@Injectable({ providedIn: 'root' })
export class PbService {
  // Login is remembered automatically (stored on the device).
  readonly pb = new PocketBase(SERVER_URL);

  constructor() {
    this.pb.autoCancellation(false);
  }

  get isLoggedIn(): boolean {
    return this.pb.authStore.isValid;
  }

  get user(): RecordModel | null {
    return this.pb.authStore.record;
  }

  /**
   * `phone` is saved as typed for India (10 digits) and as "+<code><number>"
   * for other countries. `country` can't be changed by the customer later.
   */
  async register(
    name: string,
    phone: string,
    email: string,
    password: string,
    country: string,
    state: string,
  ): Promise<void> {
    await this.pb.collection('users').create({
      name,
      phone,
      country,
      state,
      email,
      password,
      passwordConfirm: password,
    });
  }

  async login(email: string, password: string): Promise<void> {
    await this.pb.collection('users').authWithPassword(email, password);
  }

  logout(): void {
    this.pb.authStore.clear();
  }

  async hasBirthDetails(): Promise<boolean> {
    const res = await this.pb.collection('birth_details').getList(1, 1, {
      filter: this.pb.filter('user = {:uid}', { uid: this.user?.id ?? '' }),
    });
    return res.items.length > 0;
  }

  /** The customer's latest saved birth details, or null if none yet. */
  async latestBirthDetails(): Promise<RecordModel | null> {
    const res = await this.pb.collection('birth_details').getList(1, 1, {
      filter: this.pb.filter('user = {:uid}', { uid: this.user?.id ?? '' }),
      sort: '-created',
    });
    return res.items[0] ?? null;
  }

  async saveBirthDetails(d: {
    fullName: string;
    gender: string;
    dob: string; // YYYY-MM-DD
    time: string; // HH:mm
    place: Place;
  }): Promise<void> {
    const timezone = tzlookup(d.place.lat, d.place.lon);
    await this.pb.collection('birth_details').create({
      user: this.user?.id,
      full_name: d.fullName,
      gender: d.gender,
      dob: `${d.dob} 00:00:00.000Z`,
      birth_time: d.time,
      birth_place: d.place.name,
      latitude: d.place.lat,
      longitude: d.place.lon,
      timezone,
      utc_offset: utcOffset(timezone, d.dob, d.time),
    });
  }

  /** Birth place suggestions (searched on our server via OpenStreetMap). */
  async searchPlaces(q: string, state = ''): Promise<Place[]> {
    const query: Record<string, string> = { q };
    if (state) query['state'] = state;
    const res = await this.pb.send<{ items: Place[] }>('/api/astro/places', {
      query,
      requestKey: null, // let the page drop old answers itself instead of auto-cancelling
    });
    return res.items ?? [];
  }

  /** Latest birth details and kundli (if already generated). */
  kundliState(): Promise<KundliState> {
    return this.pb.send<KundliState>('/api/astro/kundli', { method: 'GET' });
  }

  /**
   * Generates the kundli once on the server (Prokerala) and returns it.
   * For hi / ta / te / ml the server also stores Prokerala's report in that
   * language (once per language), so switching back costs nothing.
   */
  generateKundli(la: string = 'en'): Promise<RecordModel> {
    return this.pb.send<RecordModel>('/api/astro/kundli', { method: 'POST', body: { la } });
  }

  /**
   * Live updates (PocketBase realtime): calls `onChange` when the admin changes
   * plans or prices, or this customer's own account (e.g. their country).
   * Returns a function that stops listening.
   */
  async watchPricing(onChange: () => void): Promise<() => Promise<void>> {
    const stops: Array<() => Promise<void>> = [];
    stops.push(
      await this.pb.collection('app_signals').subscribe('*', (e) => {
        if (e.record['name'] === 'pricing') onChange();
      }),
    );
    const id = this.user?.id;
    if (id) {
      stops.push(
        await this.pb.collection('users').subscribe(id, (e) => {
          if (e.action === 'update') {
            this.pb.authStore.save(this.pb.authStore.token, e.record); // keep name/country fresh
            onChange();
          }
        }),
      );
    }
    return async () => {
      for (const stop of stops) await stop().catch(() => undefined);
    };
  }

  // ---------- Match making ----------

  /**
   * Makes a match report on the server (Prokerala advanced report, saved once).
   * `system` is only for Porutham: "tamil" or "kerala".
   */
  createMatch(
    method: MatchMethod,
    la: string,
    boy: PersonBirth,
    girl: PersonBirth,
    system: 'tamil' | 'kerala' = 'tamil',
  ): Promise<RecordModel> {
    const person = (p: PersonBirth) => {
      const tz = tzlookup(p.place.lat, p.place.lon);
      return {
        name: p.name,
        dob: p.dob,
        time: p.time,
        place: p.place.name,
        lat: p.place.lat,
        lon: p.place.lon,
        offset: utcOffset(tz, p.dob, p.time),
      };
    };
    return this.pb.send<RecordModel>('/api/astro/match', {
      method: 'POST',
      body: { method, la, porutham_system: system, boy: person(boy), girl: person(girl) },
    });
  }

  /** This customer's match reports, newest first (without the big report data). */
  listMatches(): Promise<RecordModel[]> {
    return this.pb.collection('matches').getFullList({
      sort: '-created',
      fields: 'id,method,language,boy_name,girl_name,score,max_score,created',
    });
  }

  getMatch(id: string): Promise<RecordModel> {
    return this.pb.collection('matches').getOne(id);
  }

  /** Adds missing Rasi / Navamsa charts to a saved match (once; 80 credits per person). */
  ensureMatchCharts(id: string): Promise<RecordModel> {
    return this.pb.send<RecordModel>(`/api/astro/match/${encodeURIComponent(id)}/charts`, { method: 'POST' });
  }

  deleteMatch(id: string): Promise<boolean> {
    return this.pb.collection('matches').delete(id);
  }

  /** Active plans with prices in the customer's own currency. */
  async activePlans(): Promise<PlanOffer[]> {
    const res = await this.pb.send<{ items: PlanOffer[] }>('/api/astro/plans', { method: 'GET' });
    return res.items ?? [];
  }
}

/** Minutes ahead of UTC that a time zone was at one moment (uses the device's time zone history). */
function zoneMinutes(timeZone: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'));
  return Math.round((asUtc - utcMs) / 60_000);
}

/**
 * UTC offset ("+05:30", "-04:00") of a time zone at a local date and time,
 * including daylight saving and historical changes (e.g. India's 1942–45 war time).
 */
export function utcOffset(timeZone: string, date: string, time: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const local = Date.UTC(y, mo - 1, d, h, mi);
  let mins = zoneMinutes(timeZone, local);
  const second = zoneMinutes(timeZone, local - mins * 60_000);
  if (second !== mins) mins = second; // birth time close to a clock change
  const sign = mins < 0 ? '-' : '+';
  const abs = Math.abs(mins);
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** Turns a server error into a short message for the user. */
export function errorText(e: unknown): string {
  if (e instanceof ClientResponseError) {
    if (e.status === 0) return 'Cannot reach server. Is PocketBase running?';
    const data = e.response?.['data'] as Record<string, { message?: string }> | undefined;
    if (data && typeof data === 'object') {
      const key = Object.keys(data)[0];
      if (key && data[key]?.message) return `${key}: ${data[key].message}`;
    }
    const msg = e.response?.['message'];
    if (typeof msg === 'string' && msg) return msg;
  }
  return 'Something went wrong. Please try again.';
}
