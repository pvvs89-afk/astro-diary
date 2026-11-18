// Fixed astrology names in each app language, used for charts and tables.
// Kundli data is always calculated in English first; these lists show the names
// in the customer's language without spending extra Prokerala credits.

export type LangCode = 'en' | 'hi' | 'ta' | 'te' | 'ml';

/** Order: Mesha (0) ... Meena (11) - same as Prokerala rasi ids. */
export const RASI_NAMES: Record<LangCode, string[]> = {
  en: ['Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya', 'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena'],
  hi: ['मेष', 'वृषभ', 'मिथुन', 'कर्क', 'सिंह', 'कन्या', 'तुला', 'वृश्चिक', 'धनु', 'मकर', 'कुंभ', 'मीन'],
  ta: ['மேஷம்', 'ரிஷபம்', 'மிதுனம்', 'கடகம்', 'சிம்மம்', 'கன்னி', 'துலாம்', 'விருச்சிகம்', 'தனுசு', 'மகரம்', 'கும்பம்', 'மீனம்'],
  te: ['మేషం', 'వృషభం', 'మిథునం', 'కర్కాటకం', 'సింహం', 'కన్య', 'తుల', 'వృశ్చికం', 'ధనుస్సు', 'మకరం', 'కుంభం', 'మీనం'],
  ml: ['മേടം', 'ഇടവം', 'മിഥുനം', 'കർക്കടകം', 'ചിങ്ങം', 'കന്നി', 'തുലാം', 'വൃശ്ചികം', 'ധനു', 'മകരം', 'കുംഭം', 'മീനം'],
};

const PLANET_KEYS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu', 'Ascendant', 'Uranus', 'Neptune', 'Pluto'] as const;

const PLANET_LIST: Record<LangCode, string[]> = {
  en: ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu', 'Ascendant', 'Uranus', 'Neptune', 'Pluto'],
  hi: ['सूर्य', 'चंद्र', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'राहु', 'केतु', 'लग्न', 'यूरेनस', 'नेपच्यून', 'प्लूटो'],
  ta: ['சூரியன்', 'சந்திரன்', 'செவ்வாய்', 'புதன்', 'குரு', 'சுக்கிரன்', 'சனி', 'ராகு', 'கேது', 'லக்னம்', 'யுரேனஸ்', 'நெப்டியூன்', 'புளூட்டோ'],
  te: ['సూర్యుడు', 'చంద్రుడు', 'కుజుడు', 'బుధుడు', 'గురువు', 'శుక్రుడు', 'శని', 'రాహువు', 'కేతువు', 'లగ్నం', 'యురేనస్', 'నెప్ట్యూన్', 'ప్లూటో'],
  ml: ['സൂര്യൻ', 'ചന്ദ്രൻ', 'ചൊവ്വ', 'ബുധൻ', 'വ്യാഴം', 'ശുക്രൻ', 'ശനി', 'രാഹു', 'കേതു', 'ലഗ്നം', 'യുറാനസ്', 'നെപ്റ്റ്യൂൺ', 'പ്ലൂട്ടോ'],
};

/** Short labels inside the chart boxes. */
const PLANET_SHORT: Record<LangCode, string[]> = {
  en: ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke', 'Asc', 'Ur', 'Ne', 'Pl'],
  hi: ['सू', 'चं', 'मं', 'बु', 'गु', 'शु', 'श', 'रा', 'के', 'ल', 'यू', 'ने', 'प्लू'],
  ta: ['சூ', 'சந்', 'செ', 'பு', 'கு', 'சு', 'ச', 'ரா', 'கே', 'ல', 'யு', 'நெ', 'பு'],
  te: ['సూ', 'చం', 'కు', 'బు', 'గు', 'శు', 'శ', 'రా', 'కే', 'ల', 'యు', 'నె', 'ప్లూ'],
  ml: ['സൂ', 'ച', 'ചൊ', 'ബു', 'വ്യാ', 'ശു', 'ശ', 'രാ', 'കേ', 'ല', 'യു', 'നെ', 'പ്ലൂ'],
};

export const MONTH_NAMES: Record<LangCode, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  hi: ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'],
  ta: ['ஜன', 'பிப்', 'மார்', 'ஏப்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆக', 'செப்', 'அக்', 'நவ', 'டிச'],
  te: ['జన', 'ఫిబ్ర', 'మార్చి', 'ఏప్రి', 'మే', 'జూన్', 'జులై', 'ఆగ', 'సెప్టెం', 'అక్టో', 'నవం', 'డిసెం'],
  ml: ['ജനു', 'ഫെബ്രു', 'മാർ', 'ഏപ്രി', 'മേയ്', 'ജൂൺ', 'ജൂലൈ', 'ഓഗ', 'സെപ്റ്റം', 'ഒക്ടോ', 'നവം', 'ഡിസം'],
};

function planetIndex(englishName: string): number {
  return (PLANET_KEYS as readonly string[]).indexOf(englishName);
}

/** "Jupiter" -> "గురువు" (falls back to the English name). */
export function planetName(englishName: string, lang: LangCode): string {
  const i = planetIndex(englishName);
  return i < 0 ? englishName : PLANET_LIST[lang][i];
}

/** "Jupiter" -> "గు" for the chart boxes. */
export function planetShort(englishName: string, lang: LangCode): string {
  const i = planetIndex(englishName);
  return i < 0 ? englishName.slice(0, 2) : PLANET_SHORT[lang][i];
}

/** The 27 nakshatras, in order from Ashwini (Prokerala id 0). */
export const NAKSHATRA_NAMES: Record<LangCode, string[]> = {
  en: ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'],
  hi: ['अश्विनी', 'भरणी', 'कृत्तिका', 'रोहिणी', 'मृगशिरा', 'आर्द्रा', 'पुनर्वसु', 'पुष्य', 'आश्लेषा', 'मघा', 'पूर्व फाल्गुनी', 'उत्तर फाल्गुनी', 'हस्त', 'चित्रा', 'स्वाति', 'विशाखा', 'अनुराधा', 'ज्येष्ठा', 'मूल', 'पूर्वाषाढ़ा', 'उत्तराषाढ़ा', 'श्रवण', 'धनिष्ठा', 'शतभिषा', 'पूर्व भाद्रपद', 'उत्तर भाद्रपद', 'रेवती'],
  ta: ['அஸ்வினி', 'பரணி', 'கார்த்திகை', 'ரோகிணி', 'மிருகசீரிடம்', 'திருவாதிரை', 'புனர்பூசம்', 'பூசம்', 'ஆயில்யம்', 'மகம்', 'பூரம்', 'உத்திரம்', 'அஸ்தம்', 'சித்திரை', 'சுவாதி', 'விசாகம்', 'அனுஷம்', 'கேட்டை', 'மூலம்', 'பூராடம்', 'உத்திராடம்', 'திருவோணம்', 'அவிட்டம்', 'சதயம்', 'பூரட்டாதி', 'உத்திரட்டாதி', 'ரேவதி'],
  te: ['అశ్విని', 'భరణి', 'కృత్తిక', 'రోహిణి', 'మృగశిర', 'ఆర్ద్ర', 'పునర్వసు', 'పుష్యమి', 'ఆశ్లేష', 'మఖ', 'పుబ్బ', 'ఉత్తర', 'హస్త', 'చిత్త', 'స్వాతి', 'విశాఖ', 'అనూరాధ', 'జ్యేష్ఠ', 'మూల', 'పూర్వాషాఢ', 'ఉత్తరాషాఢ', 'శ్రవణం', 'ధనిష్ఠ', 'శతభిషం', 'పూర్వాభాద్ర', 'ఉత్తరాభాద్ర', 'రేవతి'],
  ml: ['അശ്വതി', 'ഭരണി', 'കാർത്തിക', 'രോഹിണി', 'മകയിരം', 'തിരുവാതിര', 'പുണർതം', 'പൂയം', 'ആയില്യം', 'മകം', 'പൂരം', 'ഉത്രം', 'അത്തം', 'ചിത്തിര', 'ചോതി', 'വിശാഖം', 'അനിഴം', 'തൃക്കേട്ട', 'മൂലം', 'പൂരാടം', 'ഉത്രാടം', 'തിരുവോണം', 'അവിട്ടം', 'ചതയം', 'പൂരുരുട്ടാതി', 'ഉത്രട്ടാതി', 'രേവതി'],
};

/**
 * Nakshatra name in `lang` from Prokerala's { id, name }.
 * Prokerala's ids start at 0 (Ashwini); the first letters of the English name are
 * checked so a different numbering or spelling never shows the wrong star.
 */
export function nakshatraName(id: unknown, englishName: string, lang: LangCode): string {
  const en = NAKSHATRA_NAMES.en;
  // Spelling-proof key: "Moola" = "Mula", "Poorva" = "Purva", "Aswini" = "Ashwini" ...
  const key = (s: string) =>
    s.toLowerCase().replace(/[^a-z]/g, '')
      .replace(/oo/g, 'u').replace(/ee/g, 'i').replace(/th/g, 't').replace(/sh/g, 's')
      .replace(/w/g, 'v').replace(/(.)\1/g, '$1').slice(0, 3);
  const n = Number(id);
  const ok = (c: number) => Number.isInteger(c) && c >= 0 && c < 27;
  let i = -1;
  if (englishName) i = [n, n - 1].find((c) => ok(c) && key(en[c]) === key(englishName)) ?? -1;
  if (i < 0 && englishName) i = en.findIndex((x) => key(x) === key(englishName));
  if (i < 0 && ok(n)) i = n; // Prokerala numbers nakshatras from 0
  return i < 0 ? englishName : NAKSHATRA_NAMES[lang][i];
}

// Ashta Koota (guna) and Porutham names, matched by a keyword in Prokerala's English name.
const KOOTA: [RegExp, Record<LangCode, string>][] = [
  [/varna/i, { en: 'Varna', hi: 'वर्ण', ta: 'வர்ணம்', te: 'వర్ణ', ml: 'വർണം' }],
  [/vash?ya/i, { en: 'Vashya', hi: 'वश्य', ta: 'வசியம்', te: 'వశ్య', ml: 'വശ്യം' }],
  [/tara/i, { en: 'Tara', hi: 'तारा', ta: 'தாரை', te: 'తార', ml: 'താര' }],
  [/yoni/i, { en: 'Yoni', hi: 'योनि', ta: 'யோனி', te: 'యోని', ml: 'യോനി' }],
  [/maitr/i, { en: 'Graha Maitri', hi: 'ग्रह मैत्री', ta: 'கிரக மைத்ரி', te: 'గ్రహ మైత్రి', ml: 'ഗ്രഹമൈത്രി' }],
  [/gana/i, { en: 'Gana', hi: 'गण', ta: 'கணம்', te: 'గణ', ml: 'ഗണം' }],
  [/bha?koo?t/i, { en: 'Bhakoot', hi: 'भकूट', ta: 'பகூடம்', te: 'భకూట', ml: 'ഭകൂടം' }],
  [/nadi|naadi/i, { en: 'Nadi', hi: 'नाड़ी', ta: 'நாடி', te: 'నాడి', ml: 'നാഡി' }],
];
const PORUTHAM: [RegExp, Record<LangCode, string>][] = [
  [/dina/i, { en: 'Dina', hi: 'दिन', ta: 'தினம்', te: 'దిన', ml: 'ദിനം' }],
  [/mahendra/i, { en: 'Mahendra', hi: 'महेंद्र', ta: 'மகேந்திரம்', te: 'మహేంద్ర', ml: 'മാഹേന്ദ്രം' }],
  [/stree|stri|deergha|dheerga/i, { en: 'Stree Deergha', hi: 'स्त्री दीर्घ', ta: 'ஸ்திரீ தீர்க்கம்', te: 'స్త్రీ దీర్ఘ', ml: 'സ്ത്രീദീർഘം' }],
  [/adhipat|athipat|lord/i, { en: 'Rasi Adhipathi', hi: 'राशि अधिपति', ta: 'ராசி அதிபதி', te: 'రాశ్యధిపతి', ml: 'രാശ്യധിപതി' }],
  [/gana/i, { en: 'Gana', hi: 'गण', ta: 'கணம்', te: 'గణ', ml: 'ഗണം' }],
  [/yoni/i, { en: 'Yoni', hi: 'योनि', ta: 'யோனி', te: 'యోని', ml: 'യോനി' }],
  [/rasi|rashi/i, { en: 'Rasi', hi: 'राशि', ta: 'ராசி', te: 'రాశి', ml: 'രാശി' }],
  [/vash?ya/i, { en: 'Vasya', hi: 'वश्य', ta: 'வசியம்', te: 'వశ్య', ml: 'വശ്യം' }],
  [/rajju/i, { en: 'Rajju', hi: 'रज्जु', ta: 'ரஜ்ஜு', te: 'రజ్జు', ml: 'രജ്ജു' }],
  [/vedha|vedai/i, { en: 'Vedha', hi: 'वेध', ta: 'வேதை', te: 'వేధ', ml: 'വേധം' }],
];

/** "Nadi Koot" -> "నాడి"; unknown names are returned unchanged. */
export function matchPartName(name: string, method: 'ashta_koota' | 'porutham', lang: LangCode): string {
  if (lang === 'en') return name;
  const hit = (method === 'porutham' ? PORUTHAM : KOOTA).find(([re]) => re.test(name));
  return hit ? hit[1][lang] : name;
}
