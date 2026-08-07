import { nodeColor } from '@mastra/playground-ui/components/SankeyChart';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { getSignalHue } from '@mastra/playground-ui/ee/signals';
import { useState } from 'react';

import { useThemeFlows } from './hooks/use-theme-flows';
import { snapshotSummaryLabel } from './sankey-signals-data';
import { formatSignalName, SIGNAL_DESCRIPTIONS } from './signal-formatting';
import { SignalsFrameLoadingSkeleton } from './signals-loading-skeleton';
import { TimelineTrack } from './snapshot-timeline';
import type { TimelineMarkerKind } from './snapshot-timeline';
import { timelineTickPositions } from './snapshot-timeline-data';
import { computeThemeShareDeltas, themeShareSeries } from './theme-compare-data';
import type { ThemeSelection } from './theme-drilldown-data';
import type { ThemeFlowResponse, ThemeSnapshot, TraceSignalName } from './types';

const SPARKLINE_WIDTH = 100;
const SPARKLINE_HEIGHT = 20;

function percent(share: number) {
  return `${Math.round(share * 100)}%`;
}

function deltaLabel(delta: number) {
  const points = Math.round(delta * 100);
  return `${points >= 0 ? '+' : ''}${points}%`;
}

function Sparkline({
  series,
  positions,
  markerIndexes,
}: {
  series: Array<number | undefined>;
  positions: number[];
  markerIndexes: number[];
}) {
  const loaded = series.flatMap((share, index) => (share === undefined ? [] : [{ share, index }]));
  if (loaded.length < 2) return null;

  const maxShare = Math.max(...loaded.map(point => point.share), 0.01);
  const pointFor = (point: { share: number; index: number }) => ({
    x: (positions[point.index]! / 100) * SPARKLINE_WIDTH,
    y: SPARKLINE_HEIGHT - 2 - (point.share / maxShare) * (SPARKLINE_HEIGHT - 4),
  });
  const polyline = loaded.map(point => `${pointFor(point).x.toFixed(1)},${pointFor(point).y.toFixed(1)}`).join(' ');
  const markers = markerIndexes.flatMap(markerIndex => {
    const point = loaded.find(candidate => candidate.index === markerIndex);
    return point ? [point] : [];
  });

  // The svg stretches horizontally (preserveAspectRatio none), which would
  // flatten circles — so the compare dots render as HTML overlays that stay
  // round. The viewBox height matches the h-5 track, so y coordinates are pixels.
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
      {markers.map(point => (
        <span
          key={point.index}
          className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-400"
          style={{ left: `${positions[point.index]}%`, top: `${pointFor(point).y}px` }}
        />
      ))}
    </div>
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
  onThemeSelect,
}: {
  signalName: TraceSignalName;
  fromFlow: ThemeFlowResponse;
  toFlow: ThemeFlowResponse;
  flows: Array<ThemeFlowResponse | undefined>;
  positions: number[];
  fromIndex: number;
  toIndex: number;
  onThemeSelect: (selection: ThemeSelection, snapshotIndex: number) => void;
}) {
  const deltas = computeThemeShareDeltas(fromFlow, toFlow, signalName);
  // Details open at the compared snapshot where the theme still exists.
  const detailIndexFor = (delta: { toShare: number }) => (delta.toShare > 0 ? toIndex : fromIndex);

  return (
    <section aria-label={`${formatSignalName(signalName)} changes`} className="min-w-0">
      <h3
        className="font-mono text-xs font-semibold tracking-widest uppercase"
        style={{ color: nodeColor(getSignalHue(signalName)) }}
      >
        <Tooltip>
          <TooltipTrigger className="cursor-default uppercase">{signalName}</TooltipTrigger>
          <TooltipContent>{SIGNAL_DESCRIPTIONS[signalName]}</TooltipContent>
        </Tooltip>
      </h3>
      <ul className="mt-2 space-y-1.5">
        {deltas.length === 0 ? <li className="text-neutral3 text-xs">No themes in either snapshot.</li> : null}
        {deltas.map(delta => {
          const themeId = delta.themeId;
          const card = (
            <>
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
                markerIndexes={[fromIndex, toIndex]}
              />
            </>
          );
          return (
            <li
              key={delta.label}
              className={`border-border1 rounded-lg border ${
                delta.delta > 0 ? 'bg-green-500/5' : delta.delta < 0 ? 'bg-red-500/5' : 'bg-surface3'
              }`}
            >
              {themeId === undefined ? (
                <div className="px-2.5 py-2">{card}</div>
              ) : (
                <button
                  aria-label={`View theme details for ${delta.label}`}
                  className="hover:border-border2 block w-full cursor-pointer rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.03]"
                  onClick={() => onThemeSelect({ signalName, themeId, label: delta.label }, detailIndexFor(delta))}
                  type="button"
                >
                  {card}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

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
    const distanceTo = (point: 0 | 1) => Math.abs(positions[index]! - positions[points[point]]!);
    const nearest = distanceTo(0) <= distanceTo(1) ? 0 : 1;
    setPointIndexes(nearest === 0 ? [index, points[1]] : [points[0], index]);
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
        <p className="text-neutral4 border-border1 rounded-md border px-2 py-1 font-mono text-xs tabular-nums">
          {snapshotSummaryLabel(fromSnapshot, flows[fromIndex])}
        </p>
        <span aria-hidden="true" className="text-neutral3 text-xs">
          →
        </span>
        <p className="text-neutral4 border-border1 rounded-md border px-2 py-1 font-mono text-xs tabular-nums">
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
