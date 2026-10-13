# Pact Arena

Stake GEN on a public commitment. Everyone else bets YES (they'll finish) or
NO (they'll fail). Validators judge each weekly check-in against the proof page
the creator links, so nobody has to trust anyone.

## How it works

1. **Create a pact.** Set the goal, the weekly check-ins, the proof page and a
   stake of at least 0.1 GEN. Optionally include one skip token.
2. **Place bets.** Anyone except the creator backs YES or NO with at least
   0.01 GEN. An address picks one side per market. Betting closes at the first
   check-in deadline.
3. **Check in weekly.** The creator links that week's proof. Validators read the
   page and rule `HIT` or `MISS`. A HIT needs a quote and a date on or before the
   deadline, and the contract checks both itself.
4. **Review window.** A verdict is only a proposal for 24 hours. Anyone can
   dispute it with a counter-link. `finalize` then settles it, re-judging with
   the counter-evidence if there was a dispute.
5. **Result.** Every check-in hits: the pact is `COMPLETED`. One miss: `BROKEN`,
   unless a skip token is spent on it.
6. **Payouts.** Winners call `claim`. The winning side gets its stake back plus a
   pro-rata share of the losing pool.
7. **Safety exit.** If nothing is decided 30 days after the last deadline,
   `release` refunds everyone.

## Layout

```
contracts/pact_arena.py   Intelligent Contract
tests/                    contract tests (run locally, no network needed)
deploy/deploy.sh          deploys to GenLayer Studio and writes frontend/.env
config/networks.json      Studio RPC, chain id 61999, explorer
frontend/                 Vite + React betting site and dashboard
```

## Run the contract tests

```
pip install -r requirements.txt
pytest
```

`tests/conftest.py` stubs the `genlayer` SDK so the contract logic runs in plain
Python. Validator verdicts, web reads and LLM answers are controlled by the test.
Live validator behavior still needs a Studio run.

## Deploy

```
npm install -g genlayer
./deploy/deploy.sh          # NETWORK=studio by default
cd frontend && npm install && npm run dev
```

Without `VITE_PACT_ADDRESS`, the site runs on demo data so the UI can be explored
before deployment.

## Known limits

- `now` is passed in by the caller for review windows and betting cut-offs. It is
  not verified by validators in this version.
- Check-in deadlines are the weekly dates the creator sets. The frontend uses
  Sunday 23:59 UTC.
- Rounding dust from pro-rata payouts stays in the contract.
