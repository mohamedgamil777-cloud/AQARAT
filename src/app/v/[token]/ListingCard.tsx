"use client";

import { useState } from "react";
import { photoUrl } from "@/lib/sb";
import type { Listing, ViewerData, Vote } from "@/lib/types";
import { fmtDate, fromLocalInput, mapLink, money, telLink, timeAgo, waLink } from "@/lib/util";
import { Chat, Down, Phone, Pin, Up, Whats } from "@/components/Icons";

type Props = {
  l: Listing;
  me: "owner" | "partner";
  hunt: ViewerData["hunt"];
  unread: number;
  onVote: (v: Vote) => void;
  onFeature: (f: string) => void;
  onVisit: (iso: string | null, confirmed: boolean) => void;
  onAskOtherTime: () => void;
  onDelete: () => void;
  onChat: () => void;
  onPhotos: (start: number) => void;
};

function verdict(l: Listing, owner: string, partner: string): [string, string] {
  if (l.owner_vote === "like" && l.partner_vote === "like") return ["both", "عجبتكم إنتم الاتنين · حددوا معاينة"];
  if (l.owner_vote === "nope" && l.partner_vote === "nope") return ["out", "إنتم الاتنين قلتوا لأ"];
  if (l.owner_vote && l.partner_vote) return ["split", "رأيكم مختلف · اتكلموا فيه"];
  return ["wait", `مستنيين رأي ${l.owner_vote ? partner : owner}`];
}

export default function ListingCard(p: Props) {
  const { l, me, hunt } = p;
  const [visitInput, setVisitInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [vcls, vtext] = verdict(l, hunt.owner_name, hunt.partner_name);
  const map = mapLink(l);
  const isNew = Date.now() - new Date(l.created_at).getTime() < 24 * 3600 * 1000 && !(me === "owner" ? l.owner_vote : l.partner_vote);
  const waText = `بخصوص العقار في ${l.area ?? "اللي بعته"} بإيجار ${money(l.price)} جنيه`;
  const score = hunt.features.filter((f) => l.features.includes(f)).length;

  const voteBox = (who: "owner" | "partner") => {
    const v = who === "owner" ? l.owner_vote : l.partner_vote;
    const mine = who === me;
    const name = who === "owner" ? hunt.owner_name : hunt.partner_name;
    return (
      <div className="vote">
        <b>{name}{mine ? " (إنت)" : ""}</b>
        <div className="vbtns">
          <button className={`vb like ${v === "like" ? "on" : ""}`} disabled={!mine} aria-pressed={v === "like"}
            onClick={() => p.onVote(v === "like" ? null : "like")}><Up />عجبني</button>
          <button className={`vb nope ${v === "nope" ? "on" : ""}`} disabled={!mine} aria-pressed={v === "nope"}
            onClick={() => p.onVote(v === "nope" ? null : "nope")}><Down />لأ</button>
        </div>
      </div>
    );
  };

  return (
    <article className="card">
      {l.photos.length ? (
        <div className="galwrap">
          <span className="count">{l.photos.length} صورة</span>
          <div className="gal">
            {l.photos.map((ph, i) => (
              <button key={ph} onClick={() => p.onPhotos(i)} aria-label={`افتح الصورة ${i + 1}`}>
                <img src={photoUrl(ph)} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      ) : <div className="nophoto">من غير صور</div>}

      <div className="cbody">
        <div>
          <div className="price">{money(l.price)} <small>ج.م / شهر</small>{isNew && <span className="new">جديد</span>}</div>
          <div>{l.area ?? "بدون عنوان"}</div>
        </div>
        <div className="meta">
          {l.size_m2 != null && <span>{money(l.size_m2)} م²</span>}
          {l.floors != null && <span>{l.floors} أدوار</span>}
          <span>السمسار: {l.broker.name}</span>
          <span>{timeAgo(l.created_at)}</span>
        </div>

        <div className="actions">
          <a className="act call" href={telLink(l.broker.phone)}><Phone />اتصال</a>
          <a className="act wa" href={waLink(l.broker.phone, waText)} target="_blank" rel="noreferrer"><Whats />واتساب</a>
          <a className="act" href={map ?? undefined} aria-disabled={!map} target="_blank" rel="noreferrer"><Pin />الخريطة</a>
          <button className="act" onClick={p.onChat}>
            <Chat />تعليقات
            {p.unread > 0 ? <span className="badge">{p.unread}</span> : l.comments.length > 0 ? <span className="badge" style={{ background: "var(--muted)" }}>{l.comments.length}</span> : null}
          </button>
        </div>
        <div className="sub" style={{ direction: "ltr", textAlign: "right" }}>{l.broker.phone}</div>

        <div className="votes">{voteBox("owner")}{voteBox("partner")}</div>
        <div className={`verdict ${vcls}`}>{vtext}</div>

        <div className="cell">
          <b>ميعاد المعاينة</b>
          {l.visit_confirmed && l.suggested_visit ? (
            <div className="visit done">
              <span>✓ المعاينة: {fmtDate(l.suggested_visit)}</span>
              <div className="row"><button className="link" style={{ color: "var(--muted)", fontWeight: 600 }} onClick={() => p.onVisit(null, false)}>إلغاء الميعاد</button></div>
            </div>
          ) : l.suggested_visit ? (
            <div className="visit sug">
              <span>السمسار مقترح: <b>{fmtDate(l.suggested_visit)}</b></span>
              <div className="row">
                <button className="btn sm" onClick={() => p.onVisit(l.suggested_visit, true)}>تأكيد الميعاد</button>
                <button className="btn sm ghost" onClick={p.onAskOtherTime}>اطلب ميعاد تاني</button>
              </div>
            </div>
          ) : (
            <div className="visit">
              <span className="sub">لسه مفيش ميعاد. السمسار ممكن يقترح، أو حدده إنت.</span>
              <div className="row">
                <input className="input" type="datetime-local" id={`visit-${l.id}`} value={visitInput} onChange={(e) => setVisitInput(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
                <button className="btn sm" disabled={!visitInput} onClick={() => { p.onVisit(fromLocalInput(visitInput), true); setVisitInput(""); }}>حفظ</button>
              </div>
            </div>
          )}
        </div>

        {hunt.features.length > 0 && (
          <div className="cell">
            <b>المميزات المطلوبة <span className="score">{score}/{hunt.features.length}</span></b>
            <div className="chips">
              {hunt.features.map((f) => (
                <button key={f} className={`chip ${l.features.includes(f) ? "on" : ""}`} aria-pressed={l.features.includes(f)} onClick={() => p.onFeature(f)}>{f}</button>
              ))}
            </div>
          </div>
        )}

        {l.raw_text.trim() && (
          <details className="raw">
            <summary>رسالة السمسار الأصلية</summary>
            <p>{l.raw_text}</p>
          </details>
        )}

        {me === "owner" && (
          confirmDelete ? (
            <div className="row" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="sub">تمسح العقار ده نهائي؟</span>
              <button className="btn sm danger" onClick={p.onDelete}>أيوه، امسح</button>
              <button className="btn sm ghost" onClick={() => setConfirmDelete(false)}>لأ</button>
            </div>
          ) : (
            <button className="link" style={{ color: "var(--muted)", fontWeight: 600, fontSize: 13, alignSelf: "flex-start" }} onClick={() => setConfirmDelete(true)}>مسح العقار</button>
          )
        )}
      </div>
    </article>
  );
}
