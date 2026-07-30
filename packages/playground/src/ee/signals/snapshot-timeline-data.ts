import { formatSnapshotCutoff } from './signal-formatting';
import type { ThemeSnapshot } from './types';

/**
 * Positions each landmark on a 0–100% time axis by its cutoff. Falls back to
 * even index spacing when cutoffs are unavailable (older servers).
 */
export function timelineTickPositions(snapshots: ThemeSnapshot[]): number[] {
  const epochs = snapshots.map(snapshot => (snapshot.cutoffAt ? Date.parse(snapshot.cutoffAt) : Number.NaN));
  const first = epochs[0];
  const last = epochs[epochs.length - 1];
  const hasTimeAxis =
    epochs.length > 1 &&
    epochs.every(epoch => Number.isFinite(epoch)) &&
    last !== undefined &&
    first !== undefined &&
    last > first;

  return snapshots.map((_, index) => {
    if (snapshots.length < 2) return 0;
    if (!hasTimeAxis) return (index / (snapshots.length - 1)) * 100;
    return ((epochs[index]! - first!) / (last! - first!)) * 100;
  });
}

export function snapshotTickLabel(snapshot: ThemeSnapshot, totalCount: number) {
  const cutoff = snapshot.cutoffAt ? formatSnapshotCutoff(snapshot.cutoffAt) : undefined;
  return `Snapshot ${snapshot.ordinal} of ${totalCount}${cutoff ? `, ${cutoff}` : ''}`;
}

const DAY_LABEL_FORMAT = new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', timeZone: 'UTC' });

/**
 * Day label ("07/24") for each tick whose cutoff starts a new day compared to
 * the previous tick; undefined otherwise so the axis only marks day starts.
 */
export function timelineDayLabels(snapshots: ThemeSnapshot[]): Array<string | undefined> {
  let previousDay: string | undefined;
  return snapshots.map(snapshot => {
    const epoch = snapshot.cutoffAt ? Date.parse(snapshot.cutoffAt) : Number.NaN;
    if (!Number.isFinite(epoch)) return undefined;
    const day = DAY_LABEL_FORMAT.format(epoch);
    if (day === previousDay) return undefined;
    previousDay = day;
    return day;
  });
}
