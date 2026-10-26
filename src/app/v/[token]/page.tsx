import { notFound } from "next/navigation";
import { rpc } from "@/lib/sb";
import type { ViewerData } from "@/lib/types";
import Review from "./Review";

export const dynamic = "force-dynamic";

export default async function ViewerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await rpc<ViewerData | null>("viewer_view", { p_token: token }).catch(() => null);
  if (!data) notFound();
  return <Review token={token} initial={data} />;
}
