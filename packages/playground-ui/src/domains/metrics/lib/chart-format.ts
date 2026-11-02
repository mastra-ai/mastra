/** Number formats shared by the Metrics and Requests charts, cards and tooltips. */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Counts: 812, 1.25K, 34.5K, 1.2M, 13.0B. */
export function formatCount(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}K`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return String(Math.round(value));
}

/** Durations: 84ms, 1.25s, 12.4s, 4.5m, 3.6h. */
export function formatDuration(ms: number) {
  if (ms >= HOUR) return `${(ms / HOUR).toFixed(1)}h`;
  if (ms >= MINUTE) return `${(ms / MINUTE).toFixed(1)}m`;
  if (ms >= 10_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

/** A ratio (0-1) as a percent: 0%, <0.1%, 2.35%, 14.2%. */
export function formatPercent(ratio: number) {
  const pct = ratio * 100;
  if (pct === 0) return '0%';
  if (pct < 0.1) return '<0.1%';
  return `${pct < 10 ? pct.toFixed(2) : pct.toFixed(1)}%`;
}

/** Dollars: $0.00, <$0.01, $12.34. */
export function formatUsd(value: number) {
  if (value > 0 && value < 0.01) return '<$0.01';
  return `$${value.toFixed(2)}`;
}

/** Compact y-axis ticks: 600, 4.5K, 1.2M, 13B. */
export function formatAxisCount(value: number) {
  if (value >= 1_000_000_000) return `${+(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${+(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${+(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

/** Compact y-axis ticks for dollars, without trailing zeros: $0, $0.25, $2.5, $5, $1.5K. */
export function formatAxisUsd(value: number) {
  // toPrecision drops float noise (0.30000000000000004) without rounding a tick like 0.25.
  return `$${value >= 1_000 ? formatAxisCount(value) : +value.toPrecision(12)}`;
}

/** Compact y-axis ticks for durations: 250ms, 1.5s, 4.5m, 3h. */
export function formatAxisDuration(ms: number) {
  if (ms >= HOUR) return `${+(ms / HOUR).toFixed(1)}h`;
  if (ms >= MINUTE) return `${+(ms / MINUTE).toFixed(1)}m`;
  if (ms >= 1000) return `${+(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

/** Change from the previous period in percent; undefined when there is nothing to compare. */
export function percentChange(current: number, previous: number | undefined) {
  if (previous === undefined || previous === 0 || !Number.isFinite(previous)) return undefined;
  return ((current - previous) / previous) * 100;
}
