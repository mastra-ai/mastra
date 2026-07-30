import { Button } from '@mastra/playground-ui/components/Button';
import { Pause, Play } from 'lucide-react';

import { formatSnapshotCutoff, formatSnapshotWindow, traceLabel } from './signal-formatting';
import { snapshotTickLabel, timelineTickPositions } from './snapshot-timeline-data';
import type { ThemeSnapshot } from './types';

export type TimelineMarkerKind = 'selected' | 'compare-a' | 'compare-b';

const MARKER_TICK_CLASSES: Record<TimelineMarkerKind, string> = {
  selected: 'bg-accent1 border-accent1',
  'compare-a': 'bg-amber-400 border-amber-400',
  'compare-b': 'bg-blue-400 border-blue-400',
};

const MARKER_BADGES: Partial<Record<TimelineMarkerKind, string>> = {
  'compare-a': 'A',
  'compare-b': 'B',
};

/**
 * Time-axis landmark track shared by the flow timeline and compare mode. Each
 * landmark renders as a tick placed proportionally to when its snapshot became
 * the current state, so bursty capture times and quiet gaps stay legible.
 */
export function TimelineTrack({
  snapshots,
  totalCount,
  markers,
  onTickSelect,
}: {
  snapshots: ThemeSnapshot[];
  totalCount: number;
  markers: ReadonlyMap<number, TimelineMarkerKind>;
  onTickSelect: (index: number) => void;
}) {
  const positions = timelineTickPositions(snapshots);

  return (
    <div aria-label="Snapshot landmarks" className="relative mx-2 h-8 min-w-40 flex-1" role="group">
      <div aria-hidden="true" className="bg-border1 absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full" />
      {snapshots.map((snapshot, index) => {
        const marker = markers.get(index);
        const badge = marker ? MARKER_BADGES[marker] : undefined;
        return (
          <button
            key={snapshot.snapshotId}
            aria-current={marker === 'selected' ? 'true' : undefined}
            aria-label={snapshotTickLabel(snapshot, totalCount)}
            className={`absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors ${
              marker ? MARKER_TICK_CLASSES[marker] : 'bg-surface4 border-surface2 hover:bg-accent1/60'
            }`}
            data-marker={marker}
            onClick={() => onTickSelect(index)}
            style={{ left: `${positions[index]}%` }}
            type="button"
          >
            {badge ? (
              <span
                aria-hidden="true"
                className="text-neutral6 absolute -top-4 left-1/2 -translate-x-1/2 font-mono text-[10px] font-bold"
              >
                {badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function SnapshotTimeline({
  snapshots,
  selectedIndex,
  totalSnapshots,
  isPlaying,
  onPlayingChange,
  onSnapshotChange,
}: {
  snapshots: ThemeSnapshot[];
  selectedIndex: number;
  totalSnapshots?: number;
  isPlaying: boolean;
  onPlayingChange: (isPlaying: boolean) => void;
  onSnapshotChange: (index: number) => void;
}) {
  const snapshot = snapshots[selectedIndex];

  if (!snapshot) return null;

  const totalCount = totalSnapshots ?? snapshot.total;
  const statusParts = [
    `Snapshot ${snapshot.ordinal}/${totalCount}`,
    ...(snapshot.cutoffAt
      ? [
          `as of ${formatSnapshotCutoff(snapshot.cutoffAt)}`,
          `window ${formatSnapshotWindow(snapshot.startedAt, snapshot.endedAt)}`,
        ]
      : [formatSnapshotWindow(snapshot.startedAt, snapshot.endedAt)]),
    traceLabel(snapshot.traceCount),
  ];

  return (
    <section
      aria-label="Snapshot timeline"
      className="border-border1 bg-surface2 flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 sm:px-4"
    >
      {snapshots.length > 1 ? (
        <>
          <Button
            aria-label={isPlaying ? 'Pause snapshots' : 'Play snapshots'}
            onClick={() => onPlayingChange(!isPlaying)}
            size="sm"
            type="button"
            variant="outline"
          >
            {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <TimelineTrack
            snapshots={snapshots}
            totalCount={totalCount}
            markers={new Map<number, TimelineMarkerKind>([[selectedIndex, 'selected']])}
            onTickSelect={onSnapshotChange}
          />
        </>
      ) : null}
      <p
        aria-live="polite"
        className="text-neutral4 w-full text-left font-mono text-xs tabular-nums md:ml-auto md:w-auto md:min-w-72 md:text-right"
      >
        {statusParts.join(' · ')}
      </p>
    </section>
  );
}
