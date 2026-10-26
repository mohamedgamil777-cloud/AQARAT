"use client";

import { sb } from "./sb";
import { compress } from "./image";

/** Compresses and uploads photos 3 at a time; returns storage paths and photo fingerprints in the same order. */
export async function uploadPhotos(files: File[], onProgress: (pct: number) => void): Promise<{ paths: string[]; hashes: (string | null)[] }> {
  const folder = `u/${crypto.randomUUID()}`;
  const paths: string[] = new Array(files.length);
  const hashes: (string | null)[] = new Array(files.length).fill(null);
  let finished = 0, cursor = 0;
  const worker = async () => {
    while (cursor < files.length) {
      const i = cursor++;
      const { blob, hash } = await compress(files[i]);
      const path = `${folder}/${String(i + 1).padStart(2, "0")}.jpg`;
      const { error } = await sb.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw new Error(error.message);
      paths[i] = path;
      hashes[i] = hash;
      onProgress(Math.round((++finished / files.length) * 100));
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return { paths, hashes };
}
