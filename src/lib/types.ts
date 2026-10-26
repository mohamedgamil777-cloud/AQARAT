export type Vote = "like" | "nope" | null;
export type Author = "owner" | "partner" | "broker";

export interface Comment {
  id: string;
  author: Author;
  body: string;
  private: boolean;
  created_at: string;
}

export interface Listing {
  id: string;
  raw_text: string;
  area: string | null;
  price: number | null;
  size_m2: number | null;
  floors: number | null;
  map_url: string | null;
  suggested_visit: string | null;
  visit_confirmed: boolean;
  owner_vote: Vote;
  partner_vote: Vote;
  features: string[];
  created_at: string;
  broker: { name: string; phone: string; token?: string | null };
  photos: string[];
  comments: Comment[];
}

export interface ViewerData {
  role: "owner" | "partner";
  hunt: {
    title: string;
    owner_name: string;
    partner_name: string;
    owner_phone: string | null;
    features: string[];
    invite: string;
    partner_token: string | null;
  };
  listings: Listing[];
}

export interface BrokerData {
  broker: { name: string; phone: string };
  hunt: { owner_name: string; owner_phone: string | null; invite: string };
  listings: Listing[];
}
