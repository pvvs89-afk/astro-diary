import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonSpinner,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { sparkles } from 'ionicons/icons';
import { PbService, errorText } from '../services/pb.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, IonContent, IonInput, IonButton, IonIcon, IonSpinner],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  private pbs = inject(PbService);
  private router = inject(Router);
  private toast = inject(ToastController);

  isRegister = false;
  readonly busy = signal(false);

  name = '';
  phone = '';
  email = '';
  password = '';

  constructor() {
    addIcons({ sparkles });
  }

  toggleMode(): void {
    this.isRegister = !this.isRegister;
  }

  private validate(): string | null {
    if (this.isRegister) {
      if (!this.name.trim()) return 'Enter your name';
      if (!/^[6-9]\d{9}$/.test(this.phone.trim())) return 'Enter a valid 10-digit mobile number';
    }
    if (!/^\S+@\S+\.\S+$/.test(this.email.trim())) return 'Enter a valid email';
    if (this.password.length < 8) return 'Password must be at least 8 characters';
    return null;
  }

  async submit(): Promise<void> {
    const problem = this.validate();
    if (problem) {
      await this.show(problem);
      return;
    }
    this.busy.set(true);
    try {
      const email = this.email.trim();
      if (this.isRegister) {
        await this.pbs.register(this.name.trim(), this.phone.trim(), email, this.password);
      }
      await this.pbs.login(email, this.password);
      const has = await this.pbs.hasBirthDetails();
      await this.router.navigateByUrl(has ? '/home' : '/birth-details', { replaceUrl: true });
    } catch (e) {
      await this.show(errorText(e));
    } finally {
      this.busy.set(false);
    }
  }

  private async show(message: string): Promise<void> {
    const t = await this.toast.create({ message, duration: 3000, position: 'bottom' });
    await t.present();
  }
}
