import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { CSSProperties } from 'react';

import type { TimeWindow } from '../time/timeViewport';
import type { EdgeFade } from './edgeFade';

export const TRACK_CHIP_HEIGHT_PX = 28;
export const TRACK_CHIP_GAP_PX = 4;

export const TRACK_CHIP_CLASS = cn('absolute isolate flex items-center overflow-hidden rounded-lg px-2', focusRing);

export interface TrackExtentPx {
  leftPx: number;
  rightPx: number;
}

export function liveEdgeLeftPx(leftPx: number, minWidthPx: number, window: TimeWindow, widthPx: number): number {
  return window.endsAtNow ? Math.min(leftPx, widthPx - minWidthPx) : leftPx;
}

export function trackChipStyle(top: CSSProperties['top'], extent: TrackExtentPx, fade: EdgeFade): CSSProperties {
  return {
    top,
    height: TRACK_CHIP_HEIGHT_PX,
    left: extent.leftPx,
    width: extent.rightPx - extent.leftPx,
    maskImage: fade.stickyInsetMaskImage,
  };
}
