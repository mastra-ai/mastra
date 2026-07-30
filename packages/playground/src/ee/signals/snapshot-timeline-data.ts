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
