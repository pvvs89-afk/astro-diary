import { LangCode } from '../i18n/astro-names';

// Texts of the Notifications screen and pop-ups.
const en = {
  n_menu: 'Notifications',
  n_title: 'Notifications',
  n_empty: 'No notifications yet. Messages from Astro Diary will appear here.',
  n_mark_all: 'Mark all as read',
  n_new: 'New notification',
  n_open: 'Open',
  n_unread: 'Unread',
};
export type NotifyKey = keyof typeof en;

export const NOTIFY_TEXT: Record<LangCode, Record<NotifyKey, string>> = {
  en,
  hi: {
    n_menu: 'सूचनाएँ',
    n_title: 'सूचनाएँ',
    n_empty: 'अभी कोई सूचना नहीं। Astro Diary के संदेश यहाँ दिखेंगे।',
    n_mark_all: 'सभी को पढ़ा हुआ करें',
    n_new: 'नई सूचना',
    n_open: 'खोलें',
    n_unread: 'अपठित',
  },
  ta: {
    n_menu: 'அறிவிப்புகள்',
    n_title: 'அறிவிப்புகள்',
    n_empty: 'இன்னும் அறிவிப்புகள் இல்லை. Astro Diary செய்திகள் இங்கே தோன்றும்.',
    n_mark_all: 'அனைத்தையும் படித்ததாகக் குறி',
    n_new: 'புதிய அறிவிப்பு',
    n_open: 'திற',
    n_unread: 'படிக்காதவை',
  },
  te: {
    n_menu: 'నోటిఫికేషన్లు',
    n_title: 'నోటిఫికేషన్లు',
    n_empty: 'ఇంకా నోటిఫికేషన్లు లేవు. Astro Diary సందేశాలు ఇక్కడ కనిపిస్తాయి.',
    n_mark_all: 'అన్నీ చదివినట్లు గుర్తించు',
    n_new: 'కొత్త నోటిఫికేషన్',
    n_open: 'తెరువు',
    n_unread: 'చదవనివి',
  },
  ml: {
    n_menu: 'അറിയിപ്പുകൾ',
    n_title: 'അറിയിപ്പുകൾ',
    n_empty: 'ഇതുവരെ അറിയിപ്പുകളില്ല. Astro Diary സന്ദേശങ്ങൾ ഇവിടെ കാണാം.',
    n_mark_all: 'എല്ലാം വായിച്ചതായി അടയാളപ്പെടുത്തുക',
    n_new: 'പുതിയ അറിയിപ്പ്',
    n_open: 'തുറക്കുക',
    n_unread: 'വായിക്കാത്തവ',
  },
};
