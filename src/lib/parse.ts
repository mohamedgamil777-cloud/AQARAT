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

  const size = extractSize(raw);

  const map = t.match(/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.)?google\.[a-z.]+\/maps)[^\s]*/i);

  const firstLine = (raw.split(/\n/).find((l) => l.trim()) || "").trim();
  const area = firstLine ? firstLine.replace(/^(للإيجار|للايجار|متاح)\s*/, "").slice(0, 90) : null;

  const features = FEATURE_WORDS.filter(([re, name]) => re.test(t) && checklist.includes(name)).map(([, n]) => n);

  return { area, price, size, floors, mapUrl: map ? map[0] : null, features };
}

// ── Area (m²) — only when the message is unambiguous ────────────────────────────────────────────
const AR = "[\u0600-\u06FF]";
// number + unit: "800 متر", "800م", "800 م2", "800 متر مربع", "800m2", "800 sqm"
const WITH_UNIT = new RegExp(`(\\d[\\d,.]*)\\s*(?:م2|م²|مترمربع|متر\\s*مربع|أمتار|امتار|متر|م(?!${AR})|m2|m²|sqm|sq\\.?\\s?m(?:eters|etres)?|square\\s+(?:meters|metres)|metres|meters|metre|meter|mtrs|mtr)(?![a-z])`, "gi");
// keyword + number: "مساحة 800", "المساحة: 800", "مسطح ٨٠٠", "مساحته 800"
const AFTER_WORD = /(?:\b(?:area|size|space|BUA|built[- ]up(?: area)?)|مساح[ةه]|المساح[ةه]|مساحته|مسطح|المسطح)\s*(?:الأرض|الارض|المبنى|المبني|الإجمالية|الاجمالية|الكلية|حوالي|تقريبا|تقريباً)?\s*[:=\-]?\s*(\d[\d,.]*)/g;
// Context that means the number is NOT the building's area.
const NOT_AREA_BEFORE = /(بعد|مسافة|مسافه|خطوات|على بعد|ع بعد|شارع|عرض|واجهة|واجهه|ارتفاع|طول|عمق|street|road|width|frontage|only|just)\s*$/i;
const NOT_AREA_AFTER = /^\s*(من|عن|ل|لل|للمحطة|للمترو)(?![\u0600-\u06FF])|^\s*(من|عن)\s|^\s*(from|away|to the|walk)\b/i;
const FLOOR_BEFORE = /(?:^|[^\u0600-\u06FF])(دور|الدور|أرضي|ارضي|بدروم|البدروم|الأول|الاول|الثاني|التاني|روف|الروف)\s*[:\-]?\s*$/;
const PER_FLOOR = /^\s*(?:مربع\s*)?(?:لل?دور|في الدور|بالدور|كل دور|للطابق|(?:per|each|\/|a)\s*floor)/i;
const TOTAL_WORD = /(إجمالي|اجمالي|الإجمالية|الاجمالية|إجمالية|اجمالية|الكلية|كلي|total)/i;

const num = (s: string) => {
  const n = parseInt(s.replace(/[,،٬.\s]/g, ""), 10);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * The building's area in m², or null when not sure. Rules:
 * - a number with a metre unit, or right after "مساحة/مسطح";
 * - skip distances ("500 متر من الدائري"), street widths ("شارع 20 متر") and per-floor sizes ("200 متر للدور");
 * - plausible range 50–20,000 m²;
 * - if the message gives different areas, use the one marked "إجمالي" — otherwise leave it empty.
 */
export function extractSize(raw: string): number | null {
  const t = westernDigits(raw);
  const found: { n: number; total: boolean }[] = [];
  let perFloor = false;
  const consider = (n: number, start: number, end: number) => {
    const before = t.slice(Math.max(0, start - 14), start);
    const after = t.slice(end, end + 14);
    if (NOT_AREA_BEFORE.test(before) || NOT_AREA_AFTER.test(after)) return;
    if (PER_FLOOR.test(after) || FLOOR_BEFORE.test(before)) { perFloor = true; return; }
    if (!(n >= 50 && n <= 20000)) return;
    // "إجمالي" right next to this number (not anywhere in the message) marks it as the total.
    found.push({ n, total: TOTAL_WORD.test(t.slice(Math.max(0, start - 10), start)) || TOTAL_WORD.test(t.slice(end, end + 12)) });
  };
  for (const m of t.matchAll(WITH_UNIT)) consider(num(m[1]), m.index!, m.index! + m[0].length);
  for (const m of t.matchAll(AFTER_WORD)) {
    const at = m.index! + m[0].lastIndexOf(m[1]);
    consider(num(m[1]), at, at + m[1].length);
  }
  const distinct = [...new Set(found.map((f) => f.n))];
  if (distinct.length === 1 && !perFloor) return distinct[0];
  const totals = [...new Set(found.filter((f) => f.total).map((f) => f.n))];
  if (totals.length === 1) return totals[0];
  return null;
}
