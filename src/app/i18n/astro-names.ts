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
