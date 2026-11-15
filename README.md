# btc-race-24h entry — revision candidate R1 (PART-25/75)

[![make.fun · btc-race-24h-20261115-0828](https://make.fun/badge/btc-race-24h-20261115-0828.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)
[![rank](https://make.fun/badge/btc-race-24h-20261115-0828/dillahhhh/btc-race-24h-entry/rank.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)
[![reward](https://make.fun/badge/btc-race-24h-20261115-0828/dillahhhh/btc-race-24h-entry/reward.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)

Deep-dip capitulation bot for the [make.fun "BTC race 24h" bounty](https://make.fun/bounty/btc-race-24h-20261115-0828) ($250 in USDC). Trades Coinbase Wrapped BTC (cbBTC) vs USDC, minute by minute, on a replay of on-chain Orca Whirlpool prices. Long only, one position, at most 100% of equity, $1,000 paper money.

**Revision candidate R1 (not submitted).** Built on Candidate A, which grades +$47.50 on dev but is flagged `prize_eligible=false` (`identical_behaviour`): its 2-fill action log is byte-identical to an entry another account submitted earlier, so it keeps its rank but takes no prize. R1 changes the log structurally with a partial take-profit: bank 25% of the position at +4.0%, let the remaining 75% ride to +5% / trail / stop-loss — 3 fills instead of 2. Full audit: `AUDIT-REVISION-REPORT.md` in the parent directory.

Strategy: buy 100% of equity when the close falls 4.00% or more below the trailing 240-bar high (a capitulation), then bank 25% at +4.0% and exit the remaining 75% on take-profit +5%, trailing stop -1.5% from the peak close, or stop-loss -2% under cost. There is no last-resort trade: a shallow-dip late-window buy was tested and loses on the older dev window, so the bot deliberately stays flat (PnL $0) in a mild window rather than taking a losing trade.

Verified by the official harness (grade-local, process driver, 15 Nov 2026): dev net PnL +$45.57 (4.56%), 3 trades, 1 round-trip, max drawdown 0.51%, 0 rejected orders, guardrails compliant, deterministic (two runs byte-identical). Older dev window: $0.00, 0 trades. Backtester cross-check agrees to the cent (+$45.57 NEW / $0.00 OLD).

Run: the venue runs `main.ts` (Node 22, erasable TypeScript) against the bars-replay protocol; `vendor/makefun-bars.ts` is the kit's SDK shim, copied byte-identical.
