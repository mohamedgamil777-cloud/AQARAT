"use client";

import { useState } from "react";
import { photoUrl, rpc } from "@/lib/sb";
import { useLive } from "@/lib/useLive";
import type { BrokerData, Listing } from "@/lib/types";
import { errorText, fmtDate, fromLocalInput, money, timeAgo, toLocalInput, waLink } from "@/lib/util";
import { Logo, Send, Whats } from "@/components/Icons";
import EditListing from "./EditListing";
import { clearSession } from "@/lib/session";
import BriefCard from "@/components/BriefCard";

function status(l: Listing): [string, string] {
  if (l.visit_confirmed && l.suggested_visit) return ["v", `المعاينة اتأكدت · ${fmtDate(l.suggested_visit)}`];
  const both = l.owner_vote === "like" && l.partner_vote === "like";
  if (both) return ["y", l.suggested_visit ? "عجبهم · مستنيين يأكدوا الميعاد" : "عجبهم · اقترح ميعاد معاينة"];
  if (l.owner_vote && l.partner_vote) return ["n", "مش مناسب ليهم"];
  return ["w", "تحت المراجعة"];
}

export default function BrokerInbox({ token, initial }: { token: string; initial: BrokerData }) {
  const [data, reload] = useLive(initial, () => rpc<BrokerData>("broker_view", { p_token: token }));
  const owner = data.hunt.owner_name;

  return (
    <main className="app brand soft">
      <header className="top">
        <span className="tlogo"><Logo /></span>
        <div className="t">
          <b>عقاراتي مع {owner}</b>
          <small>{data.listings.length} عقار · {data.broker.name}</small>
        </div>
        <a className="btn sm" href={`/b/${data.hunt.invite}`}>+ عقار جديد</a>
      </header>
      <div className="who" style={{ margin: "10px 16px 0" }}>
        <span>داخل باسم <b>{data.broker.name}</b> <span className="ltr-inline">{data.broker.phone}</span></span>
        <button type="button" className="link" onClick={() => { clearSession(); window.location.href = `/b/${data.hunt.invite}`; }}>خروج</button>
      </div>
      <div className="pad">
        <BriefCard brief={data.hunt.brief} features={data.hunt.features ?? []} ownerName={owner} compact />
        {data.listings.length === 0 && (
          <div className="empty"><b>لسه مبعتش عقارات</b><a className="btn" href={`/b/${data.hunt.invite}`}>ابعت أول عقار</a></div>
        )}
        {data.listings.map((l) => (
          <Item key={l.id} l={l} token={token} owner={owner} ownerPhone={data.hunt.owner_phone} checklist={data.hunt.features ?? []} reload={reload} />
        ))}
      </div>
    </main>
  );
}

function Item({ l, token, owner, ownerPhone, checklist, reload }: { l: Listing; token: string; owner: string; ownerPhone: string | null; checklist: string[]; reload: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [text, setText] = useState("");
  const [visit, setVisit] = useState(toLocalInput(l.suggested_visit));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const [cls, label] = status(l);
  const liked = l.owner_vote === "like" && l.partner_vote === "like";

  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setErr("");
    try { await fn(); await reload(); return true; } catch (e) { setErr(errorText(e)); return false; } finally { setBusy(false); }
  }

  async function reply(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    if (await act(() => rpc("broker_reply", { p_token: token, p_listing: l.id, p_body: body }))) { setText(""); setSent(true); }
  }

  const title = `${l.area ?? "العقار"} · ${money(l.price)} ج`;

  return (
    <article className="bitem">
      <div className="bhead">
        {l.photos[0] ? <img src={photoUrl(l.photos[0])} alt="" /> : <div className="ph" />}
        <div>
          <b>{money(l.price)} ج.م / شهر</b>
          <div className="sub">{l.area ?? "بدون عنوان"} · {l.photos.length} صورة · {timeAgo(l.created_at)}{l.edited_at ? ` · اتعدّل ${timeAgo(l.edited_at)}` : ""}</div>
          <span className={`status ${cls}`}>{label}</span>
        </div>
        {!editing && <button className="btn sm ghost" onClick={() => { setEditing(true); setEdited(false); }}>تعديل</button>}
      </div>

      {editing && (
        <>
          <EditListing l={l} token={token} checklist={checklist}
            onClose={async (saved) => { setEditing(false); setConfirmDel(false); if (saved) { setEdited(true); await reload(); } }} />
          {confirmDel ? (
            <div className="delrow">
              <span>تمسح العقار ده نهائي؟ {owner} مش هيشوفه تاني.</span>
              <button className="btn sm danger" disabled={busy}
                onClick={() => act(() => rpc("broker_delete_listing", { p_token: token, p_listing: l.id }))}>أيوه، امسح</button>
              <button className="btn sm ghost" onClick={() => setConfirmDel(false)}>لأ</button>
            </div>
          ) : (
            <button className="link delink" onClick={() => setConfirmDel(true)}>مسح العقار كله</button>
          )}
        </>
      )}
      {edited && !editing && (
        <>
          <div className="ok">اتحفظ التعديل ✓ {owner} هيشوفه على طول</div>
          {ownerPhone && (
            <a className="btn wa sm" href={waLink(ownerPhone, `عدّلت بيانات العقار: ${title}`)} target="_blank" rel="noreferrer">
              <Whats /> بلّغ {owner} على واتساب
            </a>
          )}
        </>
      )}

      {l.comments.length > 0 && (
        <div className="bthread">
          {l.comments.map((c) => (
            <div key={c.id} className={`msg ${c.author === "broker" ? "mine" : ""}`}>
              <small>{c.author === "broker" ? "إنت" : c.author === "owner" ? owner : "الشريك"} · {timeAgo(c.created_at)}</small>
              {c.body}
            </div>
          ))}
        </div>
      )}

      {!l.visit_confirmed && (
        <div className={liked ? "box" : ""} style={liked ? {} : { display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="field">
            <span>{liked ? "اقترح ميعاد معاينة" : "ميعاد معاينة مقترح"} {!liked && <em>(اختياري)</em>}</span>
            <div className="inline-form">
              <input className="input" type="datetime-local" id={`v-${l.id}`} value={visit} onChange={(e) => setVisit(e.target.value)} />
              <button className="btn sm" type="button" disabled={busy || !visit || toLocalInput(l.suggested_visit) === visit}
                onClick={() => act(() => rpc("broker_suggest_visit", { p_token: token, p_listing: l.id, p_visit: fromLocalInput(visit) }))}>
                حفظ
              </button>
            </div>
          </label>
          {l.suggested_visit && <span className="hint">الميعاد المقترح دلوقتي: {fmtDate(l.suggested_visit)}</span>}
        </div>
      )}

      <form className="inline-form" onSubmit={reply}>
        <input className="input" id={`r-${l.id}`} value={text} onChange={(e) => setText(e.target.value)} placeholder={`اكتب رد لـ${owner}…`} autoComplete="off" />
        <button className="sendico" aria-label="إرسال" disabled={busy}><Send /></button>
      </form>
      {err && <div className="err">{err}</div>}
      {sent && ownerPhone && (
        <a className="btn wa sm" href={waLink(ownerPhone, `رديت على العقار: ${title}`)} target="_blank" rel="noreferrer">
          <Whats /> بلّغ {owner} على واتساب
        </a>
      )}
    </article>
  );
}
