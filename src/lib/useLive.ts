"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Keeps server data fresh: refetches every `ms`, when the tab comes back, and after each action via `reload`. */
export function useLive<T>(initial: T, fetcher: () => Promise<T>, ms = 15000) {
  const [data, setData] = useState(initial);
  const ref = useRef(fetcher);
  ref.current = fetcher;

  const reload = useCallback(async () => {
    try { setData(await ref.current()); } catch {}
  }, []);

  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") reload(); }, ms);
    const onVis = () => { if (document.visibilityState === "visible") reload(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [ms, reload]);

  return [data, reload, setData] as const;
}
