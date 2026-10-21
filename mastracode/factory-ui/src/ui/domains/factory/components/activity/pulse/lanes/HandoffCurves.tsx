import { useSpotlitBarRunId } from '../../spotlight';
import type { TimeWindow } from '../time/timeViewport';
import { TRACK_CHIP_HEIGHT_PX } from '../track/trackChipStyles';
import { laneHandoffs } from './layout/laneLayout';
import type { Lane } from './layout/laneLayout';
import { barExtentPx, laneHeightPx, rowTopPx } from './layout/laneSizes';

const MIN_BEND_PX = 12;
const MAX_UNHOVERED_HANDOFF_PX = 160;

interface HandoffCurve {
  id: string;
  runIds: [string, string];
  lengthPx: number;
  path: string;
}

function HandoffPaths({ curves }: { curves: HandoffCurve[] }) {
  const inspectedRunId = useSpotlitBarRunId();
  return curves.map(curve => {
    const touchesInspected = inspectedRunId !== undefined && curve.runIds.includes(inspectedRunId);
    if (curve.lengthPx > MAX_UNHOVERED_HANDOFF_PX && !touchesInspected) return null;
    return (
      <path key={curve.id} d={curve.path} fill="none" stroke="currentColor" strokeWidth={1.25} strokeDasharray="3 3" />
    );
  });
}

export function HandoffCurves({ lanes, window, widthPx }: { lanes: Lane[]; window: TimeWindow; widthPx: number }) {
  const laneTopsPx: number[] = [];
  let nextLaneTopPx = 0;
  for (const lane of lanes) {
    laneTopsPx.push(nextLaneTopPx);
    nextLaneTopPx += laneHeightPx(lane.rowCount);
  }
  const curves = laneHandoffs(lanes).map(({ id, from, to }): HandoffCurve => {
    const fromX = barExtentPx(from.placed, window, widthPx).rightPx;
    const toX = barExtentPx(to.placed, window, widthPx).leftPx;
    const fromY = laneTopsPx[from.laneIndex] + rowTopPx(from.placed.row) + TRACK_CHIP_HEIGHT_PX / 2;
    const toY = laneTopsPx[to.laneIndex] + rowTopPx(to.placed.row) + TRACK_CHIP_HEIGHT_PX / 2;
    const bendPx = Math.max(MIN_BEND_PX, Math.abs(toX - fromX) / 2);
    return {
      id,
      runIds: [from.placed.run.id, to.placed.run.id],
      lengthPx: toX - fromX,
      path: `M ${fromX} ${fromY} C ${fromX + bendPx} ${fromY}, ${toX - bendPx} ${toY}, ${toX} ${toY}`,
    };
  });

  return (
    <svg aria-hidden className="text-info-indicator pointer-events-none absolute inset-0 size-full overflow-visible">
      <HandoffPaths curves={curves} />
    </svg>
  );
}
