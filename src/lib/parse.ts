import { westernDigits } from "./util";

export interface Parsed {
  area: string | null;
  price: number | null;
  size: number | null;
  floors: number | null;
  mapUrl: string | null;
  features: string[];
}

const WORD_FLOORS: Record<string, number> = { "دورين": 2, "طابقين": 2, "دور واحد": 1, "دور أرضي": 1 };

// Keywords a broker writes → the feature names on the owner's checklist.
const FEATURE_WORDS: [RegExp, string][] = [
  [/جراج|جراچ|ركن|ركنة|باركينج|مواقف/, "جراج"],
  [/أسانسير|اسانسير|مصعد|اسانسيرات/, "أسانسير"],
  [/شارع رئيسي|ع الرئيسي|على الرئيسي|ناصية|واجهة/, "على شارع رئيسي"],
  [/عداد تجاري|عدادات تجاري/, "عداد تجاري"],
  [/مرخص|مرخّص|ترخيص/, "مرخّص"],
  [/تحميل|تنزيل|رامب|بوابة عربيات|مدخل عربيات/, "تحميل وتنزيل للعربيات"],
];

function toInt(s: string) {
  return parseInt(s.replace(/[,،٬.\s]/g, ""), 10);
}

/** Reads rent, size, floors, area and features out of a broker's free-text WhatsApp message. */
export function parseListing(raw: string, checklist: string[]): Parsed {
  const t = westernDigits(raw);

  let price: number | null = null;
  const thousand = t.match(/(\d[\d,.]*)\s*(ألف|الف|آلاف|الاف|k\b)/i);
  const million = t.match(/(\d[\d.]*)\s*(مليون)/);
  const plain = t.match(/(?:إيجار|ايجار|السعر|سعر|بـ|ب)\s*:?\s*(\d[\d,]{3,})/) || t.match(/(\d[\d,]{3,})\s*(جنيه|ج\.?م|ج(?![؀-ۿ])|شهري|في الشهر)/);
  if (million) price = Math.round(parseFloat(million[1]) * 1_000_000);
  else if (thousand) price = Math.round(parseFloat(thousand[1].replace(/,/g, "")) * 1000);
  else if (plain) price = toInt(plain[1]);

  let floors: number | null = null;
  const fl = t.match(/(\d+)\s*(أدوار|ادوار|طوابق|طابق|دور)/);
  if (fl) floors = toInt(fl[1]);
  else for (const [w, n] of Object.entries(WORD_FLOORS)) if (t.includes(w)) { floors = n; break; }

  let size: number | null = null;
  const sz = t.match(/(\d[\d,]{1,6})\s*(م2|م²|متر|م(?![؀-ۿ])|m2|sqm)/i);
  if (sz) size = toInt(sz[1]);

  const map = t.match(/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.)?google\.[a-z.]+\/maps)[^\s]*/i);

  const firstLine = (raw.split(/\n/).find((l) => l.trim()) || "").trim();
  const area = firstLine ? firstLine.replace(/^(للإيجار|للايجار|متاح)\s*/, "").slice(0, 90) : null;

  const features = FEATURE_WORDS.filter(([re, name]) => re.test(t) && checklist.includes(name)).map(([, n]) => n);

  return { area, price, size, floors, mapUrl: map ? map[0] : null, features };
}
