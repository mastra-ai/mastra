import { useMemo, useState } from 'react';

const DAY_MS = 86_400_000;

export const DEFAULT_RANGE_DAYS = 30;

export function shiftUtcDay(day: string, offset: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + offset * DAY_MS).toISOString().slice(0, 10);
}

/** Today is read once, so a window only moves when the caller asks for a different span. */
export function useMetricsWindow(days: number): { from: string; to: string } {
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  return useMemo(() => ({ from: shiftUtcDay(today, -(days - 1)), to: today }), [today, days]);
}

/** A rate that rounds to zero denies the very cards the value above it counts. */
export function perDayDetail(count: number, daysCovered: number): string | undefined {
  const rate = daysCovered === 0 ? 0 : count / daysCovered;
  if (rate < 0.1) return undefined;
  return `${rate.toLocaleString(undefined, { maximumFractionDigits: 1 })} / day`;
}
