import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

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

const line = 'pointer-events-none absolute border-l border-border-strong';

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
 * Lines meet end to end (rows never overlap, and the elbow is one path), so the translucent border
 * colour never doubles up into darker spots.
 */
export function SpanTreeRail({ depth, guides, isLastChild, hasStem }: SpanTreeRailProps) {
  const x = (col: number) => col * SPAN_TREE_INDENT + SPAN_TREE_INDENT / 2;
  const parts: ReactNode[] = [];

  guides.forEach((show, col) => {
    if (show)
      parts.push(
        <span
          key={`guide-${col}`}
          data-testid="span-tree-guide"
          className={cn(line, 'top-0 -bottom-px')}
          style={{ left: x(col) }}
        />,
      );
  });

  if (depth > 0) {
    // Elbow, plus the trunk down to the badge's centre when siblings follow, as one stroked path:
    // overlapping parts of a single path paint once.
    const cx = x(depth - 1) + 0.5;
    const cy = MID + 0.5;
    const end = x(depth) - BADGE_HALF - GAP;
    const d =
      `M${cx} 0V${MID - RADIUS}Q${cx} ${cy} ${cx + RADIUS} ${cy}H${end}` + (isLastChild ? '' : `M${cx} 0V${MID}`);
    parts.push(
      <svg key="elbow" className="pointer-events-none absolute top-0 left-0 overflow-visible" width="1" height="1">
        <path d={d} fill="none" stroke="var(--border-strong)" strokeWidth={1} />
      </svg>,
    );
    // Below the badge the trunk is a plain border, starting exactly where the path stops.
    if (!isLastChild)
      parts.push(<span key="trunk" className={cn(line, '-bottom-px')} style={{ left: x(depth - 1), top: MID }} />);
  }

  if (hasStem)
    parts.push(
      <span key="stem" className={cn(line, '-bottom-px')} style={{ left: x(depth), top: MID + BADGE_HALF + GAP }} />,
    );

  return (
    <span aria-hidden className="pointer-events-none absolute inset-y-0 left-1">
      {parts}
    </span>
  );
}
