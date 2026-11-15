# btc-race-24h entry

[![make.fun · btc-race-24h-20261115-0828](https://make.fun/badge/btc-race-24h-20261115-0828.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)
[![rank](https://make.fun/badge/btc-race-24h-20261115-0828/dillahhhh/btc-race-24h-entry/rank.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)
[![reward](https://make.fun/badge/btc-race-24h-20261115-0828/dillahhhh/btc-race-24h-entry/reward.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)

Deep-dip capitulation bot for the [make.fun "BTC race 24h" bounty](https://make.fun/bounty/btc-race-24h-20261115-0828) ($250 in USDC). Trades Coinbase Wrapped BTC (cbBTC) vs USDC, minute by minute, on a replay of on-chain Orca Whirlpool prices. Long only, one position, at most 100% of equity, $1,000 paper money.

Strategy: buy 100% of equity when the close falls 4.00% or more below the trailing 240-bar high (a capitulation), then exit on take-profit +5%, trailing stop -1.5% from the peak value, or stop-loss -2% under cost. There is no last-resort trade: a shallow-dip late-window buy was tested and loses on the older dev window, so the bot deliberately stays flat (PnL $0) in a mild window rather than taking a losing trade.

Verified by the official harness (grade-local, process driver, 15 Nov 2026): dev net PnL +$47.52 (4.75%), 2 trades, 100% win, max drawdown 0.53%, fees $0.82, 0 rejected orders, guardrails compliant, deterministic (two runs byte-identical). Even at 2x fees the dev PnL stays +$46.69.

Run: the venue runs `main.ts` (Node 22, erasable TypeScript) against the bars-replay protocol; `vendor/makefun-bars.ts` is the kit's SDK shim, copied byte-identical.
