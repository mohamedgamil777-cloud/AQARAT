import type { DupReason, Duplicate, Listing, Vote } from "./types";

export type Role = "owner" | "partner";
export type Decision = "approved" | "rejected" | "split" | "waiting_me" | "waiting_partner";

const mine = (l: Listing, me: Role): Vote => (me === "owner" ? l.owner_vote : l.partner_vote);
const theirs = (l: Listing, me: Role): Vote => (me === "owner" ? l.partner_vote : l.owner_vote);

/**
 * One decision per building, from the two votes (existing rules, unchanged):
 * both like → approved · both no → rejected · one yes + one no → split (needs agreement)
 * my vote missing → waiting for me · I voted, partner missing → waiting for partner.
 */
export function decision(l: Listing, me: Role): Decision {
  const o = l.owner_vote, p = l.partner_vote;
  if (o === "like" && p === "like") return "approved";
  if (o === "nope" && p === "nope") return "rejected";
  if (o && p) return "split";
  if (!mine(l, me)) return "waiting_me";
  return "waiting_partner";
}

/** A viewing counts as scheduled only when a real date is saved and confirmed. */
export const isScheduled = (l: Listing) => l.visit_confirmed && !!l.suggested_visit;
/** Needs a viewing date: approved by both (or the broker proposed a time) but nothing confirmed yet. */
export const needsScheduling = (l: Listing, me: Role) =>
  !isScheduled(l) && (decision(l, me) === "approved" || !!l.suggested_visit);

export interface DupLink { other: Listing; reasons: DupReason[]; isCandidate: boolean }

/**
 * Duplicate flag — independent of the votes. In each matching pair the NEWER building is the
 * "candidate" (kept out of the active list); the older one stays where it is.
 */
export function duplicateIndex(listings: Listing[], dups: Duplicate[] | undefined) {
  const byId = new Map(listings.map((l) => [l.id, l]));
  const links = new Map<string, DupLink[]>();
  const candidates = new Set<string>();
  for (const d of dups ?? []) {
    const a = byId.get(d.a), b = byId.get(d.b);
    if (!a || !b) continue;
    const [older, newer] = new Date(a.created_at) <= new Date(b.created_at) ? [a, b] : [b, a];
    candidates.add(newer.id);
    links.set(newer.id, [...(links.get(newer.id) ?? []), { other: older, reasons: d.reasons, isCandidate: true }]);
    links.set(older.id, [...(links.get(older.id) ?? []), { other: newer, reasons: d.reasons, isCandidate: false }]);
  }
  return { links, candidates, byId };
}

export type FilterKey = "active" | "mine" | "partner" | "approved" | "split" | "visits" | "dup" | "rejected";

export interface FilterDef { key: FilterKey; label: string; test: (l: Listing) => boolean; tone?: "warn" | "no"; hideWhenEmpty?: boolean }

export function buildFilters(me: Role, partnerName: string, candidates: Set<string>): FilterDef[] {
  const rejected = (l: Listing) => decision(l, me) === "rejected";
  const dup = (l: Listing) => candidates.has(l.id) && !rejected(l);
  const active = (l: Listing) => !rejected(l) && !dup(l);
  return [
    { key: "active", label: "الكل", test: active },
    { key: "mine", label: "مستني رأيي", test: (l) => active(l) && decision(l, me) === "waiting_me" },
    { key: "partner", label: `مستني ${partnerName}`, test: (l) => active(l) && decision(l, me) === "waiting_partner" },
    { key: "approved", label: "موافقين إحنا الاتنين", test: (l) => active(l) && decision(l, me) === "approved" },
    { key: "split", label: "محتاج اتفاق", test: (l) => active(l) && decision(l, me) === "split", hideWhenEmpty: true },
    { key: "visits", label: "معاينات", test: (l) => active(l) && (isScheduled(l) || needsScheduling(l, me)) },
    { key: "dup", label: "مكرر محتمل", test: dup, tone: "warn" },
    { key: "rejected", label: "مرفوضة", test: rejected, tone: "no" },
  ];
}

export type SortKey = "new" | "rent_low" | "rent_high" | "size" | "location" | "pending";
export const SORTS: [SortKey, string][] = [
  ["new", "الأحدث"],
  ["pending", "المستني رأيي الأول"],
  ["rent_low", "الإيجار: الأقل"],
  ["rent_high", "الإيجار: الأعلى"],
  ["size", "المساحة: الأكبر"],
  ["location", "المنطقة"],
];

const PENDING_ORDER: Record<Decision, number> = { waiting_me: 0, split: 1, waiting_partner: 2, approved: 3, rejected: 4 };

export function sortListings(list: Listing[], key: SortKey, me: Role): Listing[] {
  const newest = (a: Listing, b: Listing) => +new Date(b.created_at) - +new Date(a.created_at);
  const last = (n: number | null, asc: boolean) => (n == null ? (asc ? Infinity : -Infinity) : n);
  const s = [...list];
  switch (key) {
    case "rent_low": return s.sort((a, b) => last(a.price, true) - last(b.price, true) || newest(a, b));
    case "rent_high": return s.sort((a, b) => last(b.price, false) - last(a.price, false) || newest(a, b));
    case "size": return s.sort((a, b) => last(b.size_m2, false) - last(a.size_m2, false) || newest(a, b));
    case "location": return s.sort((a, b) => (locationOf(a) ?? "ي").localeCompare(locationOf(b) ?? "ي", "ar") || newest(a, b));
    case "pending": return s.sort((a, b) => PENDING_ORDER[decision(a, me)] - PENDING_ORDER[decision(b, me)] || newest(a, b));
    default: return s.sort(newest);
  }
}

// ── What kind of property / where, read from the broker's text ─────────────────────────────────
const TYPES: [RegExp, string][] = [
  [/مبنى|مبني|عمار[ةه]|\bbuilding\b/i, "مبنى"],
  [/فيلا|ڤيلا|\bvilla\b/i, "فيلا"],
  [/مخزن|مستودع|هنجر|هناجر|\bwarehouse\b|\bstore ?house\b/i, "مخزن"],
  [/مصنع|\bfactory\b/i, "مصنع"],
  [/محل|معرض|\bshop\b|\bshowroom\b|\bretail\b/i, "محل"],
  [/دوبلكس|\bdou?ble?x\b/i, "دوبلكس"],
  [/\bfull floor\b|دور كامل/i, "دور كامل"],
  [/مكتب|إداري|اداري|\boffice\b|\badministrative\b/i, "مكتب"],
  [/شق[ةه]|\bapartment\b|\bflat\b/i, "شقة"],
  [/أرض |ارض |\bland\b|\bplot\b/i, "أرض"],
];

export function typeOf(l: Listing): string {
  const t = `${l.area ?? ""} ${l.raw_text}`;
  let best: [number, string] | null = null;
  for (const [re, name] of TYPES) {
    const m = t.match(re);
    if (m && m.index != null && (!best || m.index < best[0])) best = [m.index, name];
  }
  return best ? best[1] : "عقار";
}

// Longest names first so "زهراء المعادي" wins over "المعادي".
const PLACES = [
  "زهراء المعادي", "المعادي الجديدة", "كورنيش المعادي", "حدائق المعادي", "ثكنات المعادي", "المعادي", "دجلة", "صقر قريش",
  "البساتين", "دار السلام", "طره", "حلوان", "المقطم", "القطامية", "التجمع الخامس", "التجمع", "الرحاب", "مدينتي", "الشروق",
  "مدينة نصر", "مصر الجديدة", "النزهة", "العبور", "العاشر", "وسط البلد", "الزمالك", "جاردن سيتي", "الدقي", "المهندسين",
  "العجوزة", "الهرم", "فيصل", "الشيخ زايد", "زايد", "أكتوبر", "اكتوبر", "حدائق الأهرام", "شبرا", "العباسية",
].sort((a, b) => b.length - a.length);

// English spellings brokers use → the Arabic name shown on the card (most specific first).
const PLACES_EN: [RegExp, string][] = [
  [/zahraa?\s*(el[- ]?)?maadi/i, "زهراء المعادي"],
  [/new\s*maadi|maadi\s*(el[- ]?)?gedida/i, "المعادي الجديدة"],
  [/degla/i, "دجلة"],
  [/(cornish|corniche|kornish).{0,25}maadi|maadi.{0,40}(cornish|corniche|kornish)/is, "كورنيش المعادي"],
  [/sarayat|سرايات/i, "سرايات المعادي"],
  [/sakr\s*(k|q)ura?ish/i, "صقر قريش"],
  [/(el[- ]?)?maadi/i, "المعادي"],
  [/new\s*cairo|tagamo?u?3?|fifth settlement/i, "التجمع"],
  [/nasr\s*city/i, "مدينة نصر"],
  [/heliopolis|masr\s*el\s*gedida/i, "مصر الجديدة"],
  [/mokattam/i, "المقطم"],
  [/helwan/i, "حلوان"],
  [/zamalek/i, "الزمالك"],
  [/dokki/i, "الدقي"],
  [/mohandessin/i, "المهندسين"],
  [/sheikh\s*zayed|zayed/i, "الشيخ زايد"],
  [/october/i, "أكتوبر"],
];

export function locationOf(l: Listing): string | null {
  // "Close to the Corniche" / "قريب من المترو" describes what's nearby, not where the building is.
  const t = `${l.area ?? ""}\n${l.raw_text}`
    .replace(/(close to|near(by)?|next to|minutes? (from|to)|walking distance|قريب من|قريبة من|جنب|بجوار|دقايق من|دقائق من)[^\n]*/gi, "");
  for (const p of PLACES) if (t.includes(p)) return p === "اكتوبر" ? "أكتوبر" : p;
  for (const [re, name] of PLACES_EN) if (re.test(t)) return name;
  return null;
}

/** First line of the broker's message, minus filler, as a one-line title. */
export function titleOf(l: Listing): string {
  const s = (l.area ?? l.raw_text.split("\n").find((x) => x.trim()) ?? "").trim();
  return s.replace(/^(للإيجار|للايجار|متاح|يوجد)\s*[:،-]?\s*/, "") || "بدون عنوان";
}
