import { money } from "./util";

/** What the owner is looking for. A null bound means "no limit on that side". */
export interface Brief {
  location?: string | null;
  size_min: number | null;
  size_max: number | null;
  price_min: number | null;
  price_max: number | null;
  ground: boolean;
}

export const DEFAULT_BRIEF: Brief = { location: "المعادي", size_min: 500, size_max: 1000, price_min: 90000, price_max: 150000, ground: true };

export function rangeText(min: number | null, max: number | null, unit: string) {
  if (min != null && max != null) return `من ${money(min)} لـ ${money(max)} ${unit}`;
  if (min != null) return `${money(min)} ${unit} أو أكتر`;
  if (max != null) return `لحد ${money(max)} ${unit}`;
  return null;
}

/** Warnings for a building that falls outside the brief (shown to the broker before sending). */
export function briefWarnings(b: Brief | undefined, size: number | null, price: number | null): string[] {
  if (!b) return [];
  const w: string[] = [];
  if (size != null) {
    if (b.size_min != null && size < b.size_min) w.push(`المساحة ${money(size)} م² أقل من المطلوب (${money(b.size_min)} م² على الأقل)`);
    if (b.size_max != null && size > b.size_max) w.push(`المساحة ${money(size)} م² أكبر من المطلوب (لحد ${money(b.size_max)} م²)`);
  }
  if (price != null) {
    if (b.price_max != null && price > b.price_max) w.push(`الإيجار ${money(price)} ج أعلى من الميزانية (لحد ${money(b.price_max)} ج)`);
    if (b.price_min != null && price < b.price_min) w.push(`الإيجار ${money(price)} ج أقل من الميزانية المتوقعة — اتأكد من الرقم`);
  }
  return w;
}
