import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';

import { useSpotlitBarRunId } from '../../spotlight';
import { windowPercent } from '../time/timeViewport';
import type { AxisTick, TimeWindow } from '../time/timeViewport';
import { inspectedMarks, pillAlignment } from './layout/inspectedMarks';
import type { AxisMark, PillAlignment } from './layout/inspectedMarks';
import type { PlacedRun } from './layout/laneLayout';
import { barExtentPx } from './layout/laneSizes';

const ALIGNMENT_CLASSES: Record<PillAlignment, string> = {
  'from-left': 'translate-x-0',
  centred: '-translate-x-1/2',
  'from-right': '-translate-x-full',
};

const MARK_TONES: Record<AxisMark['tone'], string> = {
  time: 'bg-fill',
  now: 'bg-info-subtle text-info-subtle-foreground',
};

function useInspectedRun(drawnRunsById: ReadonlyMap<string, PlacedRun>): PlacedRun | undefined {
  const runId = useSpotlitBarRunId();
  return runId === undefined ? undefined : drawnRunsById.get(runId);
}

export function LaneAxis({
  ticks,
  window,
  live,
  widthPx,
  drawnRunsById,
}: {
  ticks: AxisTick[];
  window: TimeWindow;
  live: boolean;
  widthPx: number;
  drawnRunsById: ReadonlyMap<string, PlacedRun>;
}) {
  const inspected = useInspectedRun(drawnRunsById);
  const marks = inspected === undefined ? [] : inspectedMarks(inspected, window, widthPx);
  const inspecting = marks.length > 0;

  return (
    <div aria-hidden className="relative h-7">
      {inspecting
        ? marks.map(mark => (
            <Txt
              key={mark.key}
              as="span"
              variant="meta"
              className={cn(
                'absolute top-0 rounded-md px-1.5 py-0.5 whitespace-nowrap tabular-nums',
                MARK_TONES[mark.tone],
                ALIGNMENT_CLASSES[pillAlignment(mark, widthPx)],
              )}
              style={{ left: mark.atPx }}
            >
              {mark.label}
            </Txt>
          ))
        : ticks.map(tick => (
            <Txt
              key={tick.atMs}
              as="span"
              variant="meta"
              tone="muted"
              className="absolute top-0.5 -translate-x-1/2 whitespace-nowrap tabular-nums"
              style={{ left: `${windowPercent(tick.atMs, window)}%` }}
            >
              {tick.label}
            </Txt>
          ))}
      {live && !inspecting ? (
        <Txt as="span" variant="meta" className={cn('absolute top-0 right-0 rounded-md px-1.5 py-0.5', MARK_TONES.now)}>
          now
        </Txt>
      ) : null}
    </div>
  );
}

export function InspectGuides({
  window,
  widthPx,
  drawnRunsById,
}: {
  window: TimeWindow;
  widthPx: number;
  drawnRunsById: ReadonlyMap<string, PlacedRun>;
}) {
  const inspected = useInspectedRun(drawnRunsById);
  if (inspected === undefined || widthPx === 0) return null;
  const { leftPx, rightPx } = barExtentPx(inspected, window, widthPx);
  const edgesPx = inspected.run.endedAt === undefined ? [leftPx] : [leftPx, rightPx];
  return edgesPx.map(atPx => (
    <span
      key={atPx}
      aria-hidden
      className="border-border-strong pointer-events-none absolute inset-y-0 w-0 border-l border-dashed"
      style={{ left: atPx }}
    />
  ));
}
