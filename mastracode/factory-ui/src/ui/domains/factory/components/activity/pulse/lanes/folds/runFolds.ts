import type { TimeWindow } from '../../time/timeViewport';
import { TRACK_CHIP_GAP_PX } from '../../track/trackChipStyles';
import type { TrackExtentPx } from '../../track/trackChipStyles';
import type { PlacedRun } from '../layout/laneLayout';
import { barExtentPx } from '../layout/laneSizes';

/** Padding and "+12 runs". */
export const MIN_FOLD_PX = 64;

export interface RunFold extends TrackExtentPx {
  runs: PlacedRun[];
}

export function runFolds(overflowRuns: PlacedRun[], window: TimeWindow, widthPx: number): RunFold[] {
  const folds: RunFold[] = [];
  const spans = overflowRuns
    .map(placed => ({ placed, ...barExtentPx(placed, window, widthPx, MIN_FOLD_PX) }))
    .toSorted((left, right) => left.leftPx - right.leftPx);
  for (const span of spans) {
    const last = folds.at(-1);
    if (last !== undefined && span.leftPx <= last.rightPx + TRACK_CHIP_GAP_PX) {
      last.rightPx = Math.max(last.rightPx, span.rightPx);
      last.runs.push(span.placed);
    } else {
      folds.push({ leftPx: span.leftPx, rightPx: span.rightPx, runs: [span.placed] });
    }
  }
  return folds;
}
