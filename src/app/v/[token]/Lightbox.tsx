"use client";

import { useEffect, useRef, useState } from "react";
import { photoUrl } from "@/lib/sb";

export default function Lightbox({ list, start, onClose }: { list: string[]; start: number; onClose: () => void }) {
  const strip = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(start);

  useEffect(() => {
    const el = strip.current;
    if (el) el.scrollLeft = -start * el.clientWidth; // RTL: scrollLeft runs negative
    if (el && Math.abs(el.scrollLeft) < 1 && start > 0) el.scrollLeft = start * el.clientWidth;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [start, onClose]);

  return (
    <div className="lb" role="dialog" aria-modal="true" aria-label="الصور">
      <div className="lb-top">
        <span>{i + 1} / {list.length}</span>
        <button onClick={onClose} aria-label="قفل">×</button>
      </div>
      <div className="lb-strip" ref={strip}
        onScroll={(e) => { const el = e.currentTarget; setI(Math.round(Math.abs(el.scrollLeft) / el.clientWidth)); }}>
        {list.map((p) => <img key={p} src={photoUrl(p)} alt="" />)}
      </div>
    </div>
  );
}
