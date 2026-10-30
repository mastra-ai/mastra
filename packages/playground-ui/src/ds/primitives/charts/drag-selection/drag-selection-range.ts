/** Inclusive data indices, ordered: `start <= end`. */
export type DragSelectionRange = { start: number; end: number };

/**
 * How the x-axis places points. `band`: each point owns an equal slot (bar charts).
 * `point`: points sit on the slot edges, first and last on the plot edges (line and area charts).
 */
export type DragSelectionLayout = 'band' | 'point';

export type DragSelectionBox = { x: number; y: number; width: number; height: number };

export const orderedRange = (a: number, b: number): DragSelectionRange => ({
  start: Math.min(a, b),
  end: Math.max(a, b),
});

/** The data index under the pointer, from the payload Recharts passes to chart mouse handlers. */
export function activeIndex(state: { activeTooltipIndex?: unknown } | undefined): number | undefined {
  const index = state?.activeTooltipIndex;
  return index === undefined || index === null ? undefined : Number(index);
}

/**
 * The full-height box over the selected points of a category axis with `count` points. Uses index
 * math rather than the axis scale: category labels (e.g. clock times across days) can repeat.
 */
export function selectionBandBox(
  range: DragSelectionRange,
  count: number,
  area: DragSelectionBox,
  layout: DragSelectionLayout = 'band',
): DragSelectionBox | undefined {
  if (count <= 0) return undefined;
  const right = area.x + area.width;
  let from: number;
  let to: number;
  if (layout === 'band') {
    const slot = area.width / count;
    from = area.x + range.start * slot;
    to = area.x + (range.end + 1) * slot;
  } else if (count === 1) {
    from = area.x;
    to = right;
  } else {
    const step = area.width / (count - 1);
    from = Math.max(area.x, area.x + (range.start - 0.5) * step);
    to = Math.min(right, area.x + (range.end + 0.5) * step);
  }
  return { x: from, y: area.y, width: to - from, height: area.height };
}
