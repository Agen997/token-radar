# Token Radar — the best token launch radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Agen997/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Agen997/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

> Which token launch is worth farming next — and what to do about it. Built for
> [make.fun's token launch radar bounty](https://make.fun/bounty/token-radar-01).

Token Radar reads a sealed DefiLlama snapshot, ranks every pre-token protocol by an
**implied value** it states in the open, and hands each one a concrete six-step farm
plan with a cost and a time. The dashboard is a static page with no network: a
sortable, filterable board, a per-protocol detail drawer that re-derives the model's
arithmetic in front of you, a live-token view, and a model sandbox that re-ranks the
whole board live when you move a constant.

## The model (radar-2)

A protocol is **pre-token** when its record carries no token — no market cap, no
CoinGecko id, no symbol. A protocol is **rankable** only when it is pre-token *and*
not a wrapped, staked or bridged product of a token that already trades: the
watchlist's own exclusion rule, applied to the whole board. That is why WBTC, Binance
staked ETH and USDT0 never appear here — their tokens already trade, so they are not
launches to farm.

```
implied value = TVL × 0.25 × growth × maturity × breadth
  growth   = 1 + clamp(change_7d, −60, +120)% × 0.5
  maturity = 0.6 + min(age_days, 1095) / 1095 × 0.4   (age unknown: 365 days)
  breadth  = 1 + 0.05 × ln(chains)
```

The board covers the snapshot's whole 40-protocol watchlist **and** all 158 other
rankable pre-token protocols — including the 20 that sit above the $50M floor without
being on the watchlist, which a floor-only board would miss. On the sealed snapshot
(758 protocols, 14 November 2026) that is **198 ranked rows, $4.28B of total implied
value**, led by Steakhouse Financial at $608.8M. Live-token protocols are kept apart
and shown with the market's own value, never mixed into the ranked board.

Every row carries a six-step farm plan derived from the protocol's own category,
chains, TVL and age — never a hand-written list of names. Implied value is this
entry's own claim, never a promise that a token launches or what it will be worth.

## Run it

Node 22, standard library only — nothing is installed.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

`main.ts` reads `/input/snapshot.json` (or `--input <file|dir>`), writes the ranked
board to `/output/board.json`, the dashboard's dataset to `/output/data.js`, copies
`dashboard/` and `screenshots/` to `/output`, and writes `/output/dossier.json` with
the vendored make.fun library. Run it twice and the outputs are byte-identical: the
program is a pure function of the snapshot.

To look at the dashboard, serve any output directory and open `dashboard/index.html`.
`?shot=detail&slug=<slug>` opens one protocol's detail drawer;
`?shot=filtered&category=<category>` opens a filtered board — the views the three
screenshots were taken from.

## Layout

- `main.ts` — the entry program: snapshot in, board + dashboard + dossier out.
- `lib/model.ts` — radar-2: the strict-rankability rule, the implied-value model,
  the farm-plan derivation, the board's self-check and the dashboard dataset.
- `dashboard/` — the static page: `index.html`, `app.css`, `app.js` (33.5 KB total,
  so the dossier shows every line whole).
- `screenshots/` — three real renders: the board, a protocol's detail view, a
  filtered view (1280×960 each).
- `vendor/makefun-board.ts` — the kit's dossier library, byte for byte.
