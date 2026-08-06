import { nodeColor } from '@mastra/playground-ui/components/SankeyChart';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { getSignalHue } from '@mastra/playground-ui/ee/signals';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { useThemeFlows } from './hooks/use-theme-flows';
import { snapshotSummaryLabel } from './sankey-signals-data';
import { formatSignalName, formatSnapshotCutoff, SIGNAL_DESCRIPTIONS } from './signal-formatting';
import { SignalsFrameLoadingSkeleton } from './signals-loading-skeleton';
import { TimelineTrack } from './snapshot-timeline';
import type { TimelineMarkerKind } from './snapshot-timeline';
import { timelineTickPositions } from './snapshot-timeline-data';
import type { ThemeSelection } from './theme-drilldown-data';
import { buildThemeLifelines, lifelineConnectors } from './theme-lifelines-data';
import type { ThemeLifeline } from './theme-lifelines-data';
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
        {connectors.length > 0 ? (
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 size-full"
            preserveAspectRatio="none"
            viewBox={`0 0 100 ${TRACK_HEIGHT}`}
          >
            {connectors.map(({ from, to }) => (
              <line
                key={`${from.snapshotIndex}-${to.snapshotIndex}`}
                stroke={nodeColor(hue)}
                strokeOpacity={0.45}
                strokeWidth={1.2}
                vectorEffect="non-scaling-stroke"
                x1={positions[from.snapshotIndex]}
                y1={TRACK_HEIGHT - 1 - barHeight(from.share)}
                x2={positions[to.snapshotIndex]}
                y2={TRACK_HEIGHT - 1 - barHeight(to.share)}
              />
            ))}
          </svg>
        ) : null}
        {row.points.map(point => {
          const title = pointTitle(snapshots[point.snapshotIndex], row.label, point.traceCount, point.share);
          const style = {
            left: `${positions[point.snapshotIndex]}%`,
            height: `${barHeight(point.share)}px`,
            backgroundColor: nodeColor(hue),
          };
          const themeId = point.themeId;
          if (themeId === undefined) {
            return (
              <span
                key={point.snapshotIndex}
                className="absolute bottom-px w-1.5 -translate-x-1/2 rounded-xs"
                style={style}
                title={title}
              />
            );
          }
          return (
            <button
              key={point.snapshotIndex}
              aria-label={title}
              className="absolute bottom-px w-1.5 -translate-x-1/2 cursor-pointer rounded-xs hover:brightness-125"
              onClick={() => onThemeSelect({ signalName, themeId, label: row.label }, point.snapshotIndex)}
              style={style}
              title={title}
              type="button"
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
