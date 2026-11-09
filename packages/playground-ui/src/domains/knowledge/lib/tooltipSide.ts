export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type TooltipSide = 'top' | 'bottom' | 'right' | 'left';

export interface TooltipPlacementInput {
  /** The hovered dot, in the same coordinates as everything else (the screen). */
  dot: Box;
  /** The tooltip's size once drawn. */
  tip: { width: number; height: number };
  /** Space between the dot and the tooltip. */
  gap: number;
  /** The tooltip must stay inside this. */
  bounds: Box;
  /** Things the tooltip must not cover: the focused page, the hovered page's neighbours, the legend, buttons. */
  obstacles: readonly Box[];
  /** Lines it must not cover: the hovered page's highlighted edges, as endpoints. */
  lines: ReadonlyArray<{ from: { x: number; y: number }; to: { x: number; y: number } }>;
}

/** Sides in the order they win a tie: above is the one people expect. */
const SIDES: TooltipSide[] = ['top', 'bottom', 'right', 'left'];

/** Where the tooltip would sit on a side of the dot, centred on it. */
export function tooltipBox(
  side: TooltipSide,
  { dot, tip, gap }: Pick<TooltipPlacementInput, 'dot' | 'tip' | 'gap'>,
): Box {
  const centerX = (dot.left + dot.right) / 2;
  const centerY = (dot.top + dot.bottom) / 2;
  if (side === 'top')
    return {
      left: centerX - tip.width / 2,
      right: centerX + tip.width / 2,
      bottom: dot.top - gap,
      top: dot.top - gap - tip.height,
    };
  if (side === 'bottom')
    return {
      left: centerX - tip.width / 2,
      right: centerX + tip.width / 2,
      top: dot.bottom + gap,
      bottom: dot.bottom + gap + tip.height,
    };
  if (side === 'left')
    return {
      right: dot.left - gap,
      left: dot.left - gap - tip.width,
      top: centerY - tip.height / 2,
      bottom: centerY + tip.height / 2,
    };
  return {
    left: dot.right + gap,
    right: dot.right + gap + tip.width,
    top: centerY - tip.height / 2,
    bottom: centerY + tip.height / 2,
  };
}

function overlap(a: Box, b: Box): number {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
}

/** Whether a line passes through the box, by sampling along it. */
function crosses(box: Box, from: { x: number; y: number }, to: { x: number; y: number }): boolean {
  const steps = Math.max(4, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 6));
  for (let step = 0; step <= steps; step++) {
    const x = from.x + ((to.x - from.x) * step) / steps;
    const y = from.y + ((to.y - from.y) * step) / steps;
    if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) return true;
  }
  return false;
}

/**
 * Picks the side of the dot whose tooltip covers the least: leaving the bounds costs most, then covering a
 * line, then covering a page. With nothing in the way (or nothing measured) it stays above.
 */
export function chooseTooltipSide(input: TooltipPlacementInput): TooltipSide {
  const area = (box: Box) => (box.right - box.left) * (box.bottom - box.top);
  let best: TooltipSide = 'top';
  let bestCost = Number.POSITIVE_INFINITY;
  for (const side of SIDES) {
    const box = tooltipBox(side, input);
    const outside = area(box) - overlap(box, input.bounds);
    let cost = outside * 100;
    for (const obstacle of input.obstacles) cost += overlap(box, obstacle) * 4;
    for (const line of input.lines) if (crosses(box, line.from, line.to)) cost += 2000;
    if (cost < bestCost) {
      best = side;
      bestCost = cost;
    }
  }
  return best;
}
