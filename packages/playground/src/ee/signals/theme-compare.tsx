import { useState } from 'react';

import { useThemeFlows } from './hooks/use-theme-flows';
import { formatSignalName, formatSnapshotCutoff, formatSnapshotWindow } from './signal-formatting';
import { SignalsFrameLoadingSkeleton } from './signals-loading-skeleton';
import { TimelineTrack } from './snapshot-timeline';
import type { TimelineMarkerKind } from './snapshot-timeline';
import { timelineTickPositions } from './snapshot-timeline-data';
import { computeThemeShareDeltas, themeShareSeries } from './theme-compare-data';
import type { ThemeFlowResponse, ThemeSnapshot, TraceSignalName } from './types';

const SPARKLINE_WIDTH = 100;
const SPARKLINE_HEIGHT = 20;

function percent(share: number) {
  return `${Math.round(share * 100)}%`;
}

function deltaLabel(delta: number) {
  const points = Math.round(delta * 100);
  return `${points >= 0 ? '+' : ''}${points}pp`;
}

function markerSummary(snapshot: ThemeSnapshot) {
  return snapshot.cutoffAt
    ? formatSnapshotCutoff(snapshot.cutoffAt)
    : formatSnapshotWindow(snapshot.startedAt, snapshot.endedAt);
}

function Sparkline({
  series,
  positions,
  aIndex,
  bIndex,
}: {
  series: Array<number | undefined>;
  positions: number[];
  aIndex: number;
  bIndex: number;
}) {
  const loaded = series.flatMap((share, index) => (share === undefined ? [] : [{ share, index }]));
  if (loaded.length < 2) return null;

  const maxShare = Math.max(...loaded.map(point => point.share), 0.01);
  const pointFor = (point: { share: number; index: number }) => ({
    x: (positions[point.index]! / 100) * SPARKLINE_WIDTH,
    y: SPARKLINE_HEIGHT - 2 - (point.share / maxShare) * (SPARKLINE_HEIGHT - 4),
  });
  const polyline = loaded.map(point => `${pointFor(point).x.toFixed(1)},${pointFor(point).y.toFixed(1)}`).join(' ');
  const markers = [
    { point: loaded.find(candidate => candidate.index === aIndex), className: 'bg-amber-400' },
    { point: loaded.find(candidate => candidate.index === bIndex), className: 'bg-blue-400' },
  ];

  // The svg stretches horizontally (preserveAspectRatio none), which would
  // flatten circles — so the A/B dots render as HTML overlays that stay round.
  // The viewBox height matches the h-5 track, so y coordinates are pixels.
  return (
    <div aria-hidden="true" className="relative mt-1.5 h-5 w-full">
      <svg
        className="absolute inset-0 size-full"
        preserveAspectRatio="none"
        viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
      >
        <polyline
          className="stroke-neutral3 fill-none"
          points={polyline}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {markers.map(({ point, className }) =>
        point ? (
          <span
            key={`${point.index}-${className}`}
            className={`absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ${className}`}
            style={{ left: `${positions[point.index]}%`, top: `${pointFor(point).y}px` }}
          />
        ) : null,
      )}
    </div>
  );
}

function SignalDeltaColumn({
  signalName,
  fromFlow,
  toFlow,
  flows,
  positions,
  aIndex,
  bIndex,
}: {
  signalName: TraceSignalName;
  fromFlow: ThemeFlowResponse;
  toFlow: ThemeFlowResponse;
  flows: Array<ThemeFlowResponse | undefined>;
  positions: number[];
  aIndex: number;
  bIndex: number;
}) {
  const deltas = computeThemeShareDeltas(fromFlow, toFlow, signalName);

  return (
    <section aria-label={`${formatSignalName(signalName)} changes`} className="min-w-0">
      <h3 className="text-neutral4 font-mono text-xs font-semibold tracking-widest uppercase">{signalName}</h3>
      <ul className="mt-2 space-y-1.5">
        {deltas.length === 0 ? <li className="text-neutral3 text-xs">No themes in either snapshot.</li> : null}
        {deltas.map(delta => (
          <li
            key={delta.label}
            className={`border-border1 rounded-lg border px-2.5 py-2 ${
              delta.delta > 0 ? 'bg-green-500/5' : delta.delta < 0 ? 'bg-red-500/5' : 'bg-surface3'
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-neutral6 truncate text-xs font-medium" title={delta.label}>
                {delta.label}
              </span>
              <span className="text-neutral6 shrink-0 font-mono text-xs font-semibold tabular-nums">
                {deltaLabel(delta.delta)}
              </span>
            </div>
            <p className="text-neutral3 font-mono text-[11px] tabular-nums">
              {percent(delta.fromShare)} → {percent(delta.toShare)}
            </p>
            <Sparkline
              series={themeShareSeries(flows, signalName, delta.label)}
              positions={positions}
              aIndex={aIndex}
              bIndex={bIndex}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Compare mode: pick two landmarks (A and B) on the shared time axis and see
 * how each signal's theme mix moved between them, with per-theme sparklines
 * across every landmark in range.
 */
export function ThemeCompare({
  entityId,
  entityType,
  signalNames,
  snapshots,
  totalSnapshots,
}: {
  entityId: string;
  entityType: string;
  signalNames: TraceSignalName[];
  snapshots: ThemeSnapshot[];
  totalSnapshots: number;
}) {
  const [compareIndexes, setCompareIndexes] = useState<{ a: number; b: number }>();
  const [armedMarker, setArmedMarker] = useState<'a' | 'b'>('b');
  const aIndex = Math.min(compareIndexes?.a ?? 0, snapshots.length - 1);
  const bIndex = Math.min(compareIndexes?.b ?? snapshots.length - 1, snapshots.length - 1);
  // Compare always reads earlier → later regardless of where A and B sit.
  const fromIndex = Math.min(aIndex, bIndex);
  const toIndex = Math.max(aIndex, bIndex);
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
  const snapshotA = snapshots[aIndex];
  const snapshotB = snapshots[bIndex];

  if (!snapshotA || !snapshotB) return null;

  // A tick click always moves the armed point, so the interaction is
  // predictable — the old "move whichever marker is closer" rule kept
  // grabbing the wrong point.
  const handleTickSelect = (index: number) => {
    setCompareIndexes(armedMarker === 'a' ? { a: index, b: bIndex } : { a: aIndex, b: index });
  };

  const markers = new Map<number, TimelineMarkerKind>([
    [aIndex, 'compare-a'],
    [bIndex, 'compare-b'],
  ]);

  return (
    <section aria-label="Snapshot comparison" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 sm:px-4">
        <TimelineTrack
          snapshots={snapshots}
          totalCount={totalSnapshots}
          markers={markers}
          onTickSelect={handleTickSelect}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <button
          aria-label={`Point A, ${markerSummary(snapshotA)}`}
          aria-pressed={armedMarker === 'a'}
          className={`text-neutral4 flex items-baseline gap-2 rounded-md border px-2 py-1 font-mono text-xs tabular-nums transition-colors ${
            armedMarker === 'a' ? 'border-amber-400/60 bg-amber-400/10' : 'border-border1 hover:border-amber-400/40'
          }`}
          onClick={() => setArmedMarker('a')}
          type="button"
        >
          <span className="font-bold text-amber-400">A</span>
          {markerSummary(snapshotA)}
        </button>
        <button
          aria-label={`Point B, ${markerSummary(snapshotB)}`}
          aria-pressed={armedMarker === 'b'}
          className={`text-neutral4 flex items-baseline gap-2 rounded-md border px-2 py-1 font-mono text-xs tabular-nums transition-colors ${
            armedMarker === 'b' ? 'border-blue-400/60 bg-blue-400/10' : 'border-border1 hover:border-blue-400/40'
          }`}
          onClick={() => setArmedMarker('b')}
          type="button"
        >
          <span className="font-bold text-blue-400">B</span>
          {markerSummary(snapshotB)}
        </button>
        <p className="text-neutral3 text-xs">Clicking the timeline moves point {armedMarker === 'a' ? 'A' : 'B'}.</p>
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
              aIndex={aIndex}
              bIndex={bIndex}
            />
          ))}
        </div>
      )}
    </section>
  );
}
