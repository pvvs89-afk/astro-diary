import { Injectable } from '@angular/core';
import PocketBase, { ClientResponseError, RecordModel } from 'pocketbase';

// Server address - change depending on where you test:
//   Browser (ionic serve):   http://127.0.0.1:8090
//   Android emulator:        http://10.0.2.2:8090
//   Real phone (same Wi-Fi): http://<laptop IPv4 from ipconfig>:8090
export const SERVER_URL = 'http://127.0.0.1:8090';

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

  async register(name: string, phone: string, email: string, password: string): Promise<void> {
    await this.pb.collection('users').create({
      name,
      phone,
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

  async saveBirthDetails(d: {
    fullName: string;
    gender: string;
    dob: string; // YYYY-MM-DD
    time: string; // HH:mm
    place: string;
  }): Promise<void> {
    await this.pb.collection('birth_details').create({
      user: this.user?.id,
      full_name: d.fullName,
      gender: d.gender,
      dob: `${d.dob} 00:00:00.000Z`,
      birth_time: d.time,
      birth_place: d.place,
    });
  }

  activePlans(): Promise<RecordModel[]> {
    return this.pb.collection('plans').getFullList({
      filter: 'active = true',
      sort: 'price_inr',
    });
  }
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
