import type { CSSProperties } from 'react';

const POPUP_GAP = 12;
const POPUP_MAX_HEIGHT = 320;

/** Opens below the click, or above it when the click is in the lower half, never taller than the room on that side. */
export function mentionPopupPlacement({
  point,
  pane,
}: {
  point: { x: number; y: number };
  pane: { width: number; height: number };
}): CSSProperties {
  const left = `clamp(0.5rem, ${point.x}px - 10rem, calc(100% - 20.5rem))`;
  if (pane.height > 0 && point.y > pane.height / 2) {
    return {
      left,
      bottom: pane.height - point.y + POPUP_GAP,
      maxHeight: Math.min(POPUP_MAX_HEIGHT, point.y - POPUP_GAP - 8),
    };
  }
  const room = pane.height > 0 ? pane.height - point.y - POPUP_GAP - 8 : POPUP_MAX_HEIGHT;
  return { left, top: point.y + POPUP_GAP, maxHeight: Math.min(POPUP_MAX_HEIGHT, room) };
}
