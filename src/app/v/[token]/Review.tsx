"use client";

import { useEffect, useState } from "react";
import { rpc } from "@/lib/sb";
import { useLive } from "@/lib/useLive";
import type { DupReason, Listing, ViewerData } from "@/lib/types";
import { Gear, Logo } from "@/components/Icons";
import ListingCard from "./ListingCard";
import ChatSheet from "./ChatSheet";
import SettingsSheet, { ShareLinks } from "./SettingsSheet";
import Lightbox from "./Lightbox";

const both = (l: Listing) => l.owner_vote === "like" && l.partner_vote === "like";
// Rejected = both of you said no. It leaves every tab except "مرفوضة"; a split vote stays visible to talk about.
const rejected = (l: Listing) => l.owner_vote === "nope" && l.partner_vote === "nope";
const active = (l: Listing) => !rejected(l);

export default function Review({ token, initial }: { token: string; initial: ViewerData }) {
  const [data, reload, setData] = useLive(initial, () => rpc<ViewerData>("viewer_view", { p_token: token }));
  const [filter, setFilter] = useState("all");
  const [chatId, setChatId] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [photos, setPhotos] = useState<{ list: string[]; start: number } | null>(null);
  const [seen, setSeen] = useState<Record<string, number>>({});

  const me = data.role;
  const myVote = (l: Listing) => (me === "owner" ? l.owner_vote : l.partner_vote);
  const { hunt, listings } = data;

  // Possible duplicates, per building: the other building and why they look the same.
  const byId = new Map(listings.map((l) => [l.id, l]));
  const dupOf = new Map<string, { other: Listing; reasons: DupReason[] }[]>();
  for (const d of data.duplicates ?? []) {
    const a = byId.get(d.a), b = byId.get(d.b);
    if (!a || !b) continue;
    dupOf.set(a.id, [...(dupOf.get(a.id) ?? []), { other: b, reasons: d.reasons }]);
    dupOf.set(b.id, [...(dupOf.get(b.id) ?? []), { other: a, reasons: d.reasons }]);
  }
  const dupPairs = (data.duplicates ?? []).filter((d) => byId.has(d.a) && byId.has(d.b)).length;

  function jump(id: string) {
    if (!FILTERS.find((f) => f[0] === filter)![2](byId.get(id)!)) setFilter("all");
    setTimeout(() => {
      const el = document.getElementById(`l-${id}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 1600);
    }, 50);
  }

  // Remembers how many comments this viewer has read per building, to flag new ones.
  const seenKey = `aqarat-seen-${token}`;
  useEffect(() => { try { setSeen(JSON.parse(localStorage.getItem(seenKey) || "{}")); } catch {} }, [seenKey]);
  function markSeen(l: Listing) {
    const next = { ...seen, [l.id]: l.comments.length };
    setSeen(next);
    try { localStorage.setItem(seenKey, JSON.stringify(next)); } catch {}
  }

  const FILTERS: [string, string, (l: Listing) => boolean][] = [
    ["all", "الكل", active],
    ["mine", "مستني رأيي", (l) => active(l) && !myVote(l)],
    ["both", "عجبتنا إحنا الاتنين", both],
    ["visit", "معاينات", (l) => active(l) && !!l.suggested_visit],
    ["dup", "مكرر محتمل", (l) => dupOf.has(l.id)],
    ["no", "مرفوضة", rejected],
  ];
  const shown = listings.filter(FILTERS.find((f) => f[0] === filter)![2]);
  const chatListing = listings.find((l) => l.id === chatId) ?? null;
  const visits = listings.filter((l) => l.visit_confirmed).length;

  /** Runs an RPC, patches the list optimistically, then refreshes from the server. */
  async function act(fn: string, args: Record<string, unknown>, patch?: (l: Listing) => Listing, id?: string) {
    if (patch && id) setData((d) => ({ ...d, listings: d.listings.map((l) => (l.id === id ? patch(l) : l)) }));
    try { await rpc(fn, { p_token: token, ...args }); } finally { await reload(); }
  }

  return (
    <main className="app brand soft">
      <header className="top">
        <span className="tlogo"><Logo /></span>
        <div className="t">
          <b>المباني · {listings.filter(active).length}</b>
          <small>{listings.filter(both).length} عجبتكم إنتم الاتنين · {visits} معاينة متأكدة · إنت: {me === "owner" ? hunt.owner_name : hunt.partner_name}</small>
        </div>
        {me === "owner" && (
          <button className="x" aria-label="الإعدادات" onClick={() => setSettings(true)} style={{ display: "grid", placeItems: "center" }}>
            <span style={{ width: 20, height: 20, display: "block" }}><Gear /></span>
          </button>
        )}
      </header>

      <div className="pad">
        {listings.length > 0 && (
          <div className="filters" role="tablist">
            {FILTERS.map(([k, n, fn]) => (
              (k !== "dup" || dupOf.size > 0) && <button key={k} className={`fchip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)} role="tab" aria-selected={filter === k}>
                {n} · {listings.filter(fn).length}
              </button>
            ))}
          </div>
        )}

        {dupPairs > 0 && filter !== "dup" && (
          <button className="dupbar" onClick={() => setFilter("dup")}>
            <span>⚠ فيه {dupPairs === 1 ? "مبنى ممكن يكون متكرر" : `${dupPairs} مباني ممكن تكون متكررة`} من سماسرة مختلفين — راجعهم</span>
            <span style={{ flex: "none" }}>←</span>
          </button>
        )}
        {filter === "dup" && shown.length > 0 && (
          <p className="hint">دي مباني شكلها نفس المكان (نفس الصور أو اللوكيشن أو الرسالة). لو مش مكررة دوس «مش مكرر» والتنبيه هيختفي. السماسرة مش بيشوفوا التنبيه ده.</p>
        )}
        {listings.length === 0 && (
          <div className="empty" style={{ paddingBottom: 8 }}>
            <b>لسه مفيش مباني</b>
            <p>ابعت لينك السماسرة على واتساب، وأول ما حد يبعت عقار هيظهر هنا.</p>
          </div>
        )}
        {listings.length === 0 && <ShareLinks hunt={hunt} role={me} />}
        {filter === "no" && shown.length > 0 && (
          <p className="hint">دي المباني اللي إنتم الاتنين قلتوا عليها لأ. لو حد فيكم غيّر رأيه ودوس «عجبني» هترجع للقائمة.</p>
        )}
        {listings.length > 0 && shown.length === 0 && (
          <div className="empty">{filter === "no" ? "مفيش مباني مرفوضة. أي مبنى تقولوا عليه إنتم الاتنين «لأ» هيتنقل هنا." : "مفيش مباني هنا."}</div>
        )}

        {shown.map((l) => (
          <ListingCard
            key={l.id} l={l} me={me} hunt={hunt} unread={Math.max(0, l.comments.length - (seen[l.id] ?? 0))}
            onVote={(v) => act("viewer_vote", { p_listing: l.id, p_vote: v }, (x) => ({ ...x, [me === "owner" ? "owner_vote" : "partner_vote"]: v }), l.id)}
            onFeature={(f) => act("viewer_toggle_feature", { p_listing: l.id, p_feature: f },
              (x) => ({ ...x, features: x.features.includes(f) ? x.features.filter((y) => y !== f) : [...x.features, f] }), l.id)}
            onVisit={(iso, ok) => act("viewer_set_visit", { p_listing: l.id, p_visit: iso, p_confirmed: ok },
              (x) => ({ ...x, suggested_visit: iso, visit_confirmed: !!iso && ok }), l.id)}
            onAskOtherTime={async () => {
              await rpc("viewer_comment", { p_token: token, p_listing: l.id, p_body: "الميعاد ده مش مناسب لنا، ممكن تقترح ميعاد تاني؟", p_private: false });
              await act("viewer_set_visit", { p_listing: l.id, p_visit: null, p_confirmed: false });
            }}
            onDelete={() => act("viewer_delete_listing", { p_listing: l.id })}
            onChat={() => { setChatId(l.id); markSeen(l); }}
            onPhotos={(start) => setPhotos({ list: l.photos, start })}
            dups={dupOf.get(l.id) ?? []}
            onJump={jump}
            onNotDup={(other) => {
              setData((d) => ({ ...d, duplicates: (d.duplicates ?? []).filter((x) => !((x.a === l.id && x.b === other) || (x.b === l.id && x.a === other))) }));
              act("viewer_dismiss_duplicate", { p_a: l.id, p_b: other });
            }}
          />
        ))}
      </div>

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
