// Reads and writes PactArena through genlayer-js. When no contract address is
// configured, the app runs on demo data so the UI can be explored first.
import { createClient } from "genlayer-js";
import type { Pact, Stats } from "./types";
import { DEMO_PACTS, DEMO_STATS } from "./demo";

export const STUDIO = {
  id: 61999,
  name: "GenLayer Studio Network",
  rpc: "https://studio.genlayer.com/api",
  explorer: "https://explorer-studio.genlayer.com",
};

export const ADDRESS = (import.meta.env.VITE_PACT_ADDRESS as string | undefined) || "";
export const IS_LIVE = ADDRESS.startsWith("0x");

type Ethereum = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
declare global {
  interface Window {
    ethereum?: Ethereum;
  }
}

export async function connectWallet(): Promise<string | null> {
  if (!window.ethereum) return null;
  const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
  return accounts[0] ?? null;
}

function client() {
  return createClient({ chain: STUDIO, endpoint: STUDIO.rpc } as never);
}

export async function loadMarkets(): Promise<{ pacts: Pact[]; stats: Stats; live: boolean }> {
  if (!IS_LIVE) return { pacts: DEMO_PACTS, stats: DEMO_STATS, live: false };
  try {
    const c = client() as any;
    const [pacts, stats] = await Promise.all([
      c.readContract({ address: ADDRESS, functionName: "get_board", args: [] }),
      c.readContract({ address: ADDRESS, functionName: "get_stats", args: [] }),
    ]);
    return { pacts: pacts as Pact[], stats: stats as Stats, live: true };
  } catch (err) {
    console.warn("Falling back to demo data:", err);
    return { pacts: DEMO_PACTS, stats: DEMO_STATS, live: false };
  }
}

// Sends a write and waits for the transaction to finalize.
export async function writeCall(
  account: string,
  functionName: string,
  args: unknown[],
  valueWei = 0n,
): Promise<string> {
  if (!IS_LIVE) throw new Error("No contract configured: deploy first (see deploy/deploy.sh).");
  const c = client() as any;
  const hash = await c.writeContract({
    address: ADDRESS,
    functionName,
    args,
    value: valueWei,
    account,
  });
  await c.waitForTransactionReceipt({ hash, status: "FINALIZED" });
  return hash as string;
}
