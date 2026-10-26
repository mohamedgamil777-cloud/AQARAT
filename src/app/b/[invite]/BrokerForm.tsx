"use client";

import { useEffect, useMemo, useState } from "react";
import { sb, rpc } from "@/lib/sb";
import { compress } from "@/lib/image";
import { parseListing } from "@/lib/parse";
import { errorText, fromLocalInput, money, westernDigits } from "@/lib/util";
import { detectInstall, registerSW, takeShared, type InstallState } from "@/lib/share";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const MAX_PHOTOS = 40;
const SAVED = "aqarat-broker";

type Pick = { file: File; url: string };

export default function BrokerForm({ invite, ownerName, checklist }: { invite: string; ownerName: string; checklist: string[] }) {
  const [raw, setRaw] = useState("");
  const [pics, setPics] = useState<Pick[]>([]);
  const [price, setPrice] = useState("");
  const [priceTouched, setPriceTouched] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [visit, setVisit] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [myToken, setMyToken] = useState<string | null>(null);
  const [install, setInstall] = useState<InstallState>("other");
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SAVED) || "{}");
      if (s.name) setName(s.name);
      if (s.phone) setPhone(s.phone);
      if (s.token) setMyToken(s.token);
    } catch {}

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
    if (!name.trim() || !phone.trim()) return setError("اكتب اسمك ورقم موبايلك.");
    if (westernDigits(phone).replace(/\D/g, "").length < 10) return setError("رقم الموبايل ناقص.");

    setBusy(true);
    setProgress(0);
    try {
      const folder = `u/${crypto.randomUUID()}`;
      const paths: string[] = new Array(pics.length);
      let finished = 0, cursor = 0;
      const worker = async () => {
        while (cursor < pics.length) {
          const i = cursor++;
          const blob = await compress(pics[i].file);
          const path = `${folder}/${String(i + 1).padStart(2, "0")}.jpg`;
          const { error } = await sb.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
          if (error) throw new Error(error.message);
          paths[i] = path;
          setProgress(Math.round((++finished / pics.length) * 100));
        }
      };
      await Promise.all([worker(), worker(), worker()]);

      const res = await rpc<{ broker_token: string }>("submit_listing", {
        p_invite: invite, p_name: name, p_phone: westernDigits(phone), p_raw: raw, p_area: parsed.area,
        p_price: priceNum, p_size: parsed.size, p_floors: parsed.floors, p_map: parsed.mapUrl,
        p_visit: fromLocalInput(visit), p_features: parsed.features, p_photos: paths,
      });
      try { localStorage.setItem(SAVED, JSON.stringify({ name, phone, token: res.broker_token })); } catch {}
      setMyToken(res.broker_token);
      setDone(res.broker_token);
      pics.forEach((p) => URL.revokeObjectURL(p.url));
      setPics([]); setRaw(""); setVisit(""); setPriceTouched(false);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="app">
        <Header ownerName={ownerName} />
        <div className="pad">
          <div className="ok">وصل لـ{ownerName} ✓ شكراً يا {name}</div>
          <p className="hint" style={{ textAlign: "center" }}>هتلاقي ردّه ورأيه في صفحة «عقاراتي».</p>
          <a className="btn block" href={`/m/${done}`}>عقاراتي وردود {ownerName}</a>
          <button className="btn ghost block" onClick={() => setDone(null)}>ابعت عقار تاني</button>
        </div>
      </main>
    );
  }

  const chips = [
    parsed.floors && `${parsed.floors} أدوار`,
    parsed.size && `${money(parsed.size)} م²`,
    parsed.price && `${money(parsed.price)} ج`,
    ...parsed.features,
  ].filter(Boolean) as string[];

  return (
    <main className="app">
      <Header ownerName={ownerName} />
      <form className="pad" onSubmit={submit} noValidate>
        {myToken && (
          <a className="box link" href={`/m/${myToken}`} style={{ textAlign: "center" }}>
            شوف عقاراتي اللي بعتها وردود {ownerName} ←
          </a>
        )}

        <ShareHelp state={install} canPrompt={!!installPrompt} onInstall={doInstall} />
        {note && <div className={note.startsWith("اتضافت") ? "ok" : "err"} role="status">{note}</div>}

        <label className="field">
          الصق رسالة العقار هنا
          <em>زي ما بتبعتها على واتساب بالظبط</em>
          <textarea className="input" id="raw" value={raw} onChange={(e) => setRaw(e.target.value)}
            placeholder={"مثال:\nللإيجار مبنى إداري بمدينة نصر\n4 أدوار، كل دور 180م\nأسانسير + جراج\n85 ألف شهري"} />
        </label>
        {chips.length > 0 && (
          <div className="parsed">قرينا من رسالتك: {chips.map((c) => <span key={c}>{c}</span>)}</div>
        )}

        <label className="drop">
          <input type="file" accept="image/*" multiple id="photos" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <b>{pics.length ? `ضيف صور تانية (${pics.length}/${MAX_PHOTOS})` : "اضغط وارفع الصور"}</b>
          <span>اختار كل الصور مرة واحدة · حتى {MAX_PHOTOS} صورة</span>
        </label>
        {pics.length === 0 && (
          <p className="hint">صور الواتساب بتكون موجودة في الجاليري في ألبوم <b>WhatsApp Images</b>، اختارها من هناك على طول.</p>
        )}
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
          <input className="input" id="price" inputMode="numeric" value={price}
            onChange={(e) => { setPriceTouched(true); setPrice(e.target.value); }} placeholder="85,000" />
        </label>

        <div className="row2">
          <label className="field">
            <span>اسمك <span className="req">*</span></span>
            <input className="input" id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <label className="field">
            <span>رقم الموبايل <span className="req">*</span></span>
            <input className="input ltr" id="phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="01xxxxxxxxx" />
          </label>
        </div>

        <div className="box">
          <label className="field">
            <span>ميعاد معاينة مقترح <em>(اختياري)</em></span>
            <input className="input" type="datetime-local" id="visit" value={visit} onChange={(e) => setVisit(e.target.value)} />
          </label>
          <span className="hint">ممكن تسيبه فاضي وتحدده بعد ما {ownerName} يوافق.</span>
        </div>

        {error && <div className="err" role="alert">{error}</div>}
        {busy && pics.length > 0 && (
          <div>
            <div className="progress"><i style={{ width: `${progress}%` }} /></div>
            <p className="hint" style={{ marginTop: 4 }}>بنرفع الصور… {progress}%</p>
          </div>
        )}
        <button className="btn block" type="submit" disabled={busy}>{busy ? "بنبعت…" : "إرسال"}</button>
        <p className="hint" style={{ textAlign: "center" }}>مش محتاج تسجّل. اسمك ورقمك بيتحفظوا للمرة الجاية.</p>
      </form>
    </main>
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

function Header({ ownerName }: { ownerName: string }) {
  return (
    <header className="top">
      <div className="dot">ع</div>
      <div className="t">
        <b>ابعت العقار لـ{ownerName}</b>
        <small>الصق رسالتك وارفع الصور · دقيقة واحدة</small>
      </div>
    </header>
  );
}
