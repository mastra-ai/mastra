const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const UNITS = [
  { label: 'd', ms: DAY_MS },
  { label: 'h', ms: HOUR_MS },
  { label: 'm', ms: MINUTE_MS },
  { label: 's', ms: SECOND_MS },
] as const;

export type DurationPrecision = 'ms' | 's' | 'm';

/**
 * Formats a duration the same way everywhere in the TUI: the two largest units, space-separated
 * ("2d 3h", "1h 20m", "4m 5s", "12s"), dropping a zero second unit ("1h", not "1h 0m").
 *
 * `precision` is the smallest unit shown: `ms` adds "340ms" and "1.2s" below a minute (for things
 * that finish fast, like tool calls), `m` hides seconds ("<1m" below a minute).
 */
export function formatDuration(ms: number, { precision = 's' }: { precision?: DurationPrecision } = {}): string {
  const safeMs = Math.max(0, ms);
  if (precision === 'ms' && Math.round(safeMs) < SECOND_MS) return `${Math.round(safeMs)}ms`;
  if (precision === 'ms') return formatTenths(safeMs);
  if (precision === 'm' && safeMs < MINUTE_MS) return '<1m';

  const units = precision === 'm' ? UNITS.slice(0, 3) : UNITS;
  const index = units.findIndex(unit => safeMs >= unit.ms);
  if (index === -1) return '0s';

  const largest = units[index]!;
  const parts = [`${Math.floor(safeMs / largest.ms)}${largest.label}`];
  const next = units[index + 1];
  if (next) {
    const value = Math.floor((safeMs % largest.ms) / next.ms);
    if (value > 0) parts.push(`${value}${next.label}`);
  }
  return parts.join(' ');
}

function formatTenths(ms: number): string {
  // Round to tenths first so 59.96s reads "1m", not "60.0s".
  const rounded = Math.round(ms / 100) * 100;
  if (rounded < MINUTE_MS) return `${(rounded / 1000).toFixed(1)}s`;
  return formatDuration(rounded);
}
