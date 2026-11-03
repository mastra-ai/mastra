import { getViewportForBounds } from '@xyflow/react';
import type { Viewport } from '@xyflow/react';

import { READABLE_MIN_ZOOM } from './graphShape';
import { KNOWLEDGE_GRAPH_TRANSITION_MS } from './useLeavingNodes';

interface FitInput {
  bounds: { x: number; y: number; width: number; height: number };
  width: number;
  height: number;
  /** A refocus on a page, not a fit of the whole graph. */
  focus: boolean;
  /** The focus (or the layout's centre): what stays centred when a floor stops the fit. */
  anchor?: { position: { x: number; y: number }; width?: number; height?: number };
}

/**
 * The viewport that frames `bounds`. Zoom stops at the readable floor, so what is cropped is the edge, not
 * the page being looked at.
 */
export function fitViewport({ bounds, width, height, focus, anchor }: FitInput): Viewport {
  const floor = READABLE_MIN_ZOOM;
  const viewport = getViewportForBounds(bounds, width, height, floor, focus ? 1.5 : 2, focus ? 0.3 : 0.1);
  if (anchor && viewport.zoom <= floor) {
    const cx = anchor.position.x + (anchor.width ?? 0) / 2;
    const cy = anchor.position.y + (anchor.height ?? 0) / 2;
    return { zoom: viewport.zoom, x: width / 2 - cx * viewport.zoom, y: height / 2 - cy * viewport.zoom };
  }
  return viewport;
}

/** How long a view change animates: the same as the layout's own transition, and none under reduced motion. */
export const fitDuration = (motion: boolean) => (motion ? KNOWLEDGE_GRAPH_TRANSITION_MS : 0);
