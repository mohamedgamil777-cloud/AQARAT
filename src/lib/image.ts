"use client";

async function load(file: File): Promise<{ img: HTMLImageElement; done: () => void }> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => { URL.revokeObjectURL(url); rej(new Error("BAD_IMAGE")); };
    i.src = url;
  });
  return { img, done: () => URL.revokeObjectURL(url) };
}

/**
 * 64-bit difference hash (16 hex chars). The same photo forwarded by two brokers — even re-compressed
 * by WhatsApp or resized — gives (almost) the same hash, which is how duplicate buildings are spotted.
 */
function dhash(img: HTMLImageElement): string {
  // Average real pixel blocks (not the browser's rough tiny-resize) so WhatsApp re-compression barely moves it.
  const B = 32, W = 9 * B, H = 8 * B;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, W, H);
  const px = ctx.getImageData(0, 0, W, H).data;
  const g = new Float64Array(72);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    g[Math.floor(y / B) * 9 + Math.floor(x / B)] += px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
  }
  let hex = "";
  for (let y = 0; y < 8; y++) {
    let byte = 0;
    for (let x = 0; x < 8; x++) byte = (byte << 1) | (g[y * 9 + x] > g[y * 9 + x + 1] ? 1 : 0);
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/** Shrinks a phone photo to ≤1600px JPEG (~200-400KB) so uploads work on weak 4G, and fingerprints it. */
export async function compress(file: File, max = 1600, quality = 0.8): Promise<{ blob: Blob; hash: string | null }> {
  const { img, done } = await load(file);
  try {
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", quality));
    let hash: string | null = null;
    try { hash = dhash(img); } catch {}
    return { blob: blob ?? file, hash };
  } finally {
    done();
  }
}
