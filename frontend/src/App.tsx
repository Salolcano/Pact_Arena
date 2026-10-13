import { useEffect, useMemo, useState } from "react";
import type { Pact, Side, Stats } from "./types";
import { IS_LIVE, connectWallet, loadMarkets, writeCall } from "./chain";
import { Bars, Donut, OddsBar, Ring, Spark } from "./charts";

type Tab = "markets" | "dashboard" | "create";
type Filter = "all" | "ACTIVE" | "COMPLETED" | "BROKEN";

const WEI = 1e18;
const gen = (wei: number) => (wei / WEI).toFixed(2);
const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

// Decimal GEN string to wei as bigint, without float error.
function toWei(amount: string): bigint {
  const [whole, frac = ""] = amount.trim().split(".");
  return BigInt(whole || "0") * 10n ** 18n + BigInt((frac + "0".repeat(18)).slice(0, 18));
}

function countdown(ts: number, now: number): string {
  const d = ts - now;
  if (d <= 0) return "due now";
  const days = Math.floor(d / 86400);
  const hours = Math.floor((d % 86400) / 3600);
  return days > 0 ? `${days}d ${hours}h left` : `${hours}h ${Math.floor((d % 3600) / 60)}m left`;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("markets");
  const [pacts, setPacts] = useState<Pact[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [live, setLive] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [toast, setToast] = useState<string | null>(null);
  const [bet, setBet] = useState<{ pact: Pact; side: Side } | null>(null);

  const refresh = () => loadMarkets().then((r) => {
    setPacts(r.pacts);
    setStats(r.stats);
    setLive(r.live);
  });

  useEffect(() => {
    refresh();
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 60_000);
    return () => clearInterval(t);
  }, []);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3800);
  };

  const connect = async () => {
    const a = await connectWallet();
    if (a) setAccount(a);
    else notify("No wallet found. Install a browser wallet to play for real.");
  };

  const requireAccount = (): string | null => {
    if (!account) {
      notify("Connect a wallet first.");
      return null;
    }
    return account;
  };

  const placeBet = async (pact: Pact, side: Side, amount: string) => {
    const a = requireAccount();
    if (!a) return;
    if (!IS_LIVE) return notify(`Demo mode: a ${amount} GEN ${side} bet would be sent to the contract.`);
    try {
      await writeCall(a, "place_bet", [pact.id, side, now], toWei(amount));
      notify(`Bet placed on #${pact.id}. Refreshing the board.`);
      refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Transaction failed");
    }
  };

  return (
    <div className="app">
      <div className="backdrop" aria-hidden />
      <header className="topbar">
        <div className="brand">
          <span className="logo">◆</span> Pact<span>Arena</span>
        </div>
        <nav className="tabs">
          {(["markets", "dashboard", "create"] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? "tab active" : "tab"} onClick={() => setTab(t)}>
              {t === "markets" ? "Markets" : t === "dashboard" ? "Dashboard" : "Create pact"}
            </button>
          ))}
        </nav>
        <div className="top-right">
          <span className={live ? "net live" : "net"}>{live ? "● Studio live" : "● Demo data"}</span>
          <button className="wallet" onClick={account ? () => setAccount(null) : connect}>
            {account ? short(account) : "Connect wallet"}
          </button>
        </div>
      </header>

      {stats && (
        <div className="ticker">
          <div className="ticker-track">
            {[0, 1].map((k) => (
              <div className="ticker-row" key={k}>
                <span>Pacts <b>{stats.pacts}</b></span>
                <span>Live <b>{stats.active}</b></span>
                <span>Kept <b className="g">{stats.completed}</b></span>
                <span>Broken <b className="r">{stats.broken}</b></span>
                <span>Wagered <b>{gen(stats.total_wagered)} GEN</b></span>
                <span>Bets <b>{stats.bets}</b></span>
              </div>
            ))}
          </div>
        </div>
      )}

      <main>
        {tab === "markets" && <Markets pacts={pacts} now={now} onBet={(p, s) => setBet({ pact: p, side: s })} />}
        {tab === "dashboard" && <Dashboard pacts={pacts} stats={stats} />}
        {tab === "create" && (
          <CreatePact
            onSubmit={async (args, stakeWei) => {
              const a = requireAccount();
              if (!a) return;
              if (!IS_LIVE) return notify("Demo mode: deploy the contract to create pacts on chain.");
              try {
                await writeCall(a, "create_pact", args, stakeWei);
                notify("Pact created on GenLayer Studio.");
                refresh();
                setTab("markets");
              } catch (e) {
                notify(e instanceof Error ? e.message : "Transaction failed");
              }
            }}
          />
        )}
      </main>

      {bet && (
        <BetModal
          pact={bet.pact}
          side={bet.side}
          onClose={() => setBet(null)}
          onConfirm={(amount) => {
            placeBet(bet.pact, bet.side, amount);
            setBet(null);
          }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Markets({ pacts, now, onBet }: { pacts: Pact[]; now: number; onBet: (p: Pact, s: Side) => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = useMemo(
    () => pacts.filter((p) => filter === "all" || p.status === filter),
    [pacts, filter],
  );
  return (
    <section>
      <div className="section-head">
        <div>
          <h1>Live markets</h1>
          <p>Back a pact YES if they'll finish, NO if they'll fail. Validators judge every check-in.</p>
        </div>
        <div className="chips">
          {(["all", "ACTIVE", "COMPLETED", "BROKEN"] as Filter[]).map((f) => (
            <button key={f} className={filter === f ? "chip on" : "chip"} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f[0] + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="grid">
        {shown.map((p) => {
          const done = p.checkins.filter((c) => c.status === "FINAL" && c.outcome !== "MISS").length;
          const next = p.deadline_ts[p.checkins.length];
          return (
            <article className={`card status-${p.status.toLowerCase()}`} key={p.id}>
              <div className="card-top">
                <span className={`pill ${p.status.toLowerCase()}`}>{p.status === "ACTIVE" ? "● Live" : p.status}</span>
                <span className="muted">#{p.id} · {short(p.creator)}</span>
              </div>
              <h3>{p.goal}</h3>
              <div className="card-mid">
                <Ring value={done} max={p.total} />
                <div className="stack">
                  <div className="kpi">
                    <span>Pool</span>
                    <b>{gen(p.yes_pool + p.no_pool)} GEN</b>
                  </div>
                  <div className="kpi">
                    <span>Bettors</span>
                    <b>{p.bettors}</b>
                  </div>
                  <div className="kpi">
                    <span>{p.status === "ACTIVE" && next ? "Next check-in" : "Record"}</span>
                    <b>
                      {p.status === "ACTIVE" && next ? countdown(next, now) : `${p.hits} hit · ${p.misses} miss`}
                    </b>
                  </div>
                </div>
              </div>
              <OddsBar yes={p.yes_pool} no={p.no_pool} />
              <div className="streak">
                {Array.from({ length: p.total }, (_, i) => {
                  const c = p.checkins[i];
                  const cls = !c ? "pending" : c.outcome === "HIT" ? "hit" : c.outcome === "SKIPPED" ? "skip" : "miss";
                  return <i key={i} className={cls} title={`Week ${i + 1}`} />;
                })}
              </div>
              {p.status === "ACTIVE" ? (
                <div className="bet-row">
                  <button className="bet yes" onClick={() => onBet(p, "YES")}>Back YES</button>
                  <button className="bet no" onClick={() => onBet(p, "NO")}>Back NO</button>
                </div>
              ) : (
                <div className="settled">{p.status === "COMPLETED" ? "Kept. YES side can claim." : p.status === "BROKEN" ? "Broken. NO side can claim." : "Refunded."}</div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function BetModal({
  pact,
  side,
  onClose,
  onConfirm,
}: {
  pact: Pact;
  side: Side;
  onClose: () => void;
  onConfirm: (amount: string) => void;
}) {
  const [amount, setAmount] = useState("0.10");
  const amt = Number(amount) || 0;
  const yes = pact.yes_pool / WEI;
  const no = pact.no_pool / WEI;
  // If this side wins, the stake is returned plus a pro-rata share of the losing pool.
  const mine = side === "YES" ? yes : no;
  const other = side === "YES" ? no : yes;
  const payout = mine + amt > 0 ? amt + (amt * other) / (mine + amt) : 0;
  const multiple = amt > 0 ? payout / amt : 0;
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className={`pill ${side === "YES" ? "yes-pill" : "no-pill"}`}>Back {side}</span>
          <button className="x" onClick={onClose}>×</button>
        </div>
        <h3>{pact.goal}</h3>
        <label>Amount (GEN, minimum 0.01)</label>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
        <div className="chips">
          {["0.01", "0.10", "0.50", "1.00"].map((v) => (
            <button key={v} className="chip" onClick={() => setAmount(v)}>{v}</button>
          ))}
        </div>
        <div className="preview">
          <div><span>If {side} wins</span><b>{payout.toFixed(3)} GEN</b></div>
          <div><span>Multiple</span><b>{multiple.toFixed(2)}×</b></div>
          <div><span>Your risk</span><b>{amt.toFixed(2)} GEN</b></div>
        </div>
        <button className={`bet big ${side === "YES" ? "yes" : "no"}`} disabled={amt < 0.01} onClick={() => onConfirm(amount)}>
          Confirm {side} bet
        </button>
      </div>
    </div>
  );
}

function Dashboard({ pacts, stats }: { pacts: Pact[]; stats: Stats | null }) {
  const weeks = Math.max(0, ...pacts.map((p) => p.total));
  const weekRate = Array.from({ length: weeks }, (_, i) => {
    const relevant = pacts.map((p) => p.checkins[i]).filter((c) => c && c.status === "FINAL");
    if (!relevant.length) return 0;
    return relevant.filter((c) => c.outcome !== "MISS").length / relevant.length;
  });
  const kept = stats?.completed ?? 0;
  const settled = (stats?.completed ?? 0) + (stats?.broken ?? 0);
  const keepRate = settled ? Math.round((kept / settled) * 100) : 0;
  const pool = pacts.map((p) => (p.yes_pool + p.no_pool) / WEI);
  let running = 0;
  const cumulative = pool.map((v) => (running += v));
  const leaders = [...pacts]
    .sort((a, b) => b.hits - a.hits || b.yes_pool - a.yes_pool)
    .slice(0, 5);

  return (
    <section className="dash">
      <div className="section-head">
        <div>
          <h1>Dashboard</h1>
          <p>How the arena is performing: kept vs broken pacts, weekly discipline and the biggest bets.</p>
        </div>
      </div>

      <div className="tiles">
        <Tile label="Total wagered" value={`${gen(stats?.total_wagered ?? 0)} GEN`} tone="gold" />
        <Tile label="Live pacts" value={String(stats?.active ?? 0)} tone="green" />
        <Tile label="Keep rate" value={`${keepRate}%`} tone="green" />
        <Tile label="Bets placed" value={String(stats?.bets ?? 0)} tone="blue" />
      </div>

      <div className="dash-grid">
        <div className="panel">
          <h4>Pact outcomes</h4>
          <Donut
            center={String(stats?.pacts ?? 0)}
            label="pacts"
            parts={[
              { name: "Live", value: stats?.active ?? 0, color: "#7CFFB2" },
              { name: "Kept", value: stats?.completed ?? 0, color: "#4DA3FF" },
              { name: "Broken", value: stats?.broken ?? 0, color: "#FF5C7A" },
              { name: "Refunded", value: stats?.refunded ?? 0, color: "#FFB84D" },
            ]}
          />
        </div>

        <div className="panel wide">
          <h4>Weekly discipline</h4>
          <p className="muted">Share of check-ins that passed (hit or skipped), by week.</p>
          <Bars values={weekRate} labels={weekRate.map((_, i) => `W${i + 1}`)} />
        </div>

        <div className="panel">
          <h4>Capital in play</h4>
          <Spark values={cumulative.length ? cumulative : [0]} />
          <div className="muted">Cumulative pool across markets</div>
        </div>

        <div className="panel wide">
          <h4>Top keepers</h4>
          <table className="board">
            <thead>
              <tr><th>#</th><th>Pact</th><th>Keeper</th><th>Hits</th><th>Pool</th><th>Status</th></tr>
            </thead>
            <tbody>
              {leaders.map((p, i) => (
                <tr key={p.id}>
                  <td>{i + 1}</td>
                  <td className="goal-cell">{p.goal}</td>
                  <td>{short(p.creator)}</td>
                  <td>{p.hits}/{p.total}</td>
                  <td>{gen(p.yes_pool + p.no_pool)} GEN</td>
                  <td><span className={`pill ${p.status.toLowerCase()}`}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`tile ${tone}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function CreatePact({
  onSubmit,
}: {
  onSubmit: (args: unknown[], stakeWei: bigint) => void;
}) {
  const [goal, setGoal] = useState("");
  const [proof, setProof] = useState("https://");
  const [weeks, setWeeks] = useState(12);
  const [start, setStart] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [stake, setStake] = useState("0.10");
  const [skip, setSkip] = useState(false);

  const deadlines = useMemo(() => {
    const first = new Date(`${start}T23:59:59Z`);
    return Array.from({ length: weeks }, (_, i) => {
      const d = new Date(first.getTime() + i * 7 * 86400000);
      return { date: d.toISOString().slice(0, 10), ts: Math.floor(d.getTime() / 1000) };
    });
  }, [start, weeks]);

  const valid = goal.trim().length > 0 && proof.startsWith("https://") && Number(stake) >= 0.1;

  return (
    <section className="create">
      <div className="section-head">
        <div>
          <h1>Make a pact</h1>
          <p>Commit publicly, stake GEN, and link the page where proof will appear each week.</p>
        </div>
      </div>
      <div className="create-grid">
        <div className="panel form">
          <label>Your commitment</label>
          <input value={goal} maxLength={280} onChange={(e) => setGoal(e.target.value)} placeholder="Publish one article every week for 12 weeks" />
          <label>Proof page (https)</label>
          <input value={proof} onChange={(e) => setProof(e.target.value)} placeholder="https://your-blog.example/archive" />
          <div className="row">
            <div>
              <label>Weeks: {weeks}</label>
              <input type="range" min={1} max={52} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} />
            </div>
            <div>
              <label>First check-in</label>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
          </div>
          <div className="row">
            <div>
              <label>Stake (GEN, minimum 0.10)</label>
              <input value={stake} onChange={(e) => setStake(e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <label>Skip token</label>
              <button className={skip ? "toggle on" : "toggle"} onClick={() => setSkip(!skip)}>
                {skip ? "One miss forgiven" : "No skip token"}
              </button>
            </div>
          </div>
          <button
            className="bet big yes"
            disabled={!valid}
            onClick={() =>
              onSubmit(
                [goal.trim(), proof, deadlines.map((d) => d.date), deadlines.map((d) => d.ts), skip ? 1 : 0],
                toWei(stake),
              )
            }
          >
            Stake {stake} GEN and publish
          </button>
        </div>

        <div className="panel">
          <h4>Your calendar</h4>
          <ol className="calendar">
            {deadlines.slice(0, 12).map((d, i) => (
              <li key={d.date}>
                <span>Week {i + 1}</span>
                <b>{d.date}</b>
              </li>
            ))}
          </ol>
          {weeks > 12 && <p className="muted">+ {weeks - 12} more weeks</p>}
          <div className="preview">
            <div><span>You stake</span><b>{stake} GEN</b></div>
            <div><span>Check-ins</span><b>{weeks}</b></div>
          </div>
        </div>
      </div>
    </section>
  );
}
