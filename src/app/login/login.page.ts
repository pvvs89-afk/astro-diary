import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonInput,
  IonInputPasswordToggle,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  ToastController,
} from '@ionic/angular';
import { I18nService } from '../i18n/i18n.service';
import { LangButtonComponent } from '../i18n/lang-button.component';
import { COUNTRIES, INDIAN_STATES, OTHER_COUNTRY, countryName, deviceCountry } from '../services/countries';
import { PbService } from '../services/pb.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, IonContent, IonInput, IonInputPasswordToggle, IonButton, IonSpinner, IonSelect, IonSelectOption, LangButtonComponent],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  private pbs = inject(PbService);
  private router = inject(Router);
  private toast = inject(ToastController);
  private i18n = inject(I18nService);
  readonly t = this.i18n.t;

  isRegister = false;
  readonly busy = signal(false);

  name = '';
  /** Customer's country - decides the phone code and the subscription prices. */
  readonly country = signal(deviceCountry());
  readonly OTHER = OTHER_COUNTRY;
  /** Country list with names in the app language, India first. */
  readonly countries = computed(() => {
    const lang = this.i18n.lang();
    return COUNTRIES.map((c) => ({ code: c.code, dial: c.dial, name: countryName(c.code, lang) }));
  });
  /** "+91", "+1" ... or "+" for a country not in the list. */
  readonly dial = computed(() => {
    const c = COUNTRIES.find((x) => x.code === this.country());
    return c ? '+' + c.dial : '+';
  });
  /** Where the customer lives: an Indian state, or free text elsewhere. */
  state = '';
  readonly indianStates = INDIAN_STATES;
  phone = '';
  email = '';
  password = '';

  toggleMode(): void {
    this.isRegister = !this.isRegister;
  }

  private validate(): string | null {
    if (this.isRegister) {
      if (!this.name.trim()) return this.t('err_name');
      if (!this.country()) return this.t('err_country');
      if (this.country() === 'IN' && !this.state) return this.t('err_state');
      if (this.country() === 'IN') {
        if (!/^[6-9]\d{9}$/.test(this.phone.trim())) return this.t('err_mobile');
      } else if (!/^\d{6,15}$/.test(this.phone.replace(/[\s-]/g, ''))) {
        return this.t('err_mobile_any');
      }
    }
    if (!/^\S+@\S+\.\S+$/.test(this.email.trim())) return this.t('err_email');
    if (this.password.length < 8) return this.t('err_password');
    return null;
  }

  async submit(): Promise<void> {
    if (this.busy()) return; // Enter pressed twice
    const problem = this.validate();
    if (problem) {
      await this.show(problem);
      return;
    }
    this.busy.set(true);
    try {
      const email = this.email.trim();
      if (this.isRegister) {
        await this.pbs.register(this.name.trim(), this.fullPhone(), email, this.password, this.country(), this.state.trim().slice(0, 60));
      }
      await this.pbs.login(email, this.password);
      // Home lets the customer choose: My Kundli or Match Making.
      await this.router.navigateByUrl('/home', { replaceUrl: true });
    } catch (e) {
      await this.show(this.i18n.err(e));
    } finally {
      this.busy.set(false);
    }
  }

  /** India: 10 digits as before. Elsewhere: "+<code><number>" (for "Other", the code is typed in). */
  private fullPhone(): string {
    const num = this.phone.replace(/[\s-]/g, '');
    if (this.country() === 'IN') return num;
    return this.dial() + num;
  }

  private async show(message: string): Promise<void> {
    const t = await this.toast.create({ message, duration: 3000, position: 'bottom' });
    await t.present();
  }
}
