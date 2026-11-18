import { ActionSheetController } from '@ionic/angular';
import { I18nService, LANGUAGES, LangCode } from '../i18n/i18n.service';

/**
 * Asks which language the PDF should be in (the 5 Prokerala languages).
 * Returns the chosen code, or null if cancelled.
 */
export async function askPdfLanguage(sheets: ActionSheetController, i18n: I18nService): Promise<LangCode | null> {
  let picked: LangCode | null = null;
  const sheet = await sheets.create({
    header: i18n.t('pdf_language'),
    buttons: [
      ...LANGUAGES.map((l) => ({
        text: (l.code === i18n.lang() ? '✓ ' : '') + l.label,
        handler: () => {
          picked = l.code;
        },
      })),
      { text: i18n.t('cancel'), role: 'cancel' },
    ],
  });
  await sheet.present();
  await sheet.onDidDismiss();
  return picked;
}

/** Waits until Angular has drawn the page in the new language. */
export function nextPaint(ms = 80): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => setTimeout(r, ms)));
}
