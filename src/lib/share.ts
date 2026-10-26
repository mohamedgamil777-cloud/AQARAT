"use client";

const SHARE_CACHE = "aqarat-share";

export function registerSW() {
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

/** Photos and text the service worker kept from an Android share (WhatsApp / Gallery), read once then cleared. */
export async function takeShared(): Promise<{ files: File[]; text: string } | null> {
  if (typeof caches === "undefined") return null;
  const cache = await caches.open(SHARE_CACHE);
  const metaRes = await cache.match("/__shared/meta");
  if (!metaRes) return null;
  const meta = (await metaRes.json()) as { count: number; text: string };
  const files: File[] = [];
  for (let i = 0; i < meta.count; i++) {
    const r = await cache.match(`/__shared/${i}`);
    if (!r) continue;
    const blob = await r.blob();
    const name = decodeURIComponent(r.headers.get("X-Name") || `photo-${i + 1}.jpg`);
    files.push(new File([blob], name, { type: blob.type || "image/jpeg" }));
  }
  await caches.delete(SHARE_CACHE);
  return { files, text: meta.text || "" };
}

export type InstallState = "installed" | "can-install" | "ios" | "other";

export function detectInstall(): InstallState {
  if (typeof window === "undefined") return "other";
  if (window.matchMedia("(display-mode: standalone)").matches) return "installed";
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return "ios";
  return "other";
}
