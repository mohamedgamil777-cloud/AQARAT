"use client";

import { useEffect, useMemo, useState } from "react";
import { rpc } from "@/lib/sb";
import { uploadPhotos } from "@/lib/upload";
import { parseListing } from "@/lib/parse";
import { errorText, fromLocalInput, money, westernDigits } from "@/lib/util";
import { ArrowLeft, Calendar, ImageIcon, ImagePlus, Logo, Money, Shield } from "@/components/Icons";
import { detectInstall, registerSW, takeShared, type InstallState } from "@/lib/share";
import { clearSession, getSession, setSession as saveSession, type BrokerSession } from "@/lib/session";
import BrokerLogin from "./BrokerLogin";
import BriefCard from "@/components/BriefCard";
import { briefWarnings, type Brief } from "@/lib/brief";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const MAX_PHOTOS = 40;

type Pick = { file: File; url: string };

export default function BrokerForm({ invite, ownerName, checklist, brief }: { invite: string; ownerName: string; checklist: string[]; brief?: Brief }) {
  const [raw, setRaw] = useState("");
  const [pics, setPics] = useState<Pick[]>([]);
  const [price, setPrice] = useState("");
  const [priceTouched, setPriceTouched] = useState(false);
  const [session, setSession] = useState<BrokerSession | null>(null);
  const [checking, setChecking] = useState(true);
  const [needPin, setNeedPin] = useState(false);
  const [visit, setVisit] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [install, setInstall] = useState<InstallState>("other");
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    // Still logged in on this phone? Check the token is still valid (the owner may have reset the PIN).
    const saved = getSession();
    if (!saved) setChecking(false);
    else rpc<{ broker: { name: string; phone: string; has_pin?: boolean } } | null>("broker_view", { p_token: saved.token })
      .then((v) => {
        if (!v) { clearSession(); return; }
        const s = { ...saved, name: v.broker.name, phone: v.broker.phone };
        saveSession(s); setSession(s); setNeedPin(v.broker.has_pin === false);
      })
      .catch(() => setSession(saved))
      .finally(() => setChecking(false));

    registerSW();
    setInstall(detectInstall());
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallPrompt(e as InstallPrompt); setInstall("can-install"); };
    const onInstalled = () => { setInstallPrompt(null); setInstall("installed"); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Arrived from the Android share sheet (WhatsApp / Gallery → عقارات).
    const shared = new URLSearchParams(window.location.search).get("shared");
    if (shared) {
      window.history.replaceState(null, "", window.location.pathname);
      if (shared === "lost") setNote("الصور ماوصلتش. جرّب تشاركها تاني من الواتساب.");
      else takeShared().then((s) => {
        if (!s) return;
        addFiles(s.files);
        if (s.text.trim()) setRaw((r) => r || s.text);
        setNote(s.files.length ? `اتضافت ${s.files.length} صورة من المشاركة ✓ كمّل الباقي واضغط إرسال.` : "");
      }).catch(() => {});
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstall("installed");
    setInstallPrompt(null);
  }

  const parsed = useMemo(() => parseListing(raw, checklist), [raw, checklist]);
  useEffect(() => {
    if (!priceTouched) setPrice(parsed.price ? money(parsed.price) : "");
  }, [parsed.price, priceTouched]);

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const images = [...list].filter((f) => f.type.startsWith("image/"));
    setPics((p) => {
      const room = MAX_PHOTOS - p.length;
      if (images.length > room) setError(`أقصى عدد ${MAX_PHOTOS} صورة. اتضاف أول ${room} بس.`);
      return [...p, ...images.slice(0, room).map((file) => ({ file, url: URL.createObjectURL(file) }))];
    });
  }

  function removePic(i: number) {
    setPics((p) => { URL.revokeObjectURL(p[i].url); return p.filter((_, j) => j !== i); });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const priceNum = parseInt(westernDigits(price).replace(/\D/g, ""), 10);
    if (!raw.trim() && !pics.length) return setError("الصق رسالة العقار أو ارفع صور.");
    if (!priceNum) return setError("اكتب الإيجار الشهري.");
    if (!session) return;

    setBusy(true);
    setProgress(0);
    try {
      const { paths, hashes } = await uploadPhotos(pics.map((p) => p.file), setProgress);

      await rpc("broker_submit", {
        p_token: session.token, p_raw: raw, p_area: parsed.area,
        p_price: priceNum, p_size: parsed.size, p_floors: parsed.floors, p_map: parsed.mapUrl,
        p_visit: fromLocalInput(visit), p_features: parsed.features, p_photos: paths, p_hashes: hashes,
      });
      setDone(session.token);
      pics.forEach((p) => URL.revokeObjectURL(p.url));
      setPics([]); setRaw(""); setVisit(""); setPriceTouched(false);
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (errorText(err) === errorText(new Error("NOT_ALLOWED"))) { clearSession(); setSession(null); }
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    clearSession();
    setSession(null);
    setNeedPin(false);
  }

  if (checking) {
    return (
      <main className="app brand">
        <Header title="ابعت تفاصيل العقار" sub="لحظة…" />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="app brand">
        <Header title={`ابعت عقاراتك لـ${ownerName}`} sub="ادخل برقم موبايلك والرقم السري" />
        <div className="pad" style={{ paddingBottom: 0 }}><BriefCard brief={brief} features={checklist} ownerName={ownerName} /></div>
        <BrokerLogin invite={invite} ownerName={ownerName} onIn={(s) => { setSession(s); setError(""); }} />
      </main>
    );
  }
  const name = session.name;

  if (done) {
    return (
      <main className="app brand">
        <Header title="وصل العقار ✓" sub={`شكراً يا ${name}، ${ownerName} هيشوفه دلوقتي`} />
        <div className="pad">
          <div className="ok">وصل لـ{ownerName} ✓ شكراً يا {name}</div>
          <p className="hint" style={{ textAlign: "center" }}>هتلاقي ردّه ورأيه في صفحة «عقاراتي».</p>
          <a className="btn block" href={`/m/${done}`}>عقاراتي وردود {ownerName}</a>
          <button className="btn ghost block" onClick={() => setDone(null)}>ابعت عقار تاني</button>
        </div>
      </main>
    );
  }

  const priceVal = parseInt(westernDigits(price).replace(/\D/g, ""), 10) || null;
  const fitWarnings = briefWarnings(brief, parsed.size, priceVal);

  const chips = [
    parsed.floors && `${parsed.floors} أدوار`,
    parsed.size && `${money(parsed.size)} م²`,
    parsed.price && `${money(parsed.price)} ج`,
    ...parsed.features,
  ].filter(Boolean) as string[];

  return (
    <main className="app brand">
      <Header title="ابعت تفاصيل العقار" sub="املأ البيانات في أقل من دقيقة" />
      <form className="pad" onSubmit={submit} noValidate>
        <div className="who">
          <span>داخل باسم <b>{name}</b> <span className="ltr-inline">{session.phone}</span></span>
          <button type="button" className="link" onClick={logout}>خروج</button>
        </div>
        <BriefCard brief={brief} features={checklist} ownerName={ownerName} />
        {needPin && <SetPin token={session.token} onDone={() => setNeedPin(false)} />}
        <a className="box link" href={`/m/${session.token}`} style={{ textAlign: "center" }}>
          شوف عقاراتي اللي بعتها وردود {ownerName} ←
        </a>

        {note && <div className={note.startsWith("اتضافت") ? "ok" : "err"} role="status">{note}</div>}

        <label className="field">
          رسالة العقار
          <textarea className="input" id="raw" value={raw} onChange={(e) => setRaw(e.target.value)}
            placeholder="الصق رسالة العقار من واتساب زي ما هي…" />
          <em>مش لازم ترتب الكلام</em>
        </label>
        {chips.length > 0 && (
          <div className="parsed">قرينا من رسالتك: {chips.map((c) => <span key={c}>{c}</span>)}</div>
        )}
        {fitWarnings.length > 0 && (
          <div className="warn" role="status">{fitWarnings.map((w) => <span key={w}>⚠ {w}</span>)}<span style={{ fontWeight: 400 }}>تقدر تبعته عادي، بس غالباً مش هيناسب.</span></div>
        )}

        <label className="photobox">
          <input type="file" accept="image/*" multiple id="photos" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <span className="pb-icon"><ImagePlus /></span>
          <span className="pb-text">
            <b>{pics.length ? `صور العقار (${pics.length}/${MAX_PHOTOS})` : "صور العقار"}</b>
            <span>اختار الصور مرة واحدة — لحد {MAX_PHOTOS} صورة</span>
          </span>
          <span className="pb-btn"><ImageIcon />{pics.length ? "ضيف صور" : "اختار الصور"}</span>
        </label>
        {pics.length === 0 && (
          <p className="hint">صور الواتساب بتكون موجودة في الجاليري في ألبوم <b>WhatsApp Images</b>، اختارها من هناك على طول.</p>
        )}
        {pics.length === 0 && <ShareHelp state={install} canPrompt={!!installPrompt} onInstall={doInstall} />}
        {pics.length > 0 && (
          <div className="thumbs">
            {pics.map((p, i) => (
              <div className="thumb" key={p.url}>
                <img src={p.url} alt="" />
                {!busy && <button type="button" aria-label="شيل الصورة" onClick={() => removePic(i)}>×</button>}
              </div>
            ))}
          </div>
        )}

        <label className="field">
          <span>الإيجار الشهري (جنيه) <span className="req">*</span></span>
          <span className="iwrap"><Money />
            <input className="input" id="price" inputMode="numeric" value={price}
              onChange={(e) => { setPriceTouched(true); setPrice(e.target.value); }} placeholder="85,000" />
          </span>
        </label>

        <label className="field">
          <span>ميعاد المعاينة (اختياري)</span>
          <span className="iwrap"><Calendar />
            <input className="input" type="datetime-local" id="visit" value={visit} onChange={(e) => setVisit(e.target.value)} />
          </span>
          <em>ممكن تسيبه فاضي وتحدده بعد ما {ownerName} يوافق</em>
        </label>

        <div className="privacy"><Shield /><span>بياناتك للتواصل بخصوص العقار فقط</span></div>

        {error && <div className="err" role="alert">{error}</div>}
        {busy && pics.length > 0 && (
          <div>
            <div className="progress"><i style={{ width: `${progress}%` }} /></div>
            <p className="hint" style={{ marginTop: 4 }}>بنرفع الصور… {progress}%</p>
          </div>
        )}
        <button className="btn block big" type="submit" disabled={busy}>{busy ? "بنبعت…" : <>إرسال تفاصيل العقار <ArrowLeft /></>}</button>
        <p className="hint" style={{ textAlign: "center" }}>هتفضل داخل على الموبايل ده لحد ما تدوس «خروج».</p>
      </form>
    </main>
  );
}

/** Brokers from before PINs existed: pick a PIN once so nobody else can open their page with their number. */
function SetPin({ token, onDone }: { token: string; onDone: () => void }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function save() {
    if (pin.length !== 4) return setErr("الرقم السري لازم يكون 4 أرقام.");
    setBusy(true); setErr("");
    try { await rpc("broker_change_pin", { p_token: token, p_old: null, p_new: pin }); onDone(); }
    catch (e) { setErr(errorText(e)); } finally { setBusy(false); }
  }
  return (
    <div className="box" style={{ borderStyle: "solid", borderColor: "var(--accent)" }}>
      <b>اختار رقم سري لحسابك</b>
      <span className="hint">4 أرقام هتدخل بيهم مع رقم موبايلك من أي موبايل.</span>
      <div className="inline-form">
        <input className="input ltr pin" type="password" inputMode="numeric" maxLength={4} value={pin} id="set-pin"
          onChange={(e) => setPin(westernDigits(e.target.value).replace(/\D/g, "").slice(0, 4))} placeholder="••••" />
        <button type="button" className="btn sm" onClick={save} disabled={busy}>حفظ</button>
      </div>
      {err && <div className="err">{err}</div>}
    </div>
  );
}

/** Explains the fastest way to get WhatsApp photos in, depending on the broker's phone. */
function ShareHelp({ state, canPrompt, onInstall }: { state: InstallState; canPrompt: boolean; onInstall: () => void }) {
  if (state === "installed") {
    return (
      <div className="box">
        <b>تبعت الصور من الواتساب على طول</b>
        <span className="hint">في شات الواتساب: دوس مطوّل على الصور وعلّم عليهم ← زرار المشاركة ← اختار «عقارات». ونفس الكلام من الجاليري.</span>
      </div>
    );
  }
  if (state === "ios") {
    return (
      <details className="box">
        <summary className="link">الصور عندك على الواتساب بس؟</summary>
        <span className="hint">في الآيفون: افتح الواتساب ← الإعدادات ← الدردشات ← شغّل «حفظ في الصور». بعدها أي صور توصلك هتلاقيها في الجاليري وتختارها من هنا.</span>
      </details>
    );
  }
  return (
    <div className="box" style={{ borderStyle: "solid", borderColor: "var(--accent)" }}>
      <b>الصور عندك على الواتساب؟ ابعتها من غير ما تنزّلها</b>
      <span className="hint">ثبّت «عقارات» على موبايلك مرة واحدة، وبعدها من أي شات واتساب: علّم على الصور ← مشاركة ← «عقارات»، وهتيجي هنا لوحدها.</span>
      {canPrompt ? (
        <button type="button" className="btn sm" onClick={onInstall} style={{ alignSelf: "flex-start" }}>ثبّت التطبيق</button>
      ) : (
        <span className="hint">من كروم: اضغط ⋮ فوق ← «إضافة إلى الشاشة الرئيسية» أو «تثبيت التطبيق».</span>
      )}
    </div>
  );
}

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <header className="bhero">
      <div className="logo"><Logo /><span>عقارات</span></div>
      <h1>{title}</h1>
      <p>{sub}</p>
    </header>
  );
}
