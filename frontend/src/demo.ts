// Demo market data, used when no contract address is configured. It lets the
// whole site run before deployment and keeps the shape of the real get_board().
import type { Pact, Stats } from "./types";

const GEN = 1e18;
const WEEK = 7 * 24 * 3600;
const START = Math.floor(Date.UTC(2026, 9, 5) / 1000); // 2026-10-05
const NOW = Math.floor(Date.now() / 1000);

function makePact(
  id: number,
  goal: string,
  weeks: number,
  stakeGen: number,
  yesGen: number,
  noGen: number,
  bettors: number,
  statusHits: number[],
  status: Pact["status"],
  skips = 0,
): Pact {
  const deadline_ts = Array.from({ length: weeks }, (_, i) => START + (i + 1) * WEEK);
  const deadline_dates = deadline_ts.map((t) => new Date(t * 1000).toISOString().slice(0, 10));
  const checkins = statusHits.map((h, i) => ({
    week: i,
    proof_url: `https://example.com/pact-${id}/week-${i}`,
    status: "FINAL" as const,
    verdict: h === 1 ? "HIT" : "MISS",
    outcome: (h === 1 ? "HIT" : h === 2 ? "SKIPPED" : "MISS") as "HIT" | "MISS" | "SKIPPED",
    quote: "",
    date: deadline_dates[i],
  }));
  return {
    id,
    creator: `0x${(id + 1).toString(16).padStart(40, "a")}`,
    goal,
    proof_page: `https://example.com/pact-${id}`,
    stake: stakeGen * GEN,
    total: weeks,
    deadline_dates,
    deadline_ts,
    skips_left: skips,
    status,
    checkins,
    yes_pool: (stakeGen + yesGen) * GEN,
    no_pool: noGen * GEN,
    bettors,
    hits: checkins.filter((c) => c.outcome === "HIT").length,
    misses: checkins.filter((c) => c.outcome === "MISS").length,
  };
}

export const DEMO_PACTS: Pact[] = [
  makePact(0, "Publish one article every week for 12 weeks", 12, 1.5, 4.2, 2.1, 17, [1, 1, 1], "ACTIVE"),
  makePact(1, "Run 5 km every Saturday for 8 weeks", 8, 0.8, 1.6, 3.9, 9, [1, 1, 1, 1, 1, 1, 1, 1], "COMPLETED"),
  makePact(2, "Ship one open-source commit a day for 14 days", 14, 2.0, 6.0, 9.5, 31, [1, 0], "BROKEN"),
  makePact(3, "Read one book per month for 6 months", 6, 0.3, 0.4, 0.9, 5, [1, 1, 2], "ACTIVE", 1),
  makePact(4, "Cook dinner at home 4 nights a week for 6 weeks", 6, 0.5, 1.1, 0.7, 7, [1, 1, 1, 1, 1, 1], "COMPLETED"),
  makePact(5, "Post a daily sketch for 30 days", 30, 1.0, 2.2, 5.5, 22, [1, 0], "BROKEN"),
];

export const DEMO_STATS: Stats = {
  pacts: DEMO_PACTS.length,
  active: DEMO_PACTS.filter((p) => p.status === "ACTIVE").length,
  completed: DEMO_PACTS.filter((p) => p.status === "COMPLETED").length,
  broken: DEMO_PACTS.filter((p) => p.status === "BROKEN").length,
  refunded: 0,
  total_wagered: DEMO_PACTS.reduce((s, p) => s + p.yes_pool + p.no_pool, 0),
  bets: 91,
};

export const nextDeadline = (p: Pact): number | null => {
  const now = NOW;
  return p.deadline_ts.find((t, i) => t > now && i >= p.checkins.length) ?? null;
};
