const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatStatusDuration(ms: number, opts: { includeSeconds?: boolean } = {}): string {
  const safeMs = Math.max(0, ms);
  const days = Math.floor(safeMs / DAY_MS);
  const hours = Math.floor((safeMs % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((safeMs % HOUR_MS) / MINUTE_MS);
  const seconds = Math.floor((safeMs % MINUTE_MS) / 1000);

  if (days > 0) {
    return `${days}d${hours > 0 ? `${hours}hr` : ''}${minutes > 0 ? `${minutes}m` : ''}`;
  }
  if (hours > 0) {
    return `${hours}hr${minutes > 0 ? `${minutes}m` : ''}`;
  }
  if (opts.includeSeconds) {
    return minutes > 0 ? `${minutes}m${seconds}s` : `${Math.max(1, seconds)}s`;
  }
  return `${Math.max(1, minutes)}m`;
}
