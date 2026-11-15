import { getViewportForBounds } from '@xyflow/react';
import type { Viewport } from '@xyflow/react';

import { READABLE_MIN_ZOOM } from './graphShape';
import { KNOWLEDGE_GRAPH_TRANSITION_MS } from './useLeavingNodes';

/** How far Fit view may zoom out to frame a ring of linked pages, which the readable floor would crop. */
export const RING_MIN_ZOOM = 0.15;

interface FitInput {
  bounds: { x: number; y: number; width: number; height: number };
  width: number;
  height: number;
  /** Fit view on a focus with an outer ring of linked pages: frame all of it, below the readable floor if need be. */
  ring?: boolean;
  /** The focus (or the layout's centre): what stays centred when a floor stops the fit. */
  anchor?: { position: { x: number; y: number }; width?: number; height?: number };
  insets?: PaneInsets;
}

export interface PaneInsets {
  left: number;
  right: number;
}

const NO_INSETS: PaneInsets = { left: 0, right: 0 };

export function uncoveredInsets(width: number, insets: PaneInsets): PaneInsets {
  return width - insets.left - insets.right > 0 ? insets : NO_INSETS;
}

/**
 * The viewport that frames `bounds`. Zoom stops at the readable floor, so what is cropped is the edge, not
 * the page being looked at; only Fit view, with an outer ring, goes lower so the whole ring shows.
 */
export function fitViewport({ bounds, width, height, ring, anchor, insets: drawers = NO_INSETS }: FitInput): Viewport {
  const insets = uncoveredInsets(width, drawers);
  const floor = ring ? RING_MIN_ZOOM : READABLE_MIN_ZOOM;
  const visible = width - insets.left - insets.right;
  const viewport = getViewportForBounds(bounds, visible, height, floor, 2, 0.1);
  if (anchor && viewport.zoom <= floor) {
    const cx = anchor.position.x + (anchor.width ?? 0) / 2;
    const cy = anchor.position.y + (anchor.height ?? 0) / 2;
    return {
      zoom: viewport.zoom,
      x: insets.left + visible / 2 - cx * viewport.zoom,
      y: height / 2 - cy * viewport.zoom,
    };
  }
  return { ...viewport, x: viewport.x + insets.left };
}

/** Margin around the drawn nodes on the first view, as a share of the pane. */
export const INITIAL_FIT_PADDING = 0.05;
/** The first view never zooms in past the pages' own size, however few there are. */
export const INITIAL_FIT_MAX_ZOOM = 1;
/** How long after the first view the graph keeps refitting as pages arrive, unless the user acts first. */
export const INITIAL_SETTLE_MS = 3000;

type Rect = { x: number; y: number; width: number; height: number };

/**
 * The first view of a graph: every drawn node in the pane with a small margin, never zoomed in past what
 * fits, and clear of `legend` (the box, in pane pixels, an overlay covers at the top left). When the plain
 * fit would put a node under the legend, the pane is fitted again beside it or below it, whichever keeps
 * the pages larger.
 */
export function fitAllViewport({
  bounds,
  nodes,
  width,
  height,
  legend,
  insets: drawers = NO_INSETS,
}: {
  bounds: Rect;
  nodes: Rect[];
  width: number;
  height: number;
  legend?: { right: number; bottom: number };
  insets?: PaneInsets;
}): Viewport {
  const insets = uncoveredInsets(width, drawers);
  const fitIn = (left: number, top: number): Viewport => {
    const view = getViewportForBounds(
      bounds,
      width - left - insets.right,
      height - top,
      RING_MIN_ZOOM,
      INITIAL_FIT_MAX_ZOOM,
      INITIAL_FIT_PADDING,
    );
    return { zoom: view.zoom, x: view.x + left, y: view.y + top };
  };
  const plain = fitIn(insets.left, 0);
  if (!legend) return plain;
  const covered = nodes.some(node => {
    const left = node.x * plain.zoom + plain.x;
    const top = node.y * plain.zoom + plain.y;
    return left < legend.right && top < legend.bottom;
  });
  if (!covered) return plain;
  const beside = fitIn(legend.right, 0);
  const below = fitIn(insets.left, legend.bottom);
  return beside.zoom >= below.zoom ? beside : below;
}

/** How long a view change animates: the same as the layout's own transition, and none under reduced motion. */
export const fitDuration = (motion: boolean) => (motion ? KNOWLEDGE_GRAPH_TRANSITION_MS : 0);

/** How close to the pane's edge a refocused page may sit before the view moves to bring it in. */
export const NUDGE_PADDING = 24;

/**
 * How far to move the view along one axis so a page at `start` (screen position) of `size` stays inside a
 * pane of `extent`, with padding. Zero when it already is; centred when it can't fit with the padding.
 */
export function nudgeAxis(start: number, size: number, extent: number): number {
  if (size + NUDGE_PADDING * 2 > extent) return extent / 2 - (start + size / 2);
  if (start < NUDGE_PADDING) return NUDGE_PADDING - start;
  const overflow = start + size - (extent - NUDGE_PADDING);
  return overflow > 0 ? -overflow : 0;
}
