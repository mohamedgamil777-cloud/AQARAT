"use client";

import { useEffect, useRef, useState } from "react";
import { photoUrl, rpc } from "@/lib/sb";
import type { Listing, ViewerData } from "@/lib/types";
import { errorText, money, timeAgo, waLink } from "@/lib/util";
import { Send, Whats } from "@/components/Icons";

const QUICK = ["آخر سعر كام؟", "ممكن صور زيادة؟", "متاح من إمتى؟", "فيه جراج؟", "العربيات تقدر تحمّل وتنزّل؟", "التأمين كام شهر؟"];

type Props = {
  l: Listing;
  me: "owner" | "partner";
  hunt: ViewerData["hunt"];
  token: string;
  onClose: () => void;
  onSent: () => Promise<void>;
};

export default function ChatSheet({ l, me, hunt, token, onClose, onSent }: Props) {
  const [text, setText] = useState("");
  const [priv, setPriv] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notify, setNotify] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [l.comments.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  const names = { owner: hunt.owner_name, partner: hunt.partner_name, broker: `السمسار ${l.broker.name}` };

  async function post(body: string) {
    body = body.trim();
    if (!body) return;
    setBusy(true); setErr("");
    try {
      await rpc("viewer_comment", { p_token: token, p_listing: l.id, p_body: body, p_private: priv });
      setText("");
      if (!priv) setNotify(true);
      await onSent();
    } catch (e) { setErr(errorText(e)); } finally { setBusy(false); }
  }

  const brokerLink = l.broker.token && typeof window !== "undefined" ? `${window.location.origin}/m/${l.broker.token}` : "";
  const waText = `سبتلك سؤال على العقار في ${l.area ?? ""} (${money(l.price)} ج). رد من هنا: ${brokerLink}`;

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="التعليقات" onClick={(e) => e.stopPropagation()}>
        <header className="top">
          {l.photos[0] ? <img src={photoUrl(l.photos[0])} alt="" style={{ width: 42, height: 42, borderRadius: 10, objectFit: "cover" }} /> : <div className="dot">ع</div>}
          <div className="t">
            <b>{money(l.price)} ج.م · {l.area ?? "العقار"}</b>
            <small>السمسار {l.broker.name} · بتكتب باسم {names[me]}</small>
          </div>
          <button className="x" onClick={onClose} aria-label="قفل">×</button>
        </header>

        <div className="thread">
          <div className="msg sys">السمسار بيشوف التعليقات، لكن مش بيشوف الملاحظات الخاصة.</div>
          {l.comments.length === 0 && <div className="msg sys">مفيش تعليقات لسه. اسأل السمسار أي حاجة تحت.</div>}
          {l.comments.map((c) => (
            <div key={c.id} className={`msg ${c.author === me ? "mine" : ""} ${c.private ? "private" : ""}`}>
              <small>{names[c.author]}{c.private ? " · ملاحظة خاصة" : ""} · {timeAgo(c.created_at)}</small>
              {c.body}
            </div>
          ))}
          <div ref={end} />
        </div>

        <div className="composer">
          {notify && brokerLink && (
            <a className="btn wa sm" href={waLink(l.broker.phone, waText)} target="_blank" rel="noreferrer" onClick={() => setNotify(false)}>
              <Whats /> بلّغ السمسار على واتساب إن فيه سؤال
            </a>
          )}
          <div className="seg">
            <button className={priv ? "" : "on"} onClick={() => setPriv(false)}>للسمسار</button>
            <button className={priv ? "on" : ""} onClick={() => setPriv(true)}>ملاحظة خاصة (ليك وللشريك)</button>
          </div>
          {!priv && (
            <div className="quick">
              {QUICK.map((q) => <button key={q} onClick={() => post(q)} disabled={busy}>{q}</button>)}
            </div>
          )}
          {err && <div className="err">{err}</div>}
          <form onSubmit={(e) => { e.preventDefault(); post(text); }}>
            <input className="input" id="chat-input" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off"
              placeholder={priv ? "ملاحظة ليك وللشريك بس…" : "اكتب للسمسار…"} />
            <button className="sendico" aria-label="إرسال" disabled={busy || !text.trim()}><Send /></button>
          </form>
        </div>
      </div>
    </div>
  );
}
