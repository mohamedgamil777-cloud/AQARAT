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
  edited_at: string | null;
  edited_fields: string[];
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
  /** Pairs of buildings that look like the same place (only shown to owner + partner). */
  duplicates?: Duplicate[];
  /** Every broker who logged in — owner only. */
  brokers?: BrokerRow[] | null;
}

export type DupReason = "map" | "photos" | "text" | "area";

export interface Duplicate {
  a: string;
  b: string;
  reasons: DupReason[];
  created_at: string;
}

export interface BrokerRow {
  id: string;
  name: string;
  phone: string;
  has_pin: boolean;
  locked: boolean;
  listings: number;
  created_at: string;
}

export interface BrokerData {
  broker: { name: string; phone: string; has_pin?: boolean };
  hunt: { owner_name: string; owner_phone: string | null; invite: string; features: string[] };
  listings: Listing[];
}
