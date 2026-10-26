// Per-broker-link manifest: installing from /b/<invite> opens that same link, and the app shows up
// in Android's share sheet (WhatsApp, Gallery) as "عقارات" so photos go straight into the form.
export async function GET(_req: Request, { params }: { params: Promise<{ invite: string }> }) {
  const { invite } = await params;
  const manifest = {
    id: `/b/${invite}`,
    name: "عقارات — ابعت عقار",
    short_name: "عقارات",
    description: "ابعت صور وتفاصيل العقار في دقيقة",
    lang: "ar",
    dir: "rtl",
    start_url: `/b/${invite}`,
    scope: "/",
    display: "standalone",
    background_color: "#f3f4f1",
    theme_color: "#2f5d50",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: `/b/${invite}/share`,
      method: "POST",
      enctype: "multipart/form-data",
      params: { title: "title", text: "text", url: "url", files: [{ name: "photos", accept: ["image/*"] }] },
    },
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-cache" },
  });
}
