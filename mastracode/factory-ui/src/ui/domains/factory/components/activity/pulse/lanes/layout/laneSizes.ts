import type { TimeWindow } from '../../time/timeViewport';
import { edgeFade } from '../../track/edgeFade';
import type { EdgeFade } from '../../track/edgeFade';
import { TRACK_CHIP_HEIGHT_PX, liveEdgeLeftPx } from '../../track/trackChipStyles';
import type { TrackExtentPx } from '../../track/trackChipStyles';
import { runEndMs } from './laneLayout';
import type { PlacedRun } from './laneLayout';

export const MIN_BAR_WIDTH_PX = 28;
/** Padding, source and status icons with their gaps, and about five characters. */
const MIN_RUN_LABEL_PX = 96;
const ROW_GAP_PX = 6;
const LANE_PADDING_PX = 8;

export type DrawnBarSpan = TrackExtentPx & EdgeFade;

function clampedTrackPx(ms: number, window: TimeWindow, widthPx: number): number {
  const px = ((ms - window.startMs) / (window.endMs - window.startMs)) * widthPx;
  return Math.min(2 * widthPx, Math.max(-widthPx, px));
}

export function barExtentPx(
  placed: PlacedRun,
  window: TimeWindow,
  widthPx: number,
  minWidthPx = MIN_BAR_WIDTH_PX,
): TrackExtentPx {
  const fromPx = clampedTrackPx(placed.run.startedAt ?? placed.fromMs, window, widthPx);
  const toPx = clampedTrackPx(window.endsAtNow ? placed.toMs : runEndMs(placed.run), window, widthPx);
  const leftPx =
    placed.run.startedAt === undefined
      ? Math.min(fromPx, toPx - minWidthPx)
      : liveEdgeLeftPx(fromPx, minWidthPx, window, widthPx);
  return { leftPx, rightPx: Math.max(toPx, leftPx + minWidthPx) };
}

export function drawnBarSpan(placed: PlacedRun, window: TimeWindow, widthPx: number): DrawnBarSpan {
  const extent = barExtentPx(placed, window, widthPx);
  return { ...extent, ...edgeFade(extent.leftPx, extent.rightPx, window, widthPx, MIN_RUN_LABEL_PX) };
}

export function laneHeightPx(rowCount: number): number {
  return 2 * LANE_PADDING_PX + rowCount * TRACK_CHIP_HEIGHT_PX + (rowCount - 1) * ROW_GAP_PX;
}

export function rowTopPx(row: number): number {
  return LANE_PADDING_PX + row * (TRACK_CHIP_HEIGHT_PX + ROW_GAP_PX);
}
