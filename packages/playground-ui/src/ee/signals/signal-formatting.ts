import type { BuiltInTraceSignalName, SignalCatalogEntry, TraceSignalName } from '@mastra/client-js';

/** Catalog used with older servers that do not return signal metadata. */
export const BUILT_IN_SIGNAL_CATALOG: SignalCatalogEntry[] = [
  {
    name: 'goal',
    label: 'Goal',
    description: 'What the user wanted from the interaction.',
    order: 0,
    builtIn: true,
    enabled: true,
    status: 'ready',
  },
  {
    name: 'sentiment',
    label: 'Sentiment',
    description: 'The tone the user expressed during the interaction.',
    order: 1,
    builtIn: true,
    enabled: true,
    status: 'ready',
  },
  {
    name: 'behavior',
    label: 'Behavior',
    description: 'What the agent did in response.',
    order: 2,
    builtIn: true,
    enabled: true,
    status: 'ready',
  },
  {
    name: 'outcome',
    label: 'Outcome',
    description: 'How the interaction ended.',
    order: 3,
    builtIn: true,
    enabled: true,
    status: 'ready',
  },
];

/** Legacy built-in order retained for consumers using the existing export. */
export const SIGNAL_PROCESSING_ORDER: BuiltInTraceSignalName[] = BUILT_IN_SIGNAL_CATALOG.map(
  signal => signal.name as BuiltInTraceSignalName,
);

export function formatSignalName(signalName: TraceSignalName) {
  return signalName.charAt(0).toUpperCase() + signalName.slice(1);
}

/** Plain-language meaning of each built-in trace signal. */
export const SIGNAL_DESCRIPTIONS: Record<BuiltInTraceSignalName, string> = Object.fromEntries(
  BUILT_IN_SIGNAL_CATALOG.map(signal => [signal.name, signal.description]),
) as Record<BuiltInTraceSignalName, string>;

function isBuiltInTraceSignalName(value: string): value is BuiltInTraceSignalName {
  return Object.prototype.hasOwnProperty.call(SIGNAL_DESCRIPTIONS, value);
}

/** Signal description lookup for callers that only hold an untyped column id. */
export function getSignalDescription(signalName: string): string | undefined {
  return isBuiltInTraceSignalName(signalName) ? SIGNAL_DESCRIPTIONS[signalName] : undefined;
}

/** Orders available names by catalog position without dropping uncatalogued historical data. */
export function orderedSignals(catalog: readonly SignalCatalogEntry[], signalNames?: readonly string[]): string[] {
  const names = [...new Set(signalNames ?? catalog.map(signal => signal.name))];
  const positions = new Map(catalog.map(signal => [signal.name, signal.order]));
  return names.sort((left, right) => {
    const leftOrder = positions.get(left);
    const rightOrder = positions.get(right);
    if (leftOrder === undefined && rightOrder === undefined) return 0;
    if (leftOrder === undefined) return 1;
    if (rightOrder === undefined) return -1;
    return leftOrder - rightOrder;
  });
}

/** Returns the server label or derives one from an uncatalogued slug. */
export function signalLabel(catalog: readonly SignalCatalogEntry[], signalName: string): string {
  return catalog.find(signal => signal.name === signalName)?.label ?? labelFromSignalName(signalName);
}

/** Returns the server description for a signal when one is available. */
export function signalDescription(catalog: readonly SignalCatalogEntry[], signalName: string): string | undefined {
  return catalog.find(signal => signal.name === signalName)?.description || undefined;
}

function labelFromSignalName(signalName: string): string {
  return signalName
    .split(/[-_]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function traceLabel(count: number) {
  return `${count} ${count === 1 ? 'trace' : 'traces'}`;
}

export function themeLabel(count: number) {
  return `${count} ${count === 1 ? 'theme' : 'themes'}`;
}

/** "28 of 70 traces in this snapshot (40%)" — replaces the old "Stage share" stat. */
export function shareSentence(traceCount: number, coverage: number) {
  if (coverage <= 0) return `${traceLabel(traceCount)} in this snapshot`;
  const stageTotal = Math.round(traceCount / coverage);
  return `${traceCount} of ${stageTotal} traces in this snapshot (${Math.round(coverage * 100)}%)`;
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

const SNAPSHOT_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatSnapshotDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return SNAPSHOT_DATE_FORMAT.format(date);
}

export function formatSnapshotCutoff(cutoffAt: string) {
  const date = new Date(cutoffAt);
  // Fall back to the raw server value instead of letting Intl throw on Invalid Date.
  if (Number.isNaN(date.getTime())) return cutoffAt;
  return SNAPSHOT_CUTOFF_FORMAT.format(date);
}

export function formatSnapshotWindow(startedAt: string, endedAt: string) {
  const start = new Date(startedAt);
  const end = new Date(endedAt);
  // Fall back to the raw server values instead of letting Intl throw on Invalid Date.
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return `${startedAt}–${endedAt}`;
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
