import type { ReactNode } from 'react';

/** Width of one nesting level; a row's badge sits centred in column `depth`. */
export const SPAN_TREE_INDENT = 24;
/** Vertical padding of a tree row. */
export const SPAN_TREE_PAD_Y = 4.5;
/** Height of the name line; the badge and the elbow centre on it. */
export const SPAN_TREE_LINE = 20;

const BADGE_HALF = 10;
const GAP = 2;
const RADIUS = 8;
const MID = SPAN_TREE_PAD_Y + SPAN_TREE_LINE / 2;

/** Gap between the name line and the duration line; with the padding, rows land on whole pixels (46px). */
export const SPAN_TREE_META_GAP = 1;

/**
 * `--border-strong` is the neutral tint at 19% alpha. Every line is drawn at full strength in one SVG and
 * the 19% is applied once to the whole rail, so a pixel two lines share (a join, a half-pixel end) is
 * painted once and never comes out brighter or darker than the line.
 */
const railStyle = { color: 'oklch(var(--fill-tint) 0 0)', opacity: 0.19 };

type SpanTreeRailProps = {
  depth: number;
  /** Per ancestor level (shallowest first): whether that level's connector continues past this row. */
  guides: boolean[];
  isLastChild?: boolean;
  /** Draw the line from this row's badge down to its children. */
  hasStem?: boolean;
};

/**
 * Tree connectors of one span row, drawn over the row's left edge: a guide per ancestor level that
 * continues, a rounded elbow from the parent's line into the badge, and a stem down to the children.
 * Vertical lines run 1px past the row to bridge the gap to the next one.
 */
export function SpanTreeRail({ depth, guides, isLastChild, hasStem }: SpanTreeRailProps) {
  // +0.5 centres a 1px stroke on a pixel column so vertical lines stay crisp.
  const x = (col: number) => col * SPAN_TREE_INDENT + SPAN_TREE_INDENT / 2 + 0.5;
  const parts: ReactNode[] = [];
  const vertical = (key: string, col: number, top: number, testId?: string) => (
    <line key={key} data-testid={testId} x1={x(col)} x2={x(col)} y1={top} y2="100%" />
  );

  guides.forEach((show, col) => {
    if (show) parts.push(vertical(`guide-${col}`, col, 0, 'span-tree-guide'));
  });

  if (depth > 0) {
    const cx = x(depth - 1);
    const end = x(depth) - 0.5 - BADGE_HALF - GAP;
    // Rounded elbow from the top of the row into the badge; later siblings keep the trunk going.
    parts.push(
      <path key="elbow" d={`M${cx} 0V${MID - RADIUS}Q${cx} ${MID} ${cx + RADIUS} ${MID}H${end}`} fill="none" />,
    );
    if (!isLastChild) parts.push(vertical('trunk', depth - 1, 0));
  }

  if (hasStem) parts.push(vertical('stem', depth, MID + BADGE_HALF + GAP));

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute top-0 left-1 h-[calc(100%+1px)] w-full overflow-visible"
      stroke="currentColor"
      strokeWidth={1}
      style={railStyle}
    >
      {parts}
    </svg>
  );
}
