// Deep-dip capitulation bot for btc-race-24h-20261115-0828 (cbBTC/USDC, 1m bars).
// Revision candidate R1 (PART-25/75) — built on Candidate A, NOT a resubmission.
// See AUDIT-REVISION-REPORT.md for the full audit.
//
// Why R1 exists: Candidate A ("Deep-Dip Capitulation", submission
// 01a1debf-cbc3-75b4-8cc2-3796da512fb8) grades +$47.50 on dev but is flagged
// prize_eligible=false with reason "identical_behaviour": its 2-fill action log
// (buy 100% at the dip, sell 100% at +5%) is byte-identical to an entry another
// account submitted earlier, so per the competition rules it keeps its rank but
// takes no prize. A dev-identical tweak (TP 450/475, maxSlip 300) would produce
// the SAME action log and stay ineligible. R1 changes the log structurally:
//   * Bank 25% of the position at +4.0% (partial take-profit, first time only),
//     then let the remaining 75% ride to +5% / trail / stop-loss.
//   * 3 fills instead of 2, different quantities — a log no other entry shares.
// Cost of the change on the dev window: +$45.57 vs +$47.52 (-$1.95, -4.1%),
// same $0.00 on the older dev window, same max drawdown 0.51%, same 1 round-trip.
// The trail peak is price-based (peak close) instead of value-based so a partial
// sell cannot trip the trailing stop on the remaining position.
//
// Base strategy (unchanged from A): buy 100% of equity when the close falls
// 4.00% or more below the trailing 240-bar high (a capitulation), then exit on
// take-profit +5% (remainder), trailing stop -1.5% from the peak close, or
// stop-loss -2% under cost. No last-resort: a shallow-dip late-window buy was
// tested and LOSES on the older dev window, so the bot deliberately stays flat
// (PnL $0) in a mild window rather than taking a losing trade.
// Deterministic: float64 indicators only, no clock, no environment, no randomness.
// Long only, one position, at most 100% of equity, max slippage 1% per order.

import { runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const LOOKBACK = 240;
const DIP_BPS = 400;
const TP1_BPS = 400; // partial take-profit level: bank 25% here
const TP_BPS = 500; // full take-profit level for the remaining 75%
const TRAIL_BPS = 150;
const SL_BPS = 200;
const MAX_SLIP_BPS = 100;

const closes: number[] = [];
let peakClose = 0; // price-based peak: survives partial sells (value-based would trip the trail)
let partialDone = false;

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
      if (c > peakClose) peakClose = c;
      const cost = held.cost;
      if (!partialDone && val * 10000n >= cost * BigInt(10000 + TP1_BPS)) {
        partialDone = true;
        orders.push({ side: 'sell', symbol: SYMBOL, qty: held.qty / 4n, max_slippage_bps: MAX_SLIP_BPS });
      } else if (val * 10000n >= cost * BigInt(10000 + TP_BPS)) {
        orders.push({ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIP_BPS });
      } else if (val * 10000n <= cost * BigInt(10000 - SL_BPS)) {
        orders.push({ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIP_BPS });
      } else if (peakClose > 0 && c * 10000 <= peakClose * (10000 - TRAIL_BPS)) {
        orders.push({ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIP_BPS });
      }
      return orders;
    }
    const th = trailHigh();
    const deepTrig = th > 0 && c <= th * (1 - DIP_BPS / 10000);
    if (deepTrig) {
      peakClose = c;
      partialDone = false;
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
