import { nodeColor } from '@mastra/playground-ui/components/SankeyChart';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { getSignalHue } from '@mastra/playground-ui/ee/signals';
import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import type { FocusEvent, MouseEvent } from 'react';
import { createPortal } from 'react-dom';

import { useThemeFlows } from './hooks/use-theme-flows';
import { snapshotSummaryLabel } from './sankey-signals-data';
import { formatSignalName, formatSnapshotCutoff, SIGNAL_DESCRIPTIONS } from './signal-formatting';
import { SignalsFrameLoadingSkeleton } from './signals-loading-skeleton';
import { TimelineTrack } from './snapshot-timeline';
import type { TimelineMarkerKind } from './snapshot-timeline';
import { timelineTickPositions } from './snapshot-timeline-data';
import type { ThemeSelection } from './theme-drilldown-data';
import { buildThemeLifelines, lifelineConnectors, lifelineSegments } from './theme-lifelines-data';
import type { ThemeLifeline, ThemeLifelinePoint } from './theme-lifelines-data';
import type { ThemeFlowResponse, ThemeSnapshot, TraceSignalName } from './types';

const TRACK_HEIGHT = 28;
const MAX_BAR_HEIGHT = 22;
const MIN_BAR_HEIGHT = 4;

function barHeight(share: number) {
  return Math.max(MIN_BAR_HEIGHT, Math.round(share * MAX_BAR_HEIGHT));
}

function pointTitle(snapshot: ThemeSnapshot | undefined, label: string, traceCount: number, share: number) {
  const cutoff = snapshot?.cutoffAt ? formatSnapshotCutoff(snapshot.cutoffAt) : undefined;
  return `${label}${cutoff ? ` · ${cutoff}` : ''} · ${traceCount} traces (${Math.round(share * 100)}%)`;
}

/**
 * A presence point with an instant portal tooltip (same pattern as the Sankey
 * node tooltips) — native `title` popups were too slow to read while scanning
 * a row.
 */
function LifelinePoint({
  point,
  title,
  positionPercent,
  hue,
  onSelect,
}: {
  point: ThemeLifelinePoint;
  title: string;
  positionPercent: number | undefined;
  hue: number;
  onSelect: (() => void) | undefined;
}) {
  const tooltipId = useId();
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number }>();
  const style = {
    left: `${positionPercent}%`,
    height: `${barHeight(point.share)}px`,
    backgroundColor: nodeColor(hue),
  };
  const showTooltipAt = (target: HTMLElement) => {
    const bounds = target.getBoundingClientRect();
    setTooltipPosition({ left: bounds.left + bounds.width / 2, top: bounds.top - 6 });
  };
  const hideTooltip = () => setTooltipPosition(undefined);
  const interactionProps = {
    'aria-describedby': tooltipPosition ? tooltipId : undefined,
    onMouseEnter: (event: MouseEvent<HTMLElement>) => showTooltipAt(event.currentTarget),
    onMouseLeave: hideTooltip,
    onFocus: (event: FocusEvent<HTMLElement>) => showTooltipAt(event.currentTarget),
    onBlur: hideTooltip,
  };

  return (
    <>
      {onSelect ? (
        <button
          aria-label={title}
          className="absolute bottom-px w-1.5 -translate-x-1/2 cursor-pointer rounded-xs hover:brightness-125"
          onClick={onSelect}
          style={style}
          type="button"
          {...interactionProps}
        />
      ) : (
        <span
          aria-label={title}
          className="absolute bottom-px w-1.5 -translate-x-1/2 rounded-xs"
          style={style}
          {...interactionProps}
        />
      )}
      {tooltipPosition
        ? createPortal(
            <div
              className="border-border1 bg-surface5 text-neutral6 shadow-elevated pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md border px-2 py-1 font-mono text-[11px] whitespace-nowrap tabular-nums"
              id={tooltipId}
              role="tooltip"
              style={{ left: tooltipPosition.left, top: tooltipPosition.top }}
            >
              {title}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function LifelineRow({
  row,
  signalName,
  snapshots,
  positions,
  hue,
  onThemeSelect,
}: {
  row: ThemeLifeline;
  signalName: TraceSignalName;
  snapshots: ThemeSnapshot[];
  positions: number[];
  hue: number;
  onThemeSelect: (selection: ThemeSelection, snapshotIndex: number) => void;
}) {
  const isPersistent = row.points.length * 2 >= snapshots.length;
  const connectors = lifelineConnectors(row.points);
  const segments = lifelineSegments(row.points);
  const pointY = (point: ThemeLifelinePoint) => TRACK_HEIGHT - 1 - barHeight(point.share);

  return (
    <li
      aria-label={`${row.label}: present in ${row.points.length} of ${snapshots.length} landmarks`}
      className={`group hover:bg-surface3 flex items-center gap-3 rounded-md transition-colors ${isPersistent ? '' : 'opacity-55 hover:opacity-100'}`}
    >
      <span
        className="text-neutral4 group-hover:text-neutral6 w-52 shrink-0 truncate text-right text-xs"
        title={row.label}
      >
        {row.label}
      </span>
      <div className="border-border1 relative mx-2 h-7 min-w-0 flex-1 border-b">
        {connectors.length > 0 || segments.length > 0 ? (
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 size-full"
            preserveAspectRatio="none"
            viewBox={`0 0 100 ${TRACK_HEIGHT}`}
          >
            {segments.map(segment => (
              <polygon
                key={`area-${segment[0]!.snapshotIndex}`}
                fill={nodeColor(hue)}
                fillOpacity={0.14}
                points={[
                  `${positions[segment[0]!.snapshotIndex]},${TRACK_HEIGHT - 1}`,
                  ...segment.map(point => `${positions[point.snapshotIndex]},${pointY(point)}`),
                  `${positions[segment[segment.length - 1]!.snapshotIndex]},${TRACK_HEIGHT - 1}`,
                ].join(' ')}
              />
            ))}
            {connectors.map(({ from, to }) => (
              <line
                key={`${from.snapshotIndex}-${to.snapshotIndex}`}
                stroke={nodeColor(hue)}
                strokeOpacity={0.45}
                strokeWidth={1.2}
                vectorEffect="non-scaling-stroke"
                x1={positions[from.snapshotIndex]}
                y1={pointY(from)}
                x2={positions[to.snapshotIndex]}
                y2={pointY(to)}
              />
            ))}
          </svg>
        ) : null}
        {row.points.map(point => {
          const title = pointTitle(snapshots[point.snapshotIndex], row.label, point.traceCount, point.share);
          const themeId = point.themeId;
          return (
            <LifelinePoint
              key={point.snapshotIndex}
              point={point}
              title={title}
              positionPercent={positions[point.snapshotIndex]}
              hue={hue}
              onSelect={
                themeId === undefined
                  ? undefined
                  : () => onThemeSelect({ signalName, themeId, label: row.label }, point.snapshotIndex)
              }
            />
          );
        })}
      </div>
      <span className="text-neutral3 w-9 shrink-0 font-mono text-[11px] tabular-nums">
        {row.points.length}/{snapshots.length}
      </span>
    </li>
  );
}

function SignalLifelines({
  signalName,
  flows,
  snapshots,
  positions,
  onThemeSelect,
}: {
  signalName: TraceSignalName;
  flows: Array<ThemeFlowResponse | undefined>;
  snapshots: ThemeSnapshot[];
  positions: number[];
  onThemeSelect: (selection: ThemeSelection, snapshotIndex: number) => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const rows = buildThemeLifelines(flows, signalName);
  const hue = getSignalHue(signalName);

  return (
    <section aria-label={`${formatSignalName(signalName)} lifelines`} className="min-w-0">
      <h3 className="font-mono text-xs font-semibold tracking-widest uppercase" style={{ color: nodeColor(hue) }}>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                aria-expanded={!isCollapsed}
                className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
                onClick={() => setIsCollapsed(previous => !previous)}
                type="button"
              />
            }
          >
            <ChevronDown
              aria-hidden="true"
              className={`size-3.5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
            />
            {signalName}
          </TooltipTrigger>
          <TooltipContent>{SIGNAL_DESCRIPTIONS[signalName]}</TooltipContent>
        </Tooltip>
      </h3>
      {isCollapsed ? undefined : rows.length === 0 ? (
        <p className="text-neutral3 mt-2 text-xs">No themes in these landmarks.</p>
      ) : (
        <ul className="mt-2 space-y-0.5">
          {rows.map(row => (
            <LifelineRow
              key={row.label}
              row={row}
              signalName={signalName}
              snapshots={snapshots}
              positions={positions}
              hue={hue}
              onThemeSelect={onThemeSelect}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

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
