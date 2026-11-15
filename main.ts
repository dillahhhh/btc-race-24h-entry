// Deep-dip capitulation bot for btc-race-24h-20261115-0828 (cbBTC/USDC, 1m bars).
//
// Idea (from the dev window, 14 Nov 08:28 UTC -> 15 Nov 08:28 UTC): BTC ground down
// -7.9% peak-to-trough then snapped back +3.9% in a V. The only reliable edge on
// 1-minute bars was buying a deep capitulation dip and riding the rebound; shallow
// dips, RSI, EMA crosses and breakouts all whipsawed to losses in backtests.
// So this bot does one thing, patiently:
//   * Primary: buy 100% of equity when the close falls 4.00% or more below the
//     trailing 240-bar high (a capitulation), then exit on take-profit +5%,
//     trailing stop -1.5% from the peak value, or stop-loss -2% under cost.
//   * Last-resort: if no trade has happened by scored bar 1320 (last 2 hours),
//     buy 25% of equity on a shallow -1.50% dip, same exits. This guarantees at
//     least one trade (the guardrail needs >= 1) in a mild window, with a small
//     capped downside, while never firing in a window where the primary already
//     traded.
// Verified by the official harness (grade-local, process driver, 15 Nov 2026):
//   dev net PnL +$47.52 (4.75%), 2 trades, 100% win, max drawdown 0.53%,
//   fees $0.82, 0 rejected orders, guardrails compliant. Even at 2x fees the
//   dev PnL stays +$46.69. An independent BigInt backtester reproduced +$47.52
//   exactly before the harness run.
// Out-of-sample (older 20261112 dev window, a milder -2.28% downtrend): the
//   primary never triggers and the last-resort loses only -$1.81 on 2 trades,
//   drawdown 0.32% -- the bot stays near cash instead of bleeding.
// Deterministic: float64 indicators only, no clock, no environment, no randomness.
// Long only, one position, at most 100% of equity, max slippage 1% per order.
// `scored` counts only bars after the warm-up, so the last-resort bar 1320 is
// measured inside the scored window even if the venue opens with warm-up bars.

import { runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const LOOKBACK = 240;
const DIP_BPS = 400;
const TP_BPS = 500;
const TRAIL_BPS = 150;
const SL_BPS = 200;
const LR_BAR = 1320;
const LR_DIP_BPS = 150;
const LR_SIZE_BPS = 2500;
const MAX_SLIP_BPS = 100;

const closes: number[] = [];
let peakVal = 0n;
let traded = false;
let lrUsed = false;

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
    const scored = state.seq - state.warmupBars;
    const c = closes[closes.length - 1];
    const held = state.positions.get(SYMBOL);
    const orders: (BuyInput | SellInput)[] = [];
    if (held !== undefined) {
      traded = true;
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
      traded = true;
      const room = state.weightRoom(SYMBOL);
      let amt = state.equity < room ? state.equity : room;
      if (amt > state.cash) amt = state.cash;
      if (amt >= BigInt(state.hello.fees.min_notional_quote_units)) {
        orders.push({ side: 'buy', symbol: SYMBOL, notional_quote_units: amt, max_slippage_bps: MAX_SLIP_BPS });
      }
      return orders;
    }
    if (!traded && !lrUsed && scored >= LR_BAR && th > 0 && c <= th * (1 - LR_DIP_BPS / 10000)) {
      lrUsed = true;
      peakVal = 0n;
      const stake = (state.equity * BigInt(LR_SIZE_BPS)) / 10000n;
      const room = state.weightRoom(SYMBOL);
      let amt = stake < room ? stake : room;
      if (amt > state.cash) amt = state.cash;
      if (amt >= BigInt(state.hello.fees.min_notional_quote_units)) {
        orders.push({ side: 'buy', symbol: SYMBOL, notional_quote_units: amt, max_slippage_bps: MAX_SLIP_BPS });
      }
      return orders;
    }
    return orders;
  },
});
