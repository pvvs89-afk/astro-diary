import { LangCode } from '../i18n/astro-names';

/**
 * Notification types (chosen by the super admin): each has its own icon, colour and
 * card look. The same set is used in the admin panel.
 */
export type NotifyKind = 'info' | 'success' | 'reminder' | 'warning' | 'alert' | 'offer' | 'festival';

export const NOTIFY_KINDS: { id: NotifyKind; icon: string; color: string }[] = [
  { id: 'info', icon: 'information-circle', color: '#2563EB' },
  { id: 'success', icon: 'checkmark-circle', color: '#16A34A' },
  { id: 'reminder', icon: 'alarm', color: '#0891B2' },
  { id: 'warning', icon: 'warning', color: '#D97706' },
  { id: 'alert', icon: 'alert-circle', color: '#DC2626' },
  { id: 'offer', icon: 'pricetag', color: '#DB2777' },
  { id: 'festival', icon: 'sparkles', color: '#7C3AED' },
];

export const NOTIFY_KIND_NAMES: Record<LangCode, Record<NotifyKind, string>> = {
  en: { info: 'Information', success: 'Good news', reminder: 'Reminder', warning: 'Warning', alert: 'Urgent', offer: 'Offer', festival: 'Festival' },
  hi: { info: 'जानकारी', success: 'खुशखबरी', reminder: 'याद दिलाना', warning: 'चेतावनी', alert: 'ज़रूरी', offer: 'ऑफ़र', festival: 'त्योहार' },
  ta: { info: 'தகவல்', success: 'நல்ல செய்தி', reminder: 'நினைவூட்டல்', warning: 'எச்சரிக்கை', alert: 'அவசரம்', offer: 'சலுகை', festival: 'பண்டிகை' },
  te: { info: 'సమాచారం', success: 'శుభవార్త', reminder: 'గుర్తు', warning: 'హెచ్చరిక', alert: 'అత్యవసరం', offer: 'ఆఫర్', festival: 'పండుగ' },
  ml: { info: 'വിവരം', success: 'സന്തോഷവാർത്ത', reminder: 'ഓർമ്മപ്പെടുത്തൽ', warning: 'മുന്നറിയിപ്പ്', alert: 'അടിയന്തരം', offer: 'ഓഫർ', festival: 'ഉത്സവം' },
};

export function notifyKind(v: unknown) {
  return NOTIFY_KINDS.find((k) => k.id === v) ?? NOTIFY_KINDS[0];
}

/**
 * Card look for one notification. Put on a wrapper: class="nk k-<kind>" [style.--k]="kind.color",
 * with .nk-ic (icon tile) and .nk-badge inside.
 */
export const NOTIFY_KIND_CSS = `
  .nk { --k: #2563EB; position: relative; border: 1px solid color-mix(in srgb, var(--k) 22%, transparent) !important;
    background: color-mix(in srgb, var(--k) 6%, var(--ad-card, var(--ion-background-color))) !important;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  .nk.k-alert { background: color-mix(in srgb, var(--k) 10%, var(--ad-card, var(--ion-background-color))) !important;
    border-color: color-mix(in srgb, var(--k) 45%, transparent) !important; }
  .nk.k-offer { border-style: dashed !important; }
  .nk.k-festival { background:
      radial-gradient(90% 120% at 100% 0%, color-mix(in srgb, #F59E0B 14%, transparent), transparent 60%),
      color-mix(in srgb, var(--k) 6%, var(--ad-card, var(--ion-background-color))) !important; }
  .nk-ic { flex: none; width: 30px; height: 30px; border-radius: 9px; display: flex !important; align-items: center; justify-content: center; font-size: 16px; color: #fff;
    background: radial-gradient(120% 90% at 28% 12%, rgba(255,255,255,0.5), rgba(255,255,255,0) 55%),
      linear-gradient(160deg, color-mix(in srgb, var(--k) 75%, #fff), var(--k) 55%, color-mix(in srgb, var(--k) 80%, #000));
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.45), 0 2px 5px color-mix(in srgb, var(--k) 30%, transparent); }
  .nk-ic ion-icon { font-size: 16px; color: #fff; }
  .nk-badge { display: inline-block; padding: 1px 6px; border-radius: 6px; font-size: 10px; font-weight: 700; line-height: 1.5;
    letter-spacing: 0.03em; text-transform: uppercase; color: var(--k); background: color-mix(in srgb, var(--k) 13%, transparent); }
`;
