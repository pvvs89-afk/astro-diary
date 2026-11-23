// Countries the app offers, with phone code and usual currency.
// Same list in the admin panel (astro-admin/src/app/shared/countries.ts) -
// when you add a country, add it in both files.
// "ZZ" = a country not in the list (customer types the full number with its code).

export interface Country {
  /** ISO country code, e.g. "IN". */
  code: string;
  name: string;
  /** Phone country code without "+". */
  dial: string;
  /** Usual currency (ISO code), suggested for country prices. */
  currency: string;
}

export const COUNTRIES: Country[] = [
  { code: 'IN', name: 'India', dial: '91', currency: 'INR' },
  { code: 'US', name: 'United States', dial: '1', currency: 'USD' },
  { code: 'GB', name: 'United Kingdom', dial: '44', currency: 'GBP' },
  { code: 'CA', name: 'Canada', dial: '1', currency: 'CAD' },
  { code: 'AU', name: 'Australia', dial: '61', currency: 'AUD' },
  { code: 'NZ', name: 'New Zealand', dial: '64', currency: 'NZD' },
  { code: 'AE', name: 'United Arab Emirates', dial: '971', currency: 'AED' },
  { code: 'SA', name: 'Saudi Arabia', dial: '966', currency: 'SAR' },
  { code: 'QA', name: 'Qatar', dial: '974', currency: 'QAR' },
  { code: 'KW', name: 'Kuwait', dial: '965', currency: 'KWD' },
  { code: 'OM', name: 'Oman', dial: '968', currency: 'OMR' },
  { code: 'BH', name: 'Bahrain', dial: '973', currency: 'BHD' },
  { code: 'SG', name: 'Singapore', dial: '65', currency: 'SGD' },
  { code: 'MY', name: 'Malaysia', dial: '60', currency: 'MYR' },
  { code: 'NP', name: 'Nepal', dial: '977', currency: 'NPR' },
  { code: 'LK', name: 'Sri Lanka', dial: '94', currency: 'LKR' },
  { code: 'BD', name: 'Bangladesh', dial: '880', currency: 'BDT' },
  { code: 'MU', name: 'Mauritius', dial: '230', currency: 'MUR' },
  { code: 'FJ', name: 'Fiji', dial: '679', currency: 'FJD' },
  { code: 'ZA', name: 'South Africa', dial: '27', currency: 'ZAR' },
  { code: 'KE', name: 'Kenya', dial: '254', currency: 'KES' },
  { code: 'TZ', name: 'Tanzania', dial: '255', currency: 'TZS' },
  { code: 'UG', name: 'Uganda', dial: '256', currency: 'UGX' },
  { code: 'NG', name: 'Nigeria', dial: '234', currency: 'NGN' },
  { code: 'DE', name: 'Germany', dial: '49', currency: 'EUR' },
  { code: 'FR', name: 'France', dial: '33', currency: 'EUR' },
  { code: 'NL', name: 'Netherlands', dial: '31', currency: 'EUR' },
  { code: 'IE', name: 'Ireland', dial: '353', currency: 'EUR' },
  { code: 'IT', name: 'Italy', dial: '39', currency: 'EUR' },
  { code: 'ES', name: 'Spain', dial: '34', currency: 'EUR' },
  { code: 'BE', name: 'Belgium', dial: '32', currency: 'EUR' },
  { code: 'PT', name: 'Portugal', dial: '351', currency: 'EUR' },
  { code: 'AT', name: 'Austria', dial: '43', currency: 'EUR' },
  { code: 'FI', name: 'Finland', dial: '358', currency: 'EUR' },
  { code: 'CH', name: 'Switzerland', dial: '41', currency: 'CHF' },
  { code: 'SE', name: 'Sweden', dial: '46', currency: 'SEK' },
  { code: 'NO', name: 'Norway', dial: '47', currency: 'NOK' },
  { code: 'DK', name: 'Denmark', dial: '45', currency: 'DKK' },
  { code: 'PL', name: 'Poland', dial: '48', currency: 'PLN' },
  { code: 'JP', name: 'Japan', dial: '81', currency: 'JPY' },
  { code: 'KR', name: 'South Korea', dial: '82', currency: 'KRW' },
  { code: 'CN', name: 'China', dial: '86', currency: 'CNY' },
  { code: 'HK', name: 'Hong Kong', dial: '852', currency: 'HKD' },
  { code: 'TH', name: 'Thailand', dial: '66', currency: 'THB' },
  { code: 'ID', name: 'Indonesia', dial: '62', currency: 'IDR' },
  { code: 'PH', name: 'Philippines', dial: '63', currency: 'PHP' },
  { code: 'VN', name: 'Vietnam', dial: '84', currency: 'VND' },
  { code: 'IL', name: 'Israel', dial: '972', currency: 'ILS' },
  { code: 'TT', name: 'Trinidad and Tobago', dial: '1', currency: 'TTD' },
  { code: 'GY', name: 'Guyana', dial: '592', currency: 'GYD' },
  { code: 'SR', name: 'Suriname', dial: '597', currency: 'SRD' },
  { code: 'JM', name: 'Jamaica', dial: '1', currency: 'JMD' },
];

/** Indian states and union territories (saved in English). */
export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
  'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

export const OTHER_COUNTRY = 'ZZ';

/** Country name in the app language (falls back to the English name). */
export function countryName(code: string, lang = 'en'): string {
  const english = COUNTRIES.find((c) => c.code === code)?.name ?? code;
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? english;
  } catch {
    return english;
  }
}

/** The phone's own country (from its language setting, e.g. "en-US" -> "US"), else India. */
/** Phone time zone -> country (no permission needed, and right even when the phone language is "English (US)"). */
const ZONE_COUNTRY: Record<string, string> = {
  'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN',
  'Europe/London': 'GB', 'Europe/Belfast': 'GB',
  'Pacific/Auckland': 'NZ', 'Pacific/Chatham': 'NZ',
  'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA', 'Asia/Qatar': 'QA', 'Asia/Kuwait': 'KW', 'Asia/Muscat': 'OM', 'Asia/Bahrain': 'BH',
  'Asia/Singapore': 'SG', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Kuching': 'MY',
  'Asia/Kathmandu': 'NP', 'Asia/Katmandu': 'NP', 'Asia/Colombo': 'LK', 'Asia/Dhaka': 'BD', 'Asia/Dacca': 'BD',
  'Indian/Mauritius': 'MU', 'Pacific/Fiji': 'FJ',
  'Africa/Johannesburg': 'ZA', 'Africa/Nairobi': 'KE', 'Africa/Dar_es_Salaam': 'TZ', 'Africa/Kampala': 'UG', 'Africa/Lagos': 'NG',
  'Europe/Berlin': 'DE', 'Europe/Paris': 'FR', 'Europe/Amsterdam': 'NL', 'Europe/Dublin': 'IE', 'Europe/Rome': 'IT',
  'Europe/Madrid': 'ES', 'Atlantic/Canary': 'ES', 'Europe/Brussels': 'BE', 'Europe/Lisbon': 'PT', 'Europe/Vienna': 'AT',
  'Europe/Helsinki': 'FI', 'Europe/Zurich': 'CH', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK',
  'Europe/Warsaw': 'PL',
  'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN', 'Asia/Urumqi': 'CN', 'Asia/Hong_Kong': 'HK', 'Asia/Bangkok': 'TH',
  'Asia/Jakarta': 'ID', 'Asia/Makassar': 'ID', 'Asia/Jayapura': 'ID', 'Asia/Manila': 'PH', 'Asia/Ho_Chi_Minh': 'VN', 'Asia/Saigon': 'VN',
  'Asia/Jerusalem': 'IL', 'Asia/Tel_Aviv': 'IL',
  'America/Port_of_Spain': 'TT', 'America/Guyana': 'GY', 'America/Paramaribo': 'SR', 'America/Jamaica': 'JM',
  'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Edmonton': 'CA', 'America/Winnipeg': 'CA', 'America/Halifax': 'CA',
  'America/St_Johns': 'CA', 'America/Regina': 'CA', 'America/Montreal': 'CA', 'America/Moncton': 'CA', 'America/Whitehorse': 'CA',
  'America/Yellowknife': 'CA', 'America/Iqaluit': 'CA', 'America/Glace_Bay': 'CA', 'America/Goose_Bay': 'CA',
};

/**
 * Country of this phone, to pre-select on the registration screen: from the phone's
 * time zone first, then the phone language's region; India if neither is in the list.
 */
export function deviceCountry(): string {
  const known = (c: string) => COUNTRIES.some((x) => x.code === c);
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    let c = ZONE_COUNTRY[zone] ?? '';
    if (!c && zone.startsWith('Australia/')) c = 'AU';
    // Other American zones (New_York, Chicago, Denver, Los_Angeles, Phoenix, Anchorage ...) and Hawaii
    if (!c && (zone.startsWith('America/') || zone === 'Pacific/Honolulu')) c = 'US';
    if (known(c)) return c;
  } catch {
    /* no time zone */
  }
  try {
    const region = new Intl.Locale(navigator.language).maximize().region ?? '';
    return known(region) ? region : 'IN';
  } catch {
    return 'IN';
  }
}

/** 1499 + "USD" -> "$1,499.00"; whole numbers in INR/JPY etc. without decimals. */
export function money(amount: unknown, currency = 'INR'): string {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en', {
      style: 'currency',
      currency,
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n}`;
  }
}
