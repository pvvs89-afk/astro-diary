import { Component, Input, inject } from '@angular/core';
import { ActionSheetController, IonButton, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { languageOutline } from 'ionicons/icons';
import { I18nService, LANGUAGES } from './i18n.service';

/** Language button: shows the current language and opens a picker. */
@Component({
  selector: 'app-lang-button',
  standalone: true,
  imports: [IonButton, IonIcon],
  template: `
    <ion-button [fill]="fill" [shape]="shape" size="small" (click)="open()" [attr.aria-label]="i18n.t('language')">
      <ion-icon slot="start" name="language-outline"></ion-icon>
      {{ i18n.label }}
    </ion-button>
  `,
})
export class LangButtonComponent {
  readonly i18n = inject(I18nService);
  private sheets = inject(ActionSheetController);

  /** "clear" inside toolbars, "outline" on plain pages. */
  @Input() fill: 'clear' | 'outline' | 'solid' = 'clear';
  @Input() shape: 'round' | undefined = undefined;

  constructor() {
    addIcons({ languageOutline });
  }

  async open(): Promise<void> {
    const sheet = await this.sheets.create({
      header: this.i18n.t('choose_language'),
      buttons: [
        ...LANGUAGES.map((l) => ({
          text: (l.code === this.i18n.lang() ? '✓ ' : '') + l.label,
          handler: () => {
            void this.i18n.use(l.code);
          },
        })),
        { text: this.i18n.t('cancel'), role: 'cancel' },
      ],
    });
    await sheet.present();
  }
}
