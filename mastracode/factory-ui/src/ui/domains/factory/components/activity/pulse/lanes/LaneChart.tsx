import { FACTORY_ROLE_STAGES, isFactoryRole } from '@mastra/factory/rules/types';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowRight, ChevronsDownUp, ChevronsUpDown, GitCommitHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

import { stageLabel } from '../../../../stages';
import { BoardStageIcon, stageTintClass, stageToneClasses } from '../../../BoardIcons';
import type { BarsInView } from '../../spotlight';
import type { RunBar } from '../runs/runBars';
import { axisTicks, followNow } from '../time/timeViewport';
import type { TimeViewport, TimeWindow } from '../time/timeViewport';
import { useElementWidth } from '../time/useElementWidth';
import { TimeControls } from '../time/TimeControls';
import { timeKeyHandler, useTimeGestures } from '../time/useTimeGestures';
import { LaneFolds } from './folds/LaneFolds';
import { HandoffCurves } from './HandoffCurves';
import { InspectGuides, LaneAxis } from './LaneAxis';
import { EXPANDED_LANE_ROWS, FOLDED_LANE_ROWS, packLanes, placeLanes } from './layout/laneLayout';
import type { PackedLane, PlacedRun } from './layout/laneLayout';
import { MIN_BAR_WIDTH_PX, laneHeightPx } from './layout/laneSizes';
import { LaneRunBar } from './LaneRunBar';

const LANE_TRANSITION = 'transition-[height] duration-200 motion-reduce:transition-none';

export interface CommitLane {
  name: string;
  label: ReactNode;
  track: (widthPx: number) => ReactNode;
}

function roleStage(role: string): string {
  return isFactoryRole(role) ? FACTORY_ROLE_STAGES[role] : role;
}

function placeChart(packedLanes: PackedLane[], window: TimeWindow, expandedRoles: ReadonlySet<string>) {
  const lanes = placeLanes(packedLanes, window, expandedRoles);
  const drawnRuns = lanes.flatMap(lane => lane.runs);
  const barsInView: BarsInView = {
    runIds: new Set(drawnRuns.map(placed => placed.run.id)),
    cardIds: new Set(drawnRuns.flatMap(placed => placed.run.workItemId ?? [])),
  };
  const drawnRunsById: ReadonlyMap<string, PlacedRun> = new Map(drawnRuns.map(placed => [placed.run.id, placed]));
  return { lanes, barsInView, drawnRunsById };
}

function LaneLabel({ height, icon, children }: { height: number; icon: ReactNode; children: ReactNode }) {
  return (
    <div
      className={cn('border-border/50 flex items-center gap-2.5 border-b pr-3 last:border-b-0', LANE_TRANSITION)}
      style={{ height }}
    >
      {icon}
      <span className="flex min-w-0 items-center gap-1.5">{children}</span>
    </div>
  );
}

function IconTile({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span aria-hidden className={cn('grid size-7 shrink-0 place-items-center rounded-lg', className)}>
      {children}
    </span>
  );
}

function LaneFoldToggle({
  laneLabel,
  expanded,
  onToggle,
}: {
  laneLabel: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-expanded={expanded}
      aria-label={expanded ? `Fold ${laneLabel} runs` : `Show more ${laneLabel} runs`}
      tooltip={expanded ? `Fold to ${FOLDED_LANE_ROWS} rows` : `Show up to ${EXPANDED_LANE_ROWS} rows`}
      onClick={onToggle}
    >
      {expanded ? <ChevronsDownUp /> : <ChevronsUpDown />}
    </Button>
  );
}

export function LaneChart({
  runs,
  commitLane,
  viewport,
  setViewport,
  window,
  nowMs,
  factoryProjectId,
}: {
  runs: RunBar[];
  commitLane: CommitLane;
  viewport: TimeViewport;
  setViewport: Dispatch<SetStateAction<TimeViewport>>;
  window: TimeWindow;
  nowMs: number;
  factoryProjectId: string;
}) {
  const [chart, setChart] = useState<HTMLDivElement | null>(null);
  const [track, setTrack] = useState<HTMLDivElement | null>(null);
  const [expandedRoles, setExpandedRoles] = useState<ReadonlySet<string>>(new Set());
  useTimeGestures({ chart, track }, setViewport);
  const trackWidthPx = useElementWidth(track);
  const { startMs, endMs, endsAtNow } = window;
  const narrowestBarMs = trackWidthPx === 0 ? 0 : (MIN_BAR_WIDTH_PX / trackWidthPx) * viewport.spanMs;
  const liveEndMs = endsAtNow ? endMs : undefined;
  const packedLanes = useMemo(() => packLanes(runs, narrowestBarMs, liveEndMs), [runs, narrowestBarMs, liveEndMs]);
  const { lanes, barsInView, drawnRunsById } = useMemo(
    () => placeChart(packedLanes, { startMs, endMs, endsAtNow }, expandedRoles),
    [packedLanes, startMs, endMs, endsAtNow, expandedRoles],
  );
  const toggleLane = (role: string) =>
    setExpandedRoles(current => {
      const next = new Set(current);
      if (!next.delete(role)) next.add(role);
      return next;
    });

  return (
    <div ref={setChart} className="flex">
      <div className="w-44 shrink-0">
        <div className="flex h-7 items-center">
          <TimeControls viewport={viewport} setViewport={setViewport} window={window} nowMs={nowMs} />
        </div>
        {lanes.map(lane => {
          const stage = roleStage(lane.role);
          return (
            <LaneLabel
              key={lane.role}
              height={laneHeightPx(lane.rowCount)}
              icon={
                <IconTile className={stageTintClass(stage)}>
                  <BoardStageIcon stage={stage} decorative />
                </IconTile>
              }
            >
              <Txt as="span" variant="label" className="truncate">
                {stageLabel(stage)}
              </Txt>
              {lane.foldable ? (
                <LaneFoldToggle
                  laneLabel={stageLabel(stage)}
                  expanded={expandedRoles.has(lane.role)}
                  onToggle={() => toggleLane(lane.role)}
                />
              ) : null}
            </LaneLabel>
          );
        })}
        <LaneLabel
          height={laneHeightPx(1)}
          icon={
            <IconTile className="bg-fill-subtle">
              <GitCommitHorizontal className="text-muted-foreground size-4" />
            </IconTile>
          }
        >
          {commitLane.label}
        </LaneLabel>
      </div>
      <div className="relative min-w-0 flex-1">
        <div
          ref={setTrack}
          data-time-track
          tabIndex={0}
          role="group"
          aria-label="Agent runs over time. Arrow keys move through time, plus and minus zoom, End returns to now."
          onKeyDown={timeKeyHandler(setViewport)}
          className={cn('cursor-grab touch-pan-y rounded-md select-none active:cursor-grabbing', focusRing)}
        >
          <LaneAxis
            ticks={axisTicks(viewport, window, nowMs)}
            window={window}
            live={viewport.live}
            widthPx={trackWidthPx}
            drawnRunsById={drawnRunsById}
          />
          <div className="relative overflow-x-clip">
            {viewport.live ? (
              <span aria-hidden className="bg-info-indicator pointer-events-none absolute inset-y-0 right-0 w-px" />
            ) : null}
            <InspectGuides window={window} widthPx={trackWidthPx} drawnRunsById={drawnRunsById} />
            <HandoffCurves lanes={lanes} window={window} widthPx={trackWidthPx} />
            {lanes.map(lane => {
              const laneStage = roleStage(lane.role);
              const laneLabel = stageLabel(laneStage);
              return (
                <div
                  key={lane.role}
                  role="group"
                  aria-label={laneLabel}
                  className={cn('border-border/50 relative border-b', LANE_TRANSITION)}
                  style={{ height: laneHeightPx(lane.rowCount) }}
                >
                  {lane.runs.map(placed => (
                    <LaneRunBar
                      key={placed.run.id}
                      placed={placed}
                      window={window}
                      widthPx={trackWidthPx}
                      nowMs={nowMs}
                      laneLabel={laneLabel}
                      laneTone={stageToneClasses(laneStage)}
                      barsInView={barsInView}
                      factoryProjectId={factoryProjectId}
                    />
                  ))}
                  <LaneFolds
                    lane={lane}
                    window={window}
                    widthPx={trackWidthPx}
                    factoryProjectId={factoryProjectId}
                    onExpandLane={expandedRoles.has(lane.role) ? undefined : () => toggleLane(lane.role)}
                  />
                </div>
              );
            })}
            <div
              role="group"
              aria-label={`Commits on ${commitLane.name}`}
              className="relative"
              style={{ height: laneHeightPx(1) }}
            >
              {commitLane.track(trackWidthPx)}
            </div>
          </div>
        </div>
        {viewport.live ? null : (
          <Button
            size="sm"
            iconEnd={<ArrowRight />}
            className="absolute top-1/2 right-2 -translate-y-1/2"
            onClick={() => setViewport(followNow)}
          >
            Now
          </Button>
        )}
      </div>
    </div>
  );
}
