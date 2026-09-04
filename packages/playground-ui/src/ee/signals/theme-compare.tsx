import { useState } from 'react';

import { useThemeFlows } from './hooks/use-theme-flows';
import { snapshotSummaryLabel } from './sankey-signals-data';
import { SignalDeltaColumn } from './signal-delta-column';
import { SignalsFrameLoadingSkeleton } from './signals-loading-skeleton';
import { TimelineTrack } from './snapshot-timeline';
import type { TimelineMarkerKind } from './snapshot-timeline';
import { timelineTickPositions } from './snapshot-timeline-data';
import type { ThemeSelection } from './theme-drilldown-data';
import type { ThemeSnapshot, TraceSignalName } from './types';

/**
 * Compare mode: two interchangeable points on the shared time axis show how
 * each signal's theme mix moved between them (always read earlier → later),
 * with per-theme sparklines across every landmark in range. Clicking an
 * unmarked landmark moves the nearest point; clicking a marked landmark grabs
 * that point so the next click moves it specifically.
 */
export function ThemeCompare({
  entityId,
  entityType,
  signalNames,
  snapshots,
  totalSnapshots,
  onThemeSelect,
}: {
  entityId: string;
  entityType: string;
  signalNames: TraceSignalName[];
  snapshots: ThemeSnapshot[];
  totalSnapshots: number;
  onThemeSelect: (selection: ThemeSelection, snapshotIndex: number) => void;
}) {
  const [pointIndexes, setPointIndexes] = useState<[number, number]>();
  const [grabbedPoint, setGrabbedPoint] = useState<0 | 1>();
  const lastIndex = snapshots.length - 1;
  const points: [number, number] = [
    Math.min(pointIndexes?.[0] ?? 0, lastIndex),
    Math.min(pointIndexes?.[1] ?? lastIndex, lastIndex),
  ];
  // Compare always reads earlier → later regardless of which point moved last.
  const fromIndex = Math.min(points[0], points[1]);
  const toIndex = Math.max(points[0], points[1]);
  const flowQueries = useThemeFlows(
    entityId,
    entityType,
    signalNames,
    snapshots.map(snapshot => snapshot.snapshotId),
  );
  const flows = flowQueries.map(query => query.data);
  const fromFlow = flows[fromIndex];
  const toFlow = flows[toIndex];
  const positions = timelineTickPositions(snapshots);
  const fromSnapshot = snapshots[fromIndex];
  const toSnapshot = snapshots[toIndex];

  if (!fromSnapshot || !toSnapshot) return null;

  // The two points are interchangeable: an unmarked tick moves whichever
  // point is nearest on the track; a marked tick grabs that point so the next
  // click moves it specifically (covers moving a point past the other).
  const handleTickSelect = (index: number) => {
    if (grabbedPoint !== undefined) {
      setPointIndexes(grabbedPoint === 0 ? [index, points[1]] : [points[0], index]);
      setGrabbedPoint(undefined);
      return;
    }
    const pointAtIndex = points[0] === index ? 0 : points[1] === index ? 1 : undefined;
    if (pointAtIndex !== undefined) {
      setGrabbedPoint(pointAtIndex);
      return;
    }
    const selectedPosition = positions[index];
    const firstPointPosition = positions[points[0]];
    const secondPointPosition = positions[points[1]];
    if (selectedPosition === undefined || firstPointPosition === undefined || secondPointPosition === undefined) return;

    const distanceToFirst = Math.abs(selectedPosition - firstPointPosition);
    const distanceToSecond = Math.abs(selectedPosition - secondPointPosition);
    setPointIndexes(distanceToFirst <= distanceToSecond ? [index, points[1]] : [points[0], index]);
  };

  const markers = new Map<number, TimelineMarkerKind>([
    [points[0], 'compare-point'],
    [points[1], 'compare-point'],
  ]);
  const grabbedIndex = grabbedPoint === undefined ? undefined : points[grabbedPoint];

  return (
    <section aria-label="Snapshot comparison" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 sm:px-4">
        <TimelineTrack
          snapshots={snapshots}
          totalCount={totalSnapshots}
          markers={markers}
          grabbedIndex={grabbedIndex}
          onTickSelect={handleTickSelect}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="border-border1 text-neutral4 rounded-md border px-2 py-1 font-mono text-xs tabular-nums">
          {snapshotSummaryLabel(fromSnapshot, flows[fromIndex])}
        </p>
        <span aria-hidden="true" className="text-neutral3 text-xs">
          →
        </span>
        <p className="border-border1 text-neutral4 rounded-md border px-2 py-1 font-mono text-xs tabular-nums">
          {snapshotSummaryLabel(toSnapshot, flows[toIndex])}
        </p>
        <p className="text-neutral3 text-xs">
          {grabbedPoint === undefined
            ? 'Click a landmark to move the nearest point · click a point to grab it.'
            : 'Point grabbed — click a landmark to place it.'}
        </p>
      </div>
      {fromIndex === toIndex ? (
        <p className="border-border1 bg-surface2 text-neutral3 rounded-lg border p-6 text-sm">
          Pick two different landmarks on the timeline to compare them.
        </p>
      ) : !fromFlow || !toFlow ? (
        <SignalsFrameLoadingSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {signalNames.map(signalName => (
            <SignalDeltaColumn
              key={signalName}
              signalName={signalName}
              fromFlow={fromFlow}
              toFlow={toFlow}
              flows={flows}
              positions={positions}
              fromIndex={fromIndex}
              toIndex={toIndex}
              onThemeSelect={onThemeSelect}
            />
          ))}
        </div>
      )}
    </section>
  );
}
