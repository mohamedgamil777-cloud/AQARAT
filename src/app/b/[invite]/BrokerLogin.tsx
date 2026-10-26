"use client";

import { useState } from "react";
import { rpc } from "@/lib/sb";
import { setSession, type BrokerSession } from "@/lib/session";
import { ERRORS, errorText, westernDigits } from "@/lib/util";
import { ArrowLeft, Phone, Shield, User } from "@/components/Icons";

type LoginRes = { token?: string; name?: string; new?: boolean; error?: string; left?: number; minutes?: number };

const digits = (s: string, n: number) => westernDigits(s).replace(/\D/g, "").slice(0, n);

/** Mobile + 4-digit PIN. First time on a number → asks for the name and the PIN becomes his. */
export default function BrokerLogin({ invite, ownerName, onIn }: { invite: string; ownerName: string; onIn: (s: BrokerSession) => void }) {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [name, setName] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const ph = digits(phone, 13);
    if (ph.length < 10) return setError("اكتب رقم موبايلك كامل.");
    if (pin.length !== 4) return setError(ERRORS.BAD_PIN);
    if (isNew) {
      if (!name.trim()) return setError("اكتب اسمك.");
      if (pin2 !== pin) return setError("الرقمين السريين مش زي بعض.");
    }
    setBusy(true);
    try {
      const r = await rpc<LoginRes>("broker_login", { p_invite: invite, p_phone: ph, p_pin: pin, p_name: isNew ? name.trim() : null });
      if (r.token) {
        const s = { token: r.token, name: r.name ?? name, phone: ph };
        setSession(s);
        onIn(s);
        return;
      }
      if (r.error === "NEW_BROKER") { setIsNew(true); return; }
      if (r.error === "WRONG_PIN") {
        setPin("");
        return setError(r.left ? `${ERRORS.WRONG_PIN} فاضل ${r.left} محاولات.` : ERRORS.WRONG_PIN);
      }
      if (r.error === "LOCKED") return setError(`${ERRORS.LOCKED.replace("بعد شوية", `بعد ${r.minutes ?? 15} دقيقة`)} أو كلّم ${ownerName} يدّيك رقم سري جديد.`);
      setError(errorText(new Error(r.error)));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="pad" onSubmit={submit} noValidate>
      <div className="box">
        <b>{isNew ? "أول مرة تدخل؟ أهلاً بيك" : "ادخل برقم موبايلك"}</b>
        <span className="hint">
          {isNew
            ? "الرقم ده جديد. اكتب اسمك وأكّد الرقم السري — هتدخل بيه كل مرة."
            : "كل سمسار له صفحته لوحده. محدش غيرك يقدر يشوف العقارات اللي بعتها."}
        </span>
      </div>

      <label className="field">
        <span>رقم الموبايل <span className="req">*</span></span>
        <span className="iwrap"><Phone />
          <input className="input ltr" id="l-phone" inputMode="tel" autoComplete="tel" value={phone} disabled={isNew}
            onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" />
        </span>
        {isNew && <button type="button" className="link" style={{ fontSize: 13, alignSelf: "flex-start" }}
          onClick={() => { setIsNew(false); setPin(""); setPin2(""); setError(""); }}>غيّر الرقم</button>}
      </label>

      <label className="field">
        <span>{isNew ? "اختار رقم سري (4 أرقام)" : "الرقم السري (4 أرقام)"} <span className="req">*</span></span>
        <span className="iwrap"><Shield />
          <input className="input ltr pin" id="l-pin" type="password" inputMode="numeric" autoComplete={isNew ? "new-password" : "current-password"}
            maxLength={4} value={pin} onChange={(e) => setPin(digits(e.target.value, 4))} placeholder="••••" />
        </span>
        {!isNew && <em>أول مرة؟ اختار أي 4 أرقام وهتبقى الرقم السري بتاعك.</em>}
      </label>

      {isNew && (
        <>
          <label className="field">
            <span>اكتب الرقم السري تاني <span className="req">*</span></span>
            <span className="iwrap"><Shield />
              <input className="input ltr pin" id="l-pin2" type="password" inputMode="numeric" autoComplete="new-password"
                maxLength={4} value={pin2} onChange={(e) => setPin2(digits(e.target.value, 4))} placeholder="••••" />
            </span>
          </label>
          <label className="field">
            <span>اسمك <span className="req">*</span></span>
            <span className="iwrap"><User />
              <input className="input" id="l-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="اكتب اسمك" />
            </span>
          </label>
        </>
      )}

      {error && <div className="err" role="alert">{error}</div>}
      <button className="btn block big" type="submit" disabled={busy}>
        {busy ? "لحظة…" : <>{isNew ? "سجّل وادخل" : "دخول"} <ArrowLeft /></>}
      </button>
      <p className="hint" style={{ textAlign: "center" }}>نسيت الرقم السري؟ كلّم {ownerName} يدّيك رقم جديد.</p>
    </form>
  );
}
