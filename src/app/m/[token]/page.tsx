import { notFound } from "next/navigation";
import { rpc } from "@/lib/sb";
import type { BrokerData } from "@/lib/types";
import BrokerInbox from "./BrokerInbox";

export const dynamic = "force-dynamic";

export default async function BrokerInboxPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await rpc<BrokerData | null>("broker_view", { p_token: token }).catch(() => null);
  if (!data) notFound();
  return <BrokerInbox token={token} initial={data} />;
}
