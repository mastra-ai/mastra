import { useThemeFlows } from './hooks/use-theme-flows';
import { snapshotSummaryLabel } from './sankey-signals-data';
import { SignalLifelines } from './signal-lifelines';
import { SignalsFrameLoadingSkeleton } from './signals-loading-skeleton';
import { TimelineTrack } from './snapshot-timeline';
import type { TimelineMarkerKind } from './snapshot-timeline';
import { timelineTickPositions } from './snapshot-timeline-data';
import type { ThemeSelection } from './theme-drilldown-data';
import type { ThemeSnapshot, TraceSignalName } from './types';

/**
 * Lifelines mode: every theme holds a fixed row while landmarks run left to
 * right on the shared time axis, so persistent themes read as spines and
 * transient ones as short-lived segments — change over time without replay.
 */
export function ThemeLifelines({
  entityId,
  entityType,
  signalNames,
  snapshots,
  totalSnapshots,
  selectedIndex,
  onSnapshotSelect,
  onThemeSelect,
}: {
  entityId: string;
  entityType: string;
  signalNames: TraceSignalName[];
  snapshots: ThemeSnapshot[];
  totalSnapshots: number;
  selectedIndex: number;
  onSnapshotSelect: (index: number) => void;
  onThemeSelect: (selection: ThemeSelection, snapshotIndex: number) => void;
}) {
  const flowQueries = useThemeFlows(
    entityId,
    entityType,
    signalNames,
    snapshots.map(snapshot => snapshot.snapshotId),
  );
  const flows = flowQueries.map(query => query.data);
  const positions = timelineTickPositions(snapshots);

  if (!flows.some(flow => flow !== undefined)) {
    return (
      <section aria-label="Theme lifelines">
        <SignalsFrameLoadingSkeleton />
      </section>
    );
  }

  return (
    <section aria-label="Theme lifelines" className="space-y-5">
      {/* Spacers mirror each row's label and count columns so the shared track aligns with the rows. */}
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="w-52 shrink-0" />
        <TimelineTrack
          snapshots={snapshots}
          totalCount={totalSnapshots}
          markers={new Map<number, TimelineMarkerKind>([[selectedIndex, 'selected']])}
          onTickSelect={onSnapshotSelect}
        />
        <span aria-hidden="true" className="w-9 shrink-0" />
      </div>
      {snapshots[selectedIndex] ? (
        <p className="text-neutral4 font-mono text-xs" data-testid="snapshot-summary">
          {snapshotSummaryLabel(snapshots[selectedIndex], flows[selectedIndex])}
        </p>
      ) : null}
      {signalNames.map(signalName => (
        <SignalLifelines
          key={signalName}
          signalName={signalName}
          flows={flows}
          snapshots={snapshots}
          positions={positions}
          onThemeSelect={onThemeSelect}
        />
      ))}
    </section>
  );
}
