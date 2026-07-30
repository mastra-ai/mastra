import { useState } from 'react';

import { useThemeFlows } from './hooks/use-theme-flows';
import { formatSignalName, formatSnapshotCutoff, formatSnapshotWindow, traceLabel } from './signal-formatting';
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

function markerSummary(snapshot: ThemeSnapshot, totalCount: number) {
  const asOf = snapshot.cutoffAt ? formatSnapshotCutoff(snapshot.cutoffAt) : undefined;
  return [
    `snapshot ${snapshot.ordinal} of ${totalCount}`,
    ...(asOf ? [asOf] : []),
    `window ${formatSnapshotWindow(snapshot.startedAt, snapshot.endedAt)}`,
    traceLabel(snapshot.traceCount),
  ].join(' · ');
}

function Sparkline({
  series,
  positions,
  fromIndex,
  toIndex,
}: {
  series: Array<number | undefined>;
  positions: number[];
  fromIndex: number;
  toIndex: number;
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
    { point: loaded.find(candidate => candidate.index === fromIndex), className: 'fill-amber-400' },
    { point: loaded.find(candidate => candidate.index === toIndex), className: 'fill-blue-400' },
  ];

  return (
    <svg
      aria-hidden="true"
      className="mt-1.5 block h-5 w-full"
      preserveAspectRatio="none"
      viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
    >
      <polyline
        className="stroke-neutral3 fill-none"
        points={polyline}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      {markers.map(({ point, className }) =>
        point ? (
          <circle
            key={`${point.index}-${className}`}
            className={className}
            cx={pointFor(point).x}
            cy={pointFor(point).y}
            r="2"
          />
        ) : null,
      )}
    </svg>
  );
}

function SignalDeltaColumn({
  signalName,
  fromFlow,
  toFlow,
  flows,
  positions,
  fromIndex,
  toIndex,
}: {
  signalName: TraceSignalName;
  fromFlow: ThemeFlowResponse;
  toFlow: ThemeFlowResponse;
  flows: Array<ThemeFlowResponse | undefined>;
  positions: number[];
  fromIndex: number;
  toIndex: number;
}) {
  const deltas = computeThemeShareDeltas(fromFlow, toFlow, signalName);

  return (
    <section aria-label={`${formatSignalName(signalName)} changes`} className="min-w-0">
      <h3 className="text-neutral4 font-mono text-xs font-semibold tracking-widest uppercase">{signalName}</h3>
      <ul className="mt-2 space-y-1.5">
        {deltas.length === 0 ? <li className="text-neutral3 text-xs">No themes in either snapshot.</li> : null}
        {deltas.map(delta => (
          <li key={delta.label} className="border-border1 bg-surface3 rounded-lg border px-2.5 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-neutral6 truncate text-xs font-medium" title={delta.label}>
                {delta.label}
                {delta.isNew ? (
                  <span className="ml-1.5 rounded bg-green-500/15 px-1 py-px font-mono text-[9px] font-bold text-green-500">
                    NEW
                  </span>
                ) : null}
                {delta.isGone ? (
                  <span className="ml-1.5 rounded bg-red-500/15 px-1 py-px font-mono text-[9px] font-bold text-red-500">
                    GONE
                  </span>
                ) : null}
              </span>
              <span
                className={`shrink-0 font-mono text-xs font-semibold tabular-nums ${
                  delta.delta >= 0 ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {deltaLabel(delta.delta)}
              </span>
            </div>
            <p className="text-neutral3 font-mono text-[11px] tabular-nums">
              {percent(delta.fromShare)} → {percent(delta.toShare)}
            </p>
            <Sparkline
              series={themeShareSeries(flows, signalName, delta.label)}
              positions={positions}
              fromIndex={fromIndex}
              toIndex={toIndex}
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
  const aIndex = Math.min(compareIndexes?.a ?? 0, snapshots.length - 1);
  const bIndex = Math.min(compareIndexes?.b ?? snapshots.length - 1, snapshots.length - 1);
  const flowQueries = useThemeFlows(
    entityId,
    entityType,
    signalNames,
    snapshots.map(snapshot => snapshot.snapshotId),
  );
  const flows = flowQueries.map(query => query.data);
  const fromFlow = flows[aIndex];
  const toFlow = flows[bIndex];
  const positions = timelineTickPositions(snapshots);
  const snapshotA = snapshots[aIndex];
  const snapshotB = snapshots[bIndex];

  if (!snapshotA || !snapshotB) return null;

  const handleTickSelect = (index: number) => {
    // Move whichever marker is closer, then keep A before B.
    const moveA = Math.abs(index - aIndex) <= Math.abs(index - bIndex);
    const next = moveA ? { a: index, b: bIndex } : { a: aIndex, b: index };
    setCompareIndexes(next.a <= next.b ? next : { a: next.b, b: next.a });
  };

  const markers = new Map<number, TimelineMarkerKind>([
    [aIndex, 'compare-a'],
    [bIndex, 'compare-b'],
  ]);

  return (
    <section aria-label="Snapshot comparison" className="space-y-4">
      <div className="border-border1 bg-surface2 flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 sm:px-4">
        <TimelineTrack
          snapshots={snapshots}
          totalCount={totalSnapshots}
          markers={markers}
          onTickSelect={handleTickSelect}
        />
      </div>
      <dl className="text-neutral4 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs tabular-nums">
        <div className="flex items-baseline gap-2">
          <dt className="font-bold text-amber-400">A</dt>
          <dd>{markerSummary(snapshotA, totalSnapshots)}</dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="font-bold text-blue-400">B</dt>
          <dd>{markerSummary(snapshotB, totalSnapshots)}</dd>
        </div>
      </dl>
      {aIndex === bIndex ? (
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
              fromIndex={aIndex}
              toIndex={bIndex}
            />
          ))}
        </div>
      )}
    </section>
  );
}
