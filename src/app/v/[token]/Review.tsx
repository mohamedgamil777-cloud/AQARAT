"use client";

import { useEffect, useMemo, useState } from "react";
import { rpc } from "@/lib/sb";
import { useLive } from "@/lib/useLive";
import type { Listing, ViewerData } from "@/lib/types";
import { buildFilters, duplicateIndex, isScheduled, needsScheduling, SORTS, sortListings, type FilterKey, type SortKey } from "@/lib/decisions";
import { Gear, Logo } from "@/components/Icons";
import CompactCard from "./CompactCard";
import DetailsSheet from "./DetailsSheet";
import ChatSheet from "./ChatSheet";
import SettingsSheet, { ShareLinks } from "./SettingsSheet";
import Lightbox from "./Lightbox";

const EMPTY: Record<FilterKey, string> = {
  active: "مفيش عقارات نشطة دلوقتي.",
  mine: "مفيش حاجة مستنية رأيك 👌",
  partner: "مفيش حاجة مستنية رأي شريكك.",
  approved: "لسه مفيش عقار وافقتوا عليه إنتم الاتنين.",
  split: "مفيش عقارات رأيكم فيها مختلف.",
  comments: "مفيش عقارات عليها تعليقات لسه. أي ملاحظة بينك وبين شريكك أو رسالة مع السمسار هتظهر العقار هنا.",
  visits: "مفيش معاينات. أي عقار توافقوا عليه إنتم الاتنين هيظهر هنا عشان تحددوا ميعاد.",
  dup: "مفيش عقارات مكررة.",
  rejected: "مفيش عقارات مرفوضة. أي عقار تقولوا عليه إنتم الاتنين «لأ» هيتنقل هنا.",
};

export default function Review({ token, initial }: { token: string; initial: ViewerData }) {
  const [data, reload, setData] = useLive(initial, () => rpc<ViewerData>("viewer_view", { p_token: token }));
  const [filter, setFilter] = useState<FilterKey>("active");
  const [sort, setSort] = useState<SortKey>("new");
  const [openId, setOpenId] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [photos, setPhotos] = useState<{ list: string[]; start: number } | null>(null);
  const [seen, setSeen] = useState<Record<string, number>>({});

  const me = data.role;
  const { hunt, listings } = data;
  const myName = me === "owner" ? hunt.owner_name : hunt.partner_name;
  const otherName = me === "owner" ? hunt.partner_name : hunt.owner_name;

  const { links, candidates, byId } = useMemo(() => duplicateIndex(listings, data.duplicates), [listings, data.duplicates]);
  const filters = useMemo(() => buildFilters(me, otherName, candidates), [me, otherName, candidates]);
  const current = filters.find((f) => f.key === filter) ?? filters[0];
  const shown = useMemo(() => {
    const list = sortListings(listings.filter(current.test), sort, me);
    // In the comments tab, "newest" means the building discussed most recently.
    if (current.key !== "comments" || sort !== "new") return list;
    const lastAt = (l: Listing) => Math.max(0, ...l.comments.map((c) => +new Date(c.created_at)));
    return [...list].sort((a, b) => lastAt(b) - lastAt(a));
  }, [listings, current, sort, me]);

  // Per-viewer conveniences: remembered sort + how many comments were read per building.
  const seenKey = `aqarat-seen-${token}`;
  useEffect(() => {
    try { setSeen(JSON.parse(localStorage.getItem(seenKey) || "{}")); } catch {}
    try { const s = localStorage.getItem("aqarat-sort") as SortKey | null; if (s && SORTS.some(([k]) => k === s)) setSort(s); } catch {}
  }, [seenKey]);
  function pickSort(s: SortKey) { setSort(s); try { localStorage.setItem("aqarat-sort", s); } catch {} }
  function markSeen(l: Listing) {
    const next = { ...seen, [l.id]: l.comments.length };
    setSeen(next);
    try { localStorage.setItem(seenKey, JSON.stringify(next)); } catch {}
  }
  const unread = (l: Listing) => Math.max(0, l.comments.length - (seen[l.id] ?? 0));

  /** Runs an RPC, patches the list optimistically (counts move at once), then refreshes from the server. */
  async function act(fn: string, args: Record<string, unknown>, patch?: (l: Listing) => Listing, id?: string) {
    if (patch && id) setData((d) => ({ ...d, listings: d.listings.map((l) => (l.id === id ? patch(l) : l)) }));
    try { await rpc(fn, { p_token: token, ...args }); } finally { await reload(); }
  }

  const open = openId ? byId.get(openId) ?? null : null;
  const chatListing = chatId ? byId.get(chatId) ?? null : null;
  const visitsScheduled = shown.filter(isScheduled);
  const visitsPending = shown.filter((l) => !isScheduled(l) && needsScheduling(l, me));

  const card = (l: Listing) => (
    <CompactCard key={l.id} l={l} me={me} hunt={hunt} isDup={candidates.has(l.id)} unread={unread(l)} onOpen={() => { setOpenId(l.id); markSeen(l); }} />
  );

  return (
    <main className="dash">
      <header className="dtop">
        <span className="tlogo"><Logo /></span>
        <div className="t">
          <b>المباني</b>
          <small>إنت: {myName} · {listings.filter(filters[0].test).length} عقار نشط</small>
        </div>
        {me === "owner" && (
          <button className="x" aria-label="الإعدادات" onClick={() => setSettings(true)} style={{ display: "grid", placeItems: "center" }}>
            <span style={{ width: 20, height: 20, display: "block" }}><Gear /></span>
          </button>
        )}
      </header>

      <div className="dwrap">
        {listings.length === 0 ? (
          <>
            <div className="empty">
              <b>لسه مفيش مباني</b>
              <p>ابعت لينك السماسرة على واتساب، وأول ما حد يبعت عقار هيظهر هنا.</p>
            </div>
            <ShareLinks hunt={hunt} role={me} />
          </>
        ) : (
          <>
            <nav className="tickets" role="tablist" aria-label="تصنيف العقارات">
              {filters.map((f) => {
                const n = listings.filter(f.test).length;
                if (f.hideWhenEmpty && n === 0 && filter !== f.key) return null;
                return (
                  <button key={f.key} role="tab" aria-selected={filter === f.key}
                    className={`ticket ${filter === f.key ? "on" : ""} ${f.tone ? "t-" + f.tone : ""} ${n === 0 ? "zero" : ""}`}
                    onClick={() => setFilter(f.key)}>
                    <span className="tl">{f.label}</span>
                    <span className="tn">{n}</span>
                  </button>
                );
              })}
            </nav>

            <div className="toolbar">
              <span className="muted">{shown.length} عقار</span>
              <label className="sortsel">
                ترتيب:
                <select value={sort} onChange={(e) => pickSort(e.target.value as SortKey)} aria-label="ترتيب">
                  {SORTS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                </select>
              </label>
            </div>

            {filter === "dup" && shown.length > 0 && (
              <p className="note warn">دي العقارات الأحدث اللي شكلها نفس عقار اتبعت قبل كده (نفس الصور أو اللوكيشن أو الرسالة). افتح التفاصيل وقارن، ولو مش مكرر دوس «مش مكرر» وهيرجع للقائمة.</p>
            )}
            {filter === "rejected" && shown.length > 0 && (
              <p className="note">العقارات اللي إنتم الاتنين قلتوا عليها لأ. لو حد غيّر رأيه هترجع للقائمة.</p>
            )}

            {shown.length === 0 && <div className="empty">{EMPTY[filter]}</div>}

            {filter === "visits" ? (
              <>
                {visitsScheduled.length > 0 && <h2 className="ghead">📅 معاينات متحددة · {visitsScheduled.length}</h2>}
                <div className="cgrid">{visitsScheduled.map(card)}</div>
                {visitsPending.length > 0 && <h2 className="ghead">⏳ محتاجة ميعاد · {visitsPending.length}</h2>}
                <div className="cgrid">{visitsPending.map(card)}</div>
              </>
            ) : (
              <div className="cgrid">{shown.map(card)}</div>
            )}
          </>
        )}
      </div>

      {open && (
        <DetailsSheet
          key={open.id} l={open} me={me} hunt={hunt} dups={links.get(open.id) ?? []}
          onClose={() => setOpenId(null)}
          onVote={(v) => act("viewer_vote", { p_listing: open.id, p_vote: v }, (x) => ({ ...x, [me === "owner" ? "owner_vote" : "partner_vote"]: v }), open.id)}
          onFeature={(f) => act("viewer_toggle_feature", { p_listing: open.id, p_feature: f },
            (x) => ({ ...x, features: x.features.includes(f) ? x.features.filter((y) => y !== f) : [...x.features, f] }), open.id)}
          onVisit={(iso, ok) => act("viewer_set_visit", { p_listing: open.id, p_visit: iso, p_confirmed: ok },
            (x) => ({ ...x, suggested_visit: iso, visit_confirmed: !!iso && ok }), open.id)}
          onAskOtherTime={async () => {
            await rpc("viewer_comment", { p_token: token, p_listing: open.id, p_body: "الميعاد ده مش مناسب لنا، ممكن تقترح ميعاد تاني؟", p_private: false });
            await act("viewer_set_visit", { p_listing: open.id, p_visit: null, p_confirmed: false });
          }}
          onDelete={() => {
            const id = open.id;
            setData((d) => ({ ...d, listings: d.listings.filter((x) => x.id !== id) }));
            act("viewer_delete_listing", { p_listing: id });
          }}
          onChat={() => { setChatId(open.id); markSeen(open); }}
          onComment={async (body, priv) => {
            await rpc("viewer_comment", { p_token: token, p_listing: open.id, p_body: body, p_private: priv });
            await reload();
            markSeen({ ...open, comments: [...open.comments, { id: "x", author: me, body, private: priv, created_at: "" }] });
          }}
          onPhotos={(start) => setPhotos({ list: open.photos, start })}
          onOpenOther={(id) => setOpenId(id)}
          onNotDup={(other) => {
            const id = open.id;
            setData((d) => ({ ...d, duplicates: (d.duplicates ?? []).filter((x) => !((x.a === id && x.b === other) || (x.b === id && x.a === other))) }));
            act("viewer_dismiss_duplicate", { p_a: id, p_b: other });
          }}
        />
      )}
      {chatListing && (
        <ChatSheet
          l={chatListing} me={me} hunt={hunt} token={token}
          onClose={() => { markSeen(chatListing); setChatId(null); }}
          onSent={async () => { await reload(); }}
        />
      )}
      {settings && <SettingsSheet hunt={hunt} token={token} brokers={data.brokers ?? []} onClose={() => setSettings(false)} onSaved={reload} />}
      {photos && <Lightbox list={photos.list} start={photos.start} onClose={() => setPhotos(null)} />}
    </main>
  );
}
