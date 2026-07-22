import type { TraceSignalName } from './types';

export function formatSignalName(signalName: TraceSignalName) {
  return signalName.charAt(0).toUpperCase() + signalName.slice(1);
}

export function traceLabel(count: number) {
  return `${count} ${count === 1 ? 'trace' : 'traces'}`;
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
