import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { rpc } from "@/lib/sb";
import BrokerForm from "./BrokerForm";
import type { Brief } from "@/lib/brief";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ invite: string }> }): Promise<Metadata> {
  const { invite } = await params;
  return {
    manifest: `/b/${invite}/manifest.webmanifest`,
    icons: { icon: "/icons/192", apple: "/icons/192" },
    appleWebApp: { capable: true, title: "عقارات" },
  };
}

export default async function BrokerPage({ params }: { params: Promise<{ invite: string }> }) {
  const { invite } = await params;
  const hunt = await rpc<{ title: string; owner_name: string; features: string[]; brief?: Brief } | null>("broker_invite", { p_invite: invite }).catch(() => null);
  if (!hunt) notFound();
  return <BrokerForm invite={invite} ownerName={hunt.owner_name} checklist={hunt.features} brief={hunt.brief} />;
}
