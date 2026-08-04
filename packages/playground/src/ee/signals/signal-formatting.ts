import type { TraceSignalName } from './types';

export function formatSignalName(signalName: TraceSignalName) {
  return signalName.charAt(0).toUpperCase() + signalName.slice(1);
}

export function traceLabel(count: number) {
  return `${count} ${count === 1 ? 'trace' : 'traces'}`;
}

export function themeLabel(count: number) {
  return `${count} ${count === 1 ? 'theme' : 'themes'}`;
}

// Hoisted: TimelineTrack formats every tick on each render.
const SNAPSHOT_CUTOFF_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

export function formatSnapshotCutoff(cutoffAt: string) {
  const date = new Date(cutoffAt);
  // Fall back to the raw server value instead of letting Intl throw on Invalid Date.
  if (Number.isNaN(date.getTime())) return cutoffAt;
  return SNAPSHOT_CUTOFF_FORMAT.format(date);
}

export function formatSnapshotWindow(startedAt: string, endedAt: string) {
  const start = new Date(startedAt);
  const end = new Date(endedAt);
  const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const day = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: 'UTC' });
  const year = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'UTC' });
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  const sameDay = sameMonth && start.getUTCDate() === end.getUTCDate();

  if (sameDay) return `${monthDay.format(start)}, ${year.format(start)}`;
  if (sameMonth) return `${monthDay.format(start)}–${day.format(end)}, ${year.format(end)}`;
  if (sameYear) return `${monthDay.format(start)}–${monthDay.format(end)}, ${year.format(end)}`;
  return `${monthDay.format(start)}, ${year.format(start)}–${monthDay.format(end)}, ${year.format(end)}`;
}
