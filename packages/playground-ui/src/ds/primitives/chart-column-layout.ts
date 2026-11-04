/**
 * Geometry for bar columns, so small values never draw as an unreadable sliver.
 *
 * A non-zero value always gets at least `minSize` pixels; a zero gets nothing. In a stack the
 * extra height is taken from the segments that can spare it, so the column keeps its true
 * height. A column too short to hold every segment at the minimum grows just enough to (one
 * request next to a 3,000-request peak still shows as a few pixels, not half of one).
 */

/** Smallest height a non-zero bar or stacked segment is drawn at. */
export const CHART_MIN_SEGMENT = 3;

export type SegmentBox = { y: number; height: number };

/** A drawable amount: missing, negative and non-finite values count as zero. */
const amount = (v: number | undefined) => (v !== undefined && Number.isFinite(v) && v > 0 ? v : 0);

/**
 * Lays out one stacked column and returns the box of segment `self`, or `undefined` when its value is
 * zero. `geo` is the box Recharts computed for that segment (its true y and height); segments
 * stack bottom to top in `values` order with `gap` pixels between them.
 */
export function stackedSegmentBox(
  values: number[],
  self: number,
  geo: SegmentBox,
  { gap = 0, minSize = CHART_MIN_SEGMENT }: { gap?: number; minSize?: number } = {},
): SegmentBox | undefined {
  const amounts = values.map(amount);
  const value = amounts[self] ?? 0;
  if (!(value > 0) || !Number.isFinite(geo.y) || !Number.isFinite(geo.height)) return undefined;
  // Pixels per unit, from this segment's own box; every segment shares the scale.
  const ppu = geo.height / value;
  const below = amounts.slice(0, self).reduce((sum, v) => sum + v, 0);
  const bottom = geo.y + geo.height + below * ppu;
  const live = amounts.flatMap((v, i) => (v > 0 ? [i] : []));
  const total = amounts.reduce((sum, v) => sum + v, 0) * ppu;
  const gaps = gap * (live.length - 1);
  const h = (i: number) => heights[i] ?? 0;
  const heights = amounts.map(v => (v > 0 && total > 0 ? Math.max((v * ppu * (total - gaps)) / total, 0) : 0));
  const small = live.filter(i => h(i) < minSize);
  const large = live.filter(i => h(i) >= minSize);
  const deficit = small.reduce((sum, i) => sum + minSize - h(i), 0);
  const spare = large.reduce((sum, i) => sum + h(i) - minSize, 0);
  for (const i of small) heights[i] = minSize;
  for (const i of large) {
    // Take the deficit from the larger segments, in proportion to what each can spare. When
    // they can't spare enough, every segment sits at the minimum and the column grows to fit.
    heights[i] = spare >= deficit ? h(i) - (spare > 0 ? ((h(i) - minSize) / spare) * deficit : 0) : minSize;
  }
  let top = bottom;
  for (const i of live) {
    top -= h(i);
    if (i === self) return { y: top, height: h(i) };
    top -= gap;
  }
  return undefined;
}

/** A single (unstacked) bar: grows up from its base to `minSize` when its value is tiny. */
export function singleBarBox(
  value: number,
  geo: SegmentBox,
  { minSize = CHART_MIN_SEGMENT }: { minSize?: number } = {},
): SegmentBox | undefined {
  if (!(amount(value) > 0) || !Number.isFinite(geo.y) || !Number.isFinite(geo.height)) return undefined;
  if (geo.height >= minSize) return geo;
  return { y: geo.y + geo.height - minSize, height: minSize };
}
