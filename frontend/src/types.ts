export type Side = "YES" | "NO";
export type PactStatus = "ACTIVE" | "COMPLETED" | "BROKEN" | "REFUNDED";

export interface CheckIn {
  week: number;
  proof_url: string;
  status: "PENDING" | "PROPOSED" | "DISPUTED" | "FINAL";
  verdict: string;
  outcome: "" | "HIT" | "MISS" | "SKIPPED";
  quote: string;
  date: string;
}

export interface Pact {
  id: number;
  creator: string;
  goal: string;
  proof_page: string;
  stake: number; // wei
  total: number;
  deadline_dates: string[];
  deadline_ts: number[]; // unix seconds
  skips_left: number;
  status: PactStatus;
  checkins: CheckIn[];
  yes_pool: number; // wei
  no_pool: number; // wei
  bettors: number;
  hits: number;
  misses: number;
}

export interface Stats {
  pacts: number;
  active: number;
  completed: number;
  broken: number;
  refunded: number;
  total_wagered: number;
  bets: number;
}
