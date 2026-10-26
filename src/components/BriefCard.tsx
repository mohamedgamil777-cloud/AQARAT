import type { Brief } from "@/lib/brief";
import { rangeText } from "@/lib/brief";

/** "What we're looking for" — shown to brokers so they only send matching buildings. */
export default function BriefCard({ brief, ownerName, compact = false }: { brief?: Brief; features?: string[]; ownerName: string; compact?: boolean }) {
  if (!brief) return null;
  const size = brief ? rangeText(brief.size_min, brief.size_max, "م²") : null;
  const price = brief ? rangeText(brief.price_min, brief.price_max, "ج.م في الشهر") : null;
  const rows = (
    <>
      {brief?.location && <div className="brow2"><span>المكان</span><b>{brief.location}</b></div>}
      {size && <div className="brow2"><span>المساحة</span><b>{size}</b></div>}
      {price && <div className="brow2"><span>الإيجار الشهري</span><b>{price}</b></div>}
      {brief?.ground && <div className="brow2"><span>الدور</span><b>يفضّل دور أرضي</b></div>}
    </>
  );
  if (compact) {
    return (
      <details className="brief">
        <summary>{ownerName} بيدوّر على إيه؟</summary>
        {rows}
      </details>
    );
  }
  return (
    <div className="brief">
      <b className="brief-t">{ownerName} بيدوّر على</b>
      {rows}
    </div>
  );
}
