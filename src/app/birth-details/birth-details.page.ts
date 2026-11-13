import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { PbService, errorText } from '../services/pb.service';

@Component({
  selector: 'app-birth-details',
  standalone: true,
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonSpinner,
  ],
  templateUrl: './birth-details.page.html',
  styleUrls: ['./birth-details.page.scss'],
})
export class BirthDetailsPage {
  private pbs = inject(PbService);
  private router = inject(Router);
  private toast = inject(ToastController);

  readonly today = new Date().toISOString().slice(0, 10);
  readonly busy = signal(false);

  fullName = (this.pbs.user?.['name'] as string | undefined) ?? '';
  gender = '';
  dob = ''; // YYYY-MM-DD
  time = ''; // HH:mm
  place = '';

  private validate(): string | null {
    if (!this.fullName.trim()) return 'Enter full name';
    if (!this.gender) return 'Select gender';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.dob)) return 'Select date of birth';
    if (!/^\d{2}:\d{2}/.test(this.time)) return 'Select exact birth time';
    if (!this.place.trim()) return 'Enter birth place';
    return null;
  }

  async save(): Promise<void> {
    const problem = this.validate();
    if (problem) {
      await this.show(problem);
      return;
    }
    this.busy.set(true);
    try {
      await this.pbs.saveBirthDetails({
        fullName: this.fullName.trim(),
        gender: this.gender,
        dob: this.dob,
        time: this.time.slice(0, 5),
        place: this.place.trim(),
      });
      await this.router.navigateByUrl('/home', { replaceUrl: true });
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
