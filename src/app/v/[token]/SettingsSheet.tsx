"use client";

import { useEffect, useState } from "react";
import { rpc } from "@/lib/sb";
import type { ViewerData } from "@/lib/types";
import { errorText, waLink } from "@/lib/util";
import { Whats } from "@/components/Icons";

type Hunt = ViewerData["hunt"];

function origin() {
  return typeof window === "undefined" ? "" : window.location.origin;
}

function CopyRow({ url, waText }: { url: string; waText: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <code>{url}</code>
      <div className="row">
        <button className="btn sm ghost" onClick={() => navigator.clipboard?.writeText(url).then(() => setCopied(true), () => {})}>{copied ? "اتنسخ ✓" : "انسخ اللينك"}</button>
        <a className="btn sm wa" href={`https://wa.me/?text=${encodeURIComponent(waText + "\n" + url)}`} target="_blank" rel="noreferrer"><Whats /> ابعته على واتساب</a>
      </div>
    </>
  );
}

/** The broker link (send to every broker) and, for the owner, the partner's private link. */
export function ShareLinks({ hunt, role }: { hunt: Hunt; role: "owner" | "partner" }) {
  const [o, setO] = useState("");
  useEffect(() => setO(origin()), []);
  if (!o) return null;
  return (
    <>
      <div className="share">
        <b>لينك السماسرة</b>
        <span className="hint">ابعته لكل السماسرة. بيرفعوا منه الصور والتفاصيل من غير تسجيل.</span>
        <CopyRow url={`${o}/b/${hunt.invite}`} waText={`لو عندك مبنى للإيجار ابعته هنا بالصور في دقيقة:`} />
      </div>
      {role === "owner" && hunt.partner_token && (
        <div className="share">
          <b>لينك {hunt.partner_name}</b>
          <span className="hint">لينك خاص بشريكك عشان يقول رأيه. متبعتوش للسماسرة.</span>
          <CopyRow url={`${o}/v/${hunt.partner_token}`} waText={`ده لينك المباني، قول رأيك في كل واحد:`} />
        </div>
      )}
    </>
  );
}

export default function SettingsSheet({ hunt, token, onClose, onSaved }: { hunt: Hunt; token: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [ownerName, setOwnerName] = useState(hunt.owner_name);
  const [ownerPhone, setOwnerPhone] = useState(hunt.owner_phone ?? "");
  const [partnerName, setPartnerName] = useState(hunt.partner_name);
  const [features, setFeatures] = useState<string[]>(hunt.features);
  const [newFeat, setNewFeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function save() {
    setBusy(true); setMsg("");
    try {
      await rpc("owner_settings", { p_token: token, p_owner_name: ownerName, p_owner_phone: ownerPhone, p_partner_name: partnerName, p_features: features });
      await onSaved();
      setMsg("اتحفظ ✓");
    } catch (e) { setMsg(errorText(e)); } finally { setBusy(false); }
  }

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="الإعدادات" onClick={(e) => e.stopPropagation()}>
        <header className="top">
          <div className="t"><b>الإعدادات واللينكات</b><small>اللي بتغيّره هنا بيظهر لشريكك وللسماسرة</small></div>
          <button className="x" onClick={onClose} aria-label="قفل">×</button>
        </header>
        <div className="pad" style={{ overflowY: "auto" }}>
          <ShareLinks hunt={hunt} role="owner" />

          <div className="share">
            <b>الأسماء والرقم</b>
            <div className="row2">
              <label className="field">اسمك<input className="input" id="s-owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} /></label>
              <label className="field">اسم الشريك<input className="input" id="s-partner" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} /></label>
            </div>
            <label className="field">
              <span>رقم موبايلك <em>(عشان السمسار يبلّغك على واتساب لما يرد)</em></span>
              <input className="input ltr" id="s-phone" inputMode="tel" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="01xxxxxxxxx" />
            </label>
            {ownerPhone && <a className="link" href={waLink(ownerPhone, "تجربة")} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>جرّب الرقم على واتساب</a>}
          </div>

          <div className="share">
            <b>المميزات اللي محتاجها</b>
            <span className="hint">كل مبنى بيتقيّم على القائمة دي.</span>
            {features.map((f, i) => (
              <div className="featrow" key={i}>
                <input className="input" id={`f-${i}`} value={f} onChange={(e) => setFeatures(features.map((x, j) => (j === i ? e.target.value : x)))} />
                <button className="x" aria-label={`امسح ${f}`} onClick={() => setFeatures(features.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <form className="featrow" onSubmit={(e) => { e.preventDefault(); if (newFeat.trim()) { setFeatures([...features, newFeat.trim()]); setNewFeat(""); } }}>
              <input className="input" id="f-new" value={newFeat} onChange={(e) => setNewFeat(e.target.value)} placeholder="ميزة جديدة، مثلاً: قريب من الدائري" />
              <button className="btn sm" disabled={!newFeat.trim()}>إضافة</button>
            </form>
          </div>

          {msg && <div className={msg.startsWith("اتحفظ") ? "ok" : "err"}>{msg}</div>}
          <button className="btn block" onClick={save} disabled={busy}>{busy ? "بنحفظ…" : "حفظ"}</button>
        </div>
      </div>
    </div>
  );
}
