import type { TimeWindow } from '../time/timeViewport';

export const EDGE_FADE_PX = 40;
const STICKY_LABEL_INSET_PX = 16;

export interface EdgeFade {
  labelOffsetStartPx: number;
  labelOffsetEndPx: number;
  surfaceMaskImage: string | undefined;
  stickyInsetMaskImage: string | undefined;
}

function edgeMaskImage(leftPx: number, rightPx: number, window: TimeWindow, widthPx: number, fadePx: number) {
  const fadedEndStartPx = window.endsAtNow ? widthPx : widthPx - fadePx;
  const fadesIntoStart = leftPx < fadePx;
  const fadesIntoEnd = rightPx > fadedEndStartPx;
  if (!fadesIntoStart && !fadesIntoEnd) return undefined;
  const startStops = fadesIntoStart ? [`transparent ${-leftPx}px`, `black ${fadePx - leftPx}px`] : ['black'];
  const endStops = fadesIntoEnd
    ? [`black ${fadedEndStartPx - leftPx}px`, `transparent ${widthPx - leftPx}px`]
    : ['black'];
  return `linear-gradient(to right, ${[...startStops, ...endStops].join(', ')})`;
}

export function edgeFade(
  leftPx: number,
  rightPx: number,
  window: TimeWindow,
  widthPx: number,
  minStickyLabelPx: number,
): EdgeFade {
  const stickyEndPx = window.endsAtNow ? widthPx : widthPx - STICKY_LABEL_INSET_PX;
  const stickyRoomPx = Math.max(0, rightPx - leftPx - minStickyLabelPx);
  const labelOffsetStartPx = Math.min(stickyRoomPx, Math.max(0, STICKY_LABEL_INSET_PX - leftPx));
  return {
    labelOffsetStartPx,
    labelOffsetEndPx: Math.min(stickyRoomPx - labelOffsetStartPx, Math.max(0, rightPx - stickyEndPx)),
    surfaceMaskImage: edgeMaskImage(leftPx, rightPx, window, widthPx, EDGE_FADE_PX),
    stickyInsetMaskImage: edgeMaskImage(leftPx, rightPx, window, widthPx, STICKY_LABEL_INSET_PX),
  };
}
