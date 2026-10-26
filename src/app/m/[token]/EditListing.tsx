"use client";

import { useState } from "react";
import { photoUrl, rpc } from "@/lib/sb";
import { uploadPhotos } from "@/lib/upload";
import { parseListing } from "@/lib/parse";
import type { Listing } from "@/lib/types";
import { errorText, money, westernDigits } from "@/lib/util";
import { ImageIcon, ImagePlus, Money } from "@/components/Icons";

const MAX_PHOTOS = 40;

type Props = { l: Listing; token: string; checklist: string[]; onClose: (saved: boolean) => void };

/** Broker edits a building they already sent: text, rent, remove photos, add photos. */
export default function EditListing({ l, token, checklist, onClose }: Props) {
  const [raw, setRaw] = useState(l.raw_text);
  const [price, setPrice] = useState(money(l.price));
  const [keep, setKeep] = useState<string[]>(l.photos);
  const [added, setAdded] = useState<{ file: File; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState("");

  const total = keep.length + added.length;

  function addFiles(list: FileList | null) {
    if (!list) return;
    const images = [...list].filter((f) => f.type.startsWith("image/"));
    const room = MAX_PHOTOS - total;
    if (images.length > room) setErr(`أقصى عدد ${MAX_PHOTOS} صورة. اتضاف أول ${Math.max(room, 0)} بس.`);
    setAdded((a) => [...a, ...images.slice(0, Math.max(room, 0)).map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  }

  function dropAdded(i: number) {
    setAdded((a) => { URL.revokeObjectURL(a[i].url); return a.filter((_, j) => j !== i); });
  }

  async function save() {
    setErr("");
    const priceNum = parseInt(westernDigits(price).replace(/\D/g, ""), 10);
    if (!priceNum) return setErr("اكتب الإيجار الشهري.");
    if (!raw.trim() && total === 0) return setErr("سيب وصف أو صورة على الأقل.");
    setBusy(true); setProgress(0);
    try {
      const { paths, hashes } = added.length ? await uploadPhotos(added.map((a) => a.file), setProgress) : { paths: [], hashes: [] };
      const p = parseListing(raw, checklist);
      await rpc("broker_edit_listing_v2", {
        p_token: token, p_listing: l.id, p_raw: raw, p_area: p.area, p_price: priceNum, p_size: p.size,
        p_floors: p.floors, p_map: p.mapUrl, p_features: p.features,
        p_remove: l.photos.filter((x) => !keep.includes(x)), p_add: paths, p_hashes: hashes,
      });
      added.forEach((a) => URL.revokeObjectURL(a.url));
      onClose(true);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="editbox">
      <b>تعديل العقار</b>

      <label className="field">
        رسالة العقار
        <textarea className="input" id={`e-raw-${l.id}`} value={raw} onChange={(e) => setRaw(e.target.value)} />
      </label>

      <label className="field">
        <span>الإيجار الشهري (جنيه) <span className="req">*</span></span>
        <span className="iwrap"><Money />
          <input className="input" id={`e-price-${l.id}`} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
        </span>
      </label>

      <div className="field">
        <span>الصور ({total}/{MAX_PHOTOS})</span>
        {total > 0 && (
          <div className="thumbs">
            {keep.map((p) => (
              <div className="thumb" key={p}>
                <img src={photoUrl(p)} alt="" />
                {!busy && <button type="button" aria-label="شيل الصورة" onClick={() => setKeep((k) => k.filter((x) => x !== p))}>×</button>}
              </div>
            ))}
            {added.map((a, i) => (
              <div className="thumb new" key={a.url}>
                <img src={a.url} alt="" />
                {!busy && <button type="button" aria-label="شيل الصورة" onClick={() => dropAdded(i)}>×</button>}
              </div>
            ))}
          </div>
        )}
        {keep.length < l.photos.length && (
          <button type="button" className="link" style={{ fontSize: 13, alignSelf: "flex-start" }} onClick={() => setKeep(l.photos)}>
            رجّع الصور اللي شلتها ({l.photos.length - keep.length})
          </button>
        )}
      </div>

      <label className="photobox">
        <input type="file" accept="image/*" multiple id={`e-photos-${l.id}`} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <span className="pb-icon"><ImagePlus /></span>
        <span className="pb-text"><b>ضيف صور</b><span>من الجاليري أو ألبوم WhatsApp Images</span></span>
        <span className="pb-btn"><ImageIcon />اختار</span>
      </label>

      {err && <div className="err" role="alert">{err}</div>}
      {busy && added.length > 0 && (
        <div>
          <div className="progress"><i style={{ width: `${progress}%` }} /></div>
          <p className="hint" style={{ marginTop: 4 }}>بنرفع الصور… {progress}%</p>
        </div>
      )}
      <div className="row2">
        <button type="button" className="btn" onClick={save} disabled={busy}>{busy ? "بنحفظ…" : "حفظ التعديل"}</button>
        <button type="button" className="btn ghost" onClick={() => onClose(false)} disabled={busy}>إلغاء</button>
      </div>
    </div>
  );
}
