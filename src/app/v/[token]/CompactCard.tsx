"use client";

import { photoUrl } from "@/lib/sb";
import type { Listing, ViewerData, Vote } from "@/lib/types";
import { decision, isScheduled, locationOf, titleOf, typeOf, type Role } from "@/lib/decisions";
import { fmtDate, mapLink, money, waLink } from "@/lib/util";
import { Pin, Whats } from "@/components/Icons";

export function VoteBadge({ name, v }: { name: string; v: Vote }) {
  const [cls, text] = v === "like" ? ["ok", "✓ موافق"] : v === "nope" ? ["no", "✕ رافض"] : ["wait", "… لسه"];
  return <span className={`vbadge ${cls}`}><span className="vn">{name}</span>{text}</span>;
}

type Props = {
  l: Listing;
  me: Role;
  hunt: ViewerData["hunt"];
  isDup: boolean;
  unread: number;
  onOpen: () => void;
};

/** One building in the list: just enough to scan rent, place and both decisions. */
export default function CompactCard({ l, me, hunt, isDup, unread, onOpen }: Props) {
  const d = decision(l, me);
  const loc = locationOf(l);
  const map = mapLink(l);
  const waText = `بخصوص ${typeOf(l)} ${loc ? `في ${loc} ` : ""}بإيجار ${money(l.price)} جنيه`;
  // Latest private note from the other person (partner ↔ owner), shown right on the card.
  const otherRole = me === "owner" ? "partner" : "owner";
  const note = [...l.comments].reverse().find((c) => c.private && c.author === otherRole);
  const otherName = me === "owner" ? hunt.partner_name : hunt.owner_name;
  const isNew = Date.now() - new Date(l.created_at).getTime() < 24 * 3600 * 1000 && d === "waiting_me";

  return (
    <article className={`ccard ${d}`} id={`l-${l.id}`}>
      <button className="cthumb" onClick={onOpen} aria-label="افتح التفاصيل">
        {l.photos[0] ? <img src={photoUrl(l.photos[0])} alt="" loading="lazy" /> : <span className="nophoto-s">بدون صور</span>}
        {l.photos.length > 0 && <span className="pcount">{l.photos.length} صورة</span>}
      </button>

      <div className="cmain">
        <div className="crow1">
          <span className="ctype">{typeOf(l)}</span>
          <b className="ctitle" title={titleOf(l)}>{titleOf(l)}</b>
        </div>
        <div className="cloc">{loc ? <>📍 {loc}</> : <span className="muted">المنطقة مش واضحة من الرسالة</span>}</div>
        <div className="cnums">
          <b>{money(l.price)} <small>ج/شهر</small></b>
          {l.size_m2 != null && <span>{money(l.size_m2)} م²</span>}
          <span className="muted">· {l.broker.name}</span>
        </div>
        <div className="cvotes">
          <VoteBadge name={hunt.owner_name} v={l.owner_vote} />
          <VoteBadge name={hunt.partner_name} v={l.partner_vote} />
          {isNew && <span className="flag new">جديد</span>}
        </div>
        {(isDup || d === "rejected" || d === "split" || isScheduled(l)) && (
          <div className="cflags">
            {isDup && <span className="flag dup">⚠ مكرر محتمل</span>}
            {d === "rejected" && <span className="flag rej">✕ مرفوض منكم الاتنين</span>}
            {d === "split" && <span className="flag split">↔ رأيكم مختلف</span>}
            {isScheduled(l) && <span className="flag visit">📅 معاينة {fmtDate(l.suggested_visit)}</span>}
          </div>
        )}
        {note && (
          <button className={`cnote ${unread > 0 ? "fresh" : ""}`} onClick={onOpen} title={note.body}>
            <b>💬 {otherName}:</b> {note.body}
          </button>
        )}
        <div className="cacts">
          <button className="cbtn primary" onClick={onOpen}>
            التفاصيل{unread > 0 && <span className="udot" aria-label={`${unread} تعليق جديد`}>{unread}</span>}
          </button>
          <a className="cbtn icon wa" href={waLink(l.broker.phone, waText)} target="_blank" rel="noreferrer" aria-label="واتساب السمسار"><Whats /></a>
          <a className="cbtn icon" href={map ?? undefined} aria-disabled={!map} target="_blank" rel="noreferrer" aria-label="الخريطة"><Pin /></a>
        </div>
      </div>
    </article>
  );
}
