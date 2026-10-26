"use client";

import { useEffect, useState } from "react";
import { photoUrl } from "@/lib/sb";
import type { Listing, ViewerData, Vote } from "@/lib/types";
import { decision, isScheduled, locationOf, titleOf, typeOf, type DupLink, type Role } from "@/lib/decisions";
import { fmtDate, fromLocalInput, mapLink, money, telLink, timeAgo, waLink } from "@/lib/util";
import { Chat, Down, Phone, Pin, Up, Whats } from "@/components/Icons";
import { VoteBadge } from "./CompactCard";

const FIELD_NAMES: Record<string, string> = {
  price: "الإيجار", text: "الوصف", area: "العنوان", size: "المساحة", floors: "الأدوار", photos: "الصور",
};
const WHY: Record<string, string> = { photos: "نفس الصور", map: "نفس اللوكيشن", text: "نفس رسالة الواتساب", area: "نفس العنوان والأرقام" };

const VERDICT: Record<string, [string, string]> = {
  approved: ["ok", "موافقين إنتم الاتنين · حددوا معاينة"],
  rejected: ["no", "إنتم الاتنين قلتوا لأ"],
  split: ["split", "رأيكم مختلف · اتفقوا"],
};

type Props = {
  l: Listing;
  me: Role;
  hunt: ViewerData["hunt"];
  dups: DupLink[];
  onClose: () => void;
  onVote: (v: Vote) => void;
  onFeature: (f: string) => void;
  onVisit: (iso: string | null, confirmed: boolean) => void;
  onAskOtherTime: () => void;
  onDelete: () => void;
  onChat: () => void;
  onPhotos: (start: number) => void;
  onOpenOther: (id: string) => void;
  onNotDup: (otherId: string) => void;
};

/** Everything about one building: photos, both votes, viewing, features, broker message, comments, delete. */
export default function DetailsSheet(p: Props) {
  const { l, me, hunt } = p;
  const [visitInput, setVisitInput] = useState("");
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const d = decision(l, me);
  const myVote = me === "owner" ? l.owner_vote : l.partner_vote;
  const loc = locationOf(l);
  const map = mapLink(l);
  const waText = `بخصوص ${typeOf(l)} ${loc ? `في ${loc} ` : ""}بإيجار ${money(l.price)} جنيه`;
  const ed = (f: string) => !!l.edited_fields?.includes(f);
  const score = hunt.features.filter((f) => l.features.includes(f)).length;
  const waitingFor = d === "waiting_me" ? "مستني رأيك" : d === "waiting_partner" ? `مستنيين رأي ${me === "owner" ? hunt.partner_name : hunt.owner_name}` : null;
  const [vcls, vtext] = VERDICT[d] ?? ["wait", waitingFor ?? ""];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") p.onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="sheet-bg dsheet-bg" onClick={p.onClose}>
      <div className="sheet dsheet" role="dialog" aria-modal="true" aria-label="تفاصيل العقار" onClick={(e) => e.stopPropagation()}>
        <header className="dhead">
          <div className="t">
            <b>{typeOf(l)} · {titleOf(l)}</b>
            <small>{loc ? `${loc} · ` : ""}{l.broker.name} · {timeAgo(l.created_at)}</small>
          </div>
          {me === "owner" && (
            <div className="menuwrap">
              <button className="x" aria-label="خيارات" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>⋯</button>
              {menu && (
                <div className="menu" role="menu">
                  <button role="menuitem" className="danger" onClick={() => { setMenu(false); setConfirmDelete(true); }}>مسح العقار</button>
                </div>
              )}
            </div>
          )}
          <button className="x" onClick={p.onClose} aria-label="قفل">×</button>
        </header>

        <div className="dbody">
          {confirmDelete && (
            <div className="confirm" role="alertdialog">
              <b>تمسح العقار ده نهائي؟</b>
              <span>هيتمسح من عندك وعند {hunt.partner_name} والسمسار، ومعاه الصور والتعليقات. مفيش رجوع.</span>
              <div className="row">
                <button className="btn sm danger" onClick={() => { p.onDelete(); p.onClose(); }}>أيوه، امسح</button>
                <button className="btn sm ghost" onClick={() => setConfirmDelete(false)}>لأ</button>
              </div>
            </div>
          )}

          {l.photos.length ? (
            <div className="dgal">
              {l.photos.map((ph, i) => (
                <button key={ph} onClick={() => p.onPhotos(i)} aria-label={`افتح الصورة ${i + 1}`}>
                  <img src={photoUrl(ph)} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          ) : <div className="nophoto">من غير صور</div>}
          {ed("photos") && <span className="edited">الصور اتعدّلت</span>}

          <div className="facts">
            <div><span>الإيجار الشهري</span><b>{money(l.price)} ج{ed("price") && <i className="edited">اتعدّل</i>}</b></div>
            <div><span>المساحة</span><b>{l.size_m2 != null ? `${money(l.size_m2)} م²` : "—"}{ed("size") && <i className="edited">اتعدّل</i>}</b></div>
            <div><span>الأدوار</span><b>{l.floors ?? "—"}{ed("floors") && <i className="edited">اتعدّل</i>}</b></div>
            <div><span>المنطقة</span><b>{loc ?? "—"}</b></div>
          </div>
          {l.edited_at && l.edited_fields?.length > 0 && (
            <div className="sub">السمسار عدّل {l.edited_fields.map((f) => FIELD_NAMES[f] ?? f).join("، ")} · {timeAgo(l.edited_at)}</div>
          )}

          <div className="dacts">
            <a className="cbtn" href={telLink(l.broker.phone)}><Phone />اتصال</a>
            <a className="cbtn wa" href={waLink(l.broker.phone, waText)} target="_blank" rel="noreferrer"><Whats />واتساب</a>
            <a className="cbtn" href={map ?? undefined} aria-disabled={!map} target="_blank" rel="noreferrer"><Pin />الخريطة</a>
            <button className="cbtn" onClick={p.onChat}><Chat />التعليقات{l.comments.length > 0 && ` (${l.comments.length})`}</button>
          </div>
          <div className="sub">السمسار: {l.broker.name} · <span className="ltr-inline">{l.broker.phone}</span></div>

          {p.dups.length > 0 && (
            <div className="dupbox">
              <b>⚠ ممكن يكون نفس عقار تاني{p.dups.some((x) => x.isCandidate) ? " — ده الأحدث" : ""}</b>
              {p.dups.map(({ other: o, reasons }) => (
                <div className="duprow" key={o.id}>
                  {o.photos[0] ? <img src={photoUrl(o.photos[0])} alt="" /> : <div className="ph" />}
                  <div className="dmain">
                    <b>{money(o.price)} ج · {titleOf(o)}</b>
                    <span>من {o.broker.name}{o.broker.phone === l.broker.phone ? " (نفس السمسار)" : ""} · {timeAgo(o.created_at)}</span>
                    <span className="why">{reasons.map((r) => WHY[r] ?? r).join(" · ")}</span>
                  </div>
                  <div className="dbtns">
                    <button className="btn sm ghost" onClick={() => p.onOpenOther(o.id)}>اعرضه</button>
                    <button className="link" style={{ fontSize: 12.5 }} onClick={() => p.onNotDup(o.id)}>مش مكرر</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <section className="dsec">
            <h3>القرار</h3>
            <div className="cvotes"><VoteBadge name={hunt.owner_name} v={l.owner_vote} /><VoteBadge name={hunt.partner_name} v={l.partner_vote} /></div>
            <div className="myvote">
              <span>رأيك:</span>
              <button className={`vb like ${myVote === "like" ? "on" : ""}`} aria-pressed={myVote === "like"} onClick={() => p.onVote(myVote === "like" ? null : "like")}><Up />موافق</button>
              <button className={`vb nope ${myVote === "nope" ? "on" : ""}`} aria-pressed={myVote === "nope"} onClick={() => p.onVote(myVote === "nope" ? null : "nope")}><Down />لأ</button>
            </div>
            {vtext && <div className={`verdict2 ${vcls}`}>{vtext}</div>}
          </section>

          <section className="dsec">
            <h3>المعاينة</h3>
            {isScheduled(l) ? (
              <div className="visit done">
                <span>✓ المعاينة: {fmtDate(l.suggested_visit)}</span>
                <div className="row"><button className="link" style={{ color: "var(--muted)", fontWeight: 600 }} onClick={() => p.onVisit(null, false)}>إلغاء الميعاد</button></div>
              </div>
            ) : l.suggested_visit ? (
              <div className="visit sug">
                <span>السمسار مقترح: <b>{fmtDate(l.suggested_visit)}</b> (لسه مش متأكد)</span>
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
          </section>

          {hunt.features.length > 0 && (
            <section className="dsec">
              <h3>المميزات <span className="score">{score}/{hunt.features.length}</span></h3>
              <div className="chips">
                {hunt.features.map((f) => (
                  <button key={f} className={`chip ${l.features.includes(f) ? "on" : ""}`} aria-pressed={l.features.includes(f)} onClick={() => p.onFeature(f)}>{f}</button>
                ))}
              </div>
            </section>
          )}

          {l.raw_text.trim() && (
            <section className="dsec">
              <h3>رسالة السمسار{ed("text") && <i className="edited">اتعدّلت</i>}</h3>
              <p className="rawmsg">{l.raw_text}</p>
            </section>
          )}

          <section className="dsec">
            <h3>التعليقات {l.comments.length > 0 && <span className="score">{l.comments.length}</span>}</h3>
            {l.comments.slice(-2).map((c) => (
              <div key={c.id} className={`msg ${c.author === me ? "mine" : ""} ${c.private ? "private" : ""}`}>
                <small>{c.author === "broker" ? `السمسار ${l.broker.name}` : c.author === "owner" ? hunt.owner_name : hunt.partner_name}{c.private ? " · خاصة" : ""} · {timeAgo(c.created_at)}</small>
                {c.body}
              </div>
            ))}
            <button className="btn sm ghost" onClick={p.onChat}><Chat />{l.comments.length ? "كل التعليقات واكتب رد" : "اسأل السمسار أو اكتب ملاحظة"}</button>
          </section>
        </div>
      </div>
    </div>
  );
}
