const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Turns Arabic-Indic / Persian digits into 0-9 so numbers can be read. */
export function westernDigits(s: string) {
  return s.replace(/[٠-٩۰-۹]/g, (d) => String(AR_DIGITS.indexOf(d) >= 0 ? AR_DIGITS.indexOf(d) : FA_DIGITS.indexOf(d)));
}

export function money(n: number | null) {
  return n == null ? "—" : n.toLocaleString("en-US");
}

export function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ar-EG-u-nu-latn", {
    weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit",
  });
}

export function timeAgo(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "دلوقتي";
  if (m < 60) return `من ${m} دقيقة`;
  const h = Math.round(m / 60);
  if (h < 24) return `من ${h} ساعة`;
  const d = Math.round(h / 24);
  return d === 1 ? "امبارح" : `من ${d} يوم`;
}

/** Egyptian mobile → international digits for wa.me (0100… → 20100…). */
export function waNumber(phone: string) {
  let d = westernDigits(phone).replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "2" + d;
  if (d.length === 10 && d.startsWith("1")) d = "20" + d;
  return d;
}

export function waLink(phone: string, text: string) {
  return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`;
}

export function telLink(phone: string) {
  return `tel:${westernDigits(phone).replace(/[^\d+]/g, "")}`;
}

export function mapLink(l: { map_url: string | null; area: string | null }) {
  if (l.map_url) return l.map_url;
  if (l.area) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.area)}`;
  return null;
}

/** datetime-local value for an ISO string, in the viewer's own time zone. */
export function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInput(v: string) {
  return v ? new Date(v).toISOString() : null;
}

export const ERRORS: Record<string, string> = {
  INVITE_NOT_FOUND: "اللينك ده مش شغال. اطلب لينك جديد.",
  NAME_PHONE_REQUIRED: "اكتب اسمك ورقم موبايلك.",
  TOO_MANY_PHOTOS: "أقصى عدد 40 صورة للعقار.",
  NOT_ALLOWED: "مش مسموح بالعملية دي.",
  OWNER_ONLY: "صاحب البحث بس هو اللي يقدر يعمل كده.",
};

export function errorText(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  const key = Object.keys(ERRORS).find((k) => msg.includes(k));
  return key ? ERRORS[key] : "حصلت مشكلة في الاتصال. جرّب تاني.";
}
