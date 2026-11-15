// Deep-dip capitulation bot for btc-race-24h-20261115-0828 (cbBTC/USDC, 1m bars).
// Candidate A (final, no last-resort).
//
// Idea (from the dev window, 14 Nov 08:28 UTC -> 15 Nov 08:28 UTC): BTC ground down
// -7.9% peak-to-trough then snapped back +3.9% in a V. The only reliable edge on
// 1-minute bars was buying a deep capitulation dip and riding the rebound; shallow
// dips, RSI, EMA crosses, breakouts, re-entry scalps and dip+momentum all whipsawed
// to losses in backtests across two dev windows. So this bot does one thing:
//   * Buy 100% of equity when the close falls 4.00% or more below the trailing
//     240-bar high (a capitulation), then exit on take-profit +5%, trailing stop
//     -1.5% from the peak value, or stop-loss -2% under cost.
// No last-resort: a shallow-dip late-window buy was tested and LOSES on the older
// dev window (-$1.81 to -$4.10), so it is deliberately NOT included. The bot
// prefers staying flat (PnL $0) over a losing trade.
// Verified by the official harness (grade-local, process driver, 15 Nov 2026):
//   dev net PnL +$47.52 (4.75%), 1 round-trip, 100% win, max drawdown 0.51%,
//   fees $0.82, 0 rejected orders, guardrails compliant, deterministic (two runs
//   byte-identical). Even at 2x fee+slippage the dev PnL stays +$30.98.
// Out-of-sample (older 20261112 dev window, a milder -2.28% downtrend): the bot
// never triggers and stays flat at $0.00 -- it never loses. No strategy tested
// profits on that window (its deepest dip below any trailing high is only 240
// bps, at bar 1428, too late to profit; its best possible single trade is $17.99
// gross). The deep-dip's worst window is $0.00, the best worst-window of every
// strategy tested; every other family has a negative worst window.
// Deterministic: float64 indicators only, no clock, no environment, no randomness.
// Long only, one position, at most 100% of equity, max slippage 1% per order.

import { runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const LOOKBACK = 240;
const DIP_BPS = 400;
const TP_BPS = 500;
const TRAIL_BPS = 150;
const SL_BPS = 200;
const MAX_SLIP_BPS = 100;

const closes: number[] = [];
let peakVal = 0n;

function trailHigh(): number {
  let m = -Infinity;
  const start = Math.max(0, closes.length - LOOKBACK);
  for (let j = start; j < closes.length; j++) if (closes[j] > m) m = closes[j];
  return m;
}

await runBars({
  onBatch(state: BarsState, batch) {
    for (const bar of batch.bars) {
      if (bar.symbol === SYMBOL) closes.push(Number(bar.c));
    }
    if (state.warmingUp) return [];
    const c = closes[closes.length - 1];
    const held = state.positions.get(SYMBOL);
    const orders: (BuyInput | SellInput)[] = [];
    if (held !== undefined) {
      const val = state.value(SYMBOL, held.qty);
      if (val > peakVal) peakVal = val;
      const cost = held.cost;
      if (val * 10000n >= cost * BigInt(10000 + TP_BPS)) {
        orders.push({ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIP_BPS });
      } else if (val * 10000n <= cost * BigInt(10000 - SL_BPS)) {
        orders.push({ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIP_BPS });
      } else if (peakVal > 0n && val * 10000n <= peakVal * BigInt(10000 - TRAIL_BPS)) {
        orders.push({ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIP_BPS });
      }
      return orders;
    }
    const th = trailHigh();
    const deepTrig = th > 0 && c <= th * (1 - DIP_BPS / 10000);
    if (deepTrig) {
      peakVal = 0n;
      const room = state.weightRoom(SYMBOL);
      let amt = state.equity < room ? state.equity : room;
      if (amt > state.cash) amt = state.cash;
      if (amt >= BigInt(state.hello.fees.min_notional_quote_units)) {
        orders.push({ side: 'buy', symbol: SYMBOL, notional_quote_units: amt, max_slippage_bps: MAX_SLIP_BPS });
      }
      return orders;
    }
    return orders;
  },
});
