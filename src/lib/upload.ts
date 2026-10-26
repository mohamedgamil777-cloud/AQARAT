"use client";

import { sb } from "./sb";
import { compress } from "./image";

/** Compresses and uploads photos 3 at a time; returns their storage paths in the same order. */
export async function uploadPhotos(files: File[], onProgress: (pct: number) => void): Promise<string[]> {
  const folder = `u/${crypto.randomUUID()}`;
  const paths: string[] = new Array(files.length);
  let finished = 0, cursor = 0;
  const worker = async () => {
    while (cursor < files.length) {
      const i = cursor++;
      const blob = await compress(files[i]);
      const path = `${folder}/${String(i + 1).padStart(2, "0")}.jpg`;
      const { error } = await sb.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw new Error(error.message);
      paths[i] = path;
      onProgress(Math.round((++finished / files.length) * 100));
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return paths;
}
