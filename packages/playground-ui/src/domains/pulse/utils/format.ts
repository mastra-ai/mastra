/** Duration column/label formatting. `null` means the flow/span never produced a
 *  terminal pulse (running or stale) — shown as an em dash. */
export function formatFlowDuration(durationMs: number | null | undefined): string {
  if (durationMs === null || durationMs === undefined) return '—';
  if (durationMs < 1_000) return `${Math.round(durationMs)}ms`;
  if (durationMs < 60_000) return `${(durationMs / 1_000).toFixed(2)}s`;
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1_000);
  return `${minutes}m ${seconds}s`;
}

/** Wire dates arrive as ISO strings even though the SDK types say `Date`
 *  (JSON has no Date) — normalize before doing any math or formatting. */
export function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** HH:MM:SS in the local timezone — the flows list and timeline only ever show
 *  same-day activity windows, so the date part stays in the tooltip. */
export function formatClockTime(value: Date | string): string {
  return toDate(value).toLocaleTimeString('en-US', { hour12: false });
}
