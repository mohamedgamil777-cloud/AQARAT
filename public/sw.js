// Aqarat service worker. Its only job: catch photos shared from WhatsApp / Gallery
// (Android share sheet → POST /b/<invite>/share), keep them, and open the broker form with them.
const SHARE_CACHE = "aqarat-share";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const m = url.pathname.match(/^\/b\/([^/]+)\/share$/);
  if (event.request.method !== "POST" || !m) return;

  event.respondWith((async () => {
    const invite = m[1];
    try {
      const form = await event.request.formData();
      const files = form.getAll("photos").filter((f) => f && typeof f !== "string");
      const text = [form.get("title"), form.get("text"), form.get("url")].filter(Boolean).join("\n");
      await caches.delete(SHARE_CACHE);
      const cache = await caches.open(SHARE_CACHE);
      await Promise.all(files.map((f, i) =>
        cache.put(`/__shared/${i}`, new Response(f, { headers: { "Content-Type": f.type || "image/jpeg", "X-Name": encodeURIComponent(f.name || `photo-${i + 1}.jpg`) } }))));
      await cache.put("/__shared/meta", new Response(JSON.stringify({ count: files.length, text, at: Date.now() }), { headers: { "Content-Type": "application/json" } }));
      return Response.redirect(`/b/${invite}?shared=1`, 303);
    } catch (err) {
      return Response.redirect(`/b/${invite}?shared=lost`, 303);
    }
  })());
});
