import { ImageResponse } from "next/og";

// App icon: a building with windows on the brand green. Drawn, not text, so no font is needed.
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  const size = raw === "512" ? 512 : 192;
  const u = size / 192;
  const win = (key: string) => <div key={key} style={{ width: 18 * u, height: 18 * u, background: "#2f5d50", borderRadius: 3 * u }} />;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#2f5d50", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        <div style={{ width: 92 * u, height: 128 * u, background: "#dce9e3", borderRadius: `${8 * u}px ${8 * u}px 0 0`, display: "flex", flexWrap: "wrap", justifyContent: "space-around", alignContent: "flex-start", padding: `${14 * u}px ${10 * u}px`, gap: 12 * u }}>
          {Array.from({ length: 9 }, (_, i) => win(String(i)))}
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
