import { clockTime } from '../../../../../activity';
import type { TimeWindow } from '../../time/timeViewport';
import type { PlacedRun } from './laneLayout';
import { barExtentPx } from './laneSizes';

export interface AxisMark {
  key: string;
  atPx: number;
  label: string;
  tone: 'time' | 'now';
}

const ESTIMATED_PILL_WIDTH_PX: Record<AxisMark['tone'], number> = { time: 130, now: 40 };
const PILL_GAP_PX = 6;

export type PillAlignment = 'from-left' | 'centred' | 'from-right';

export function pillAlignment(mark: AxisMark, widthPx: number): PillAlignment {
  const halfPillPx = ESTIMATED_PILL_WIDTH_PX[mark.tone] / 2;
  if (mark.atPx < halfPillPx) return 'from-left';
  if (mark.atPx > widthPx - halfPillPx) return 'from-right';
  return 'centred';
}

function pillExtentPx(mark: AxisMark, widthPx: number): { leftPx: number; rightPx: number } {
  const pillPx = ESTIMATED_PILL_WIDTH_PX[mark.tone];
  const leftPx: Record<PillAlignment, number> = {
    'from-left': mark.atPx,
    centred: mark.atPx - pillPx / 2,
    'from-right': mark.atPx - pillPx,
  };
  const left = leftPx[pillAlignment(mark, widthPx)];
  return { leftPx: left, rightPx: left + pillPx };
}

function isOngoing(inspected: PlacedRun, window: TimeWindow): boolean {
  const { status } = inspected.run;
  return window.endsAtNow && (status === 'running' || status === 'needs-you');
}

export function inspectedMarks(inspected: PlacedRun, window: TimeWindow, widthPx: number): AxisMark[] {
  const { run } = inspected;
  const extent = barExtentPx(inspected, window, widthPx);
  const startPx = Math.max(0, extent.leftPx);
  const endPx = Math.min(widthPx, extent.rightPx);
  const startTime = run.startedAt === undefined ? 'Earlier' : clockTime(run.startedAt);
  const start: AxisMark = {
    key: 'start',
    atPx: startPx,
    label: run.startedAt === undefined ? 'Earlier' : `Started ${startTime}`,
    tone: 'time',
  };
  const endTime = run.endedAt === undefined ? undefined : clockTime(run.endedAt);
  const ongoing = isOngoing(inspected, window);
  if (endTime === undefined && !ongoing) return [start];

  const end: AxisMark = ongoing
    ? { key: 'end', atPx: endPx, label: 'now', tone: 'now' }
    : { key: 'end', atPx: endPx, label: `Ended ${endTime}`, tone: 'time' };
  const collide = pillExtentPx(start, widthPx).rightPx + PILL_GAP_PX > pillExtentPx(end, widthPx).leftPx;
  if (!collide) return [start, end];

  const endText = endTime ?? 'now';
  const label = startTime === endText ? startTime : `${startTime} – ${endText}`;
  return [{ key: 'span', atPx: (startPx + endPx) / 2, label, tone: 'time' }];
}
