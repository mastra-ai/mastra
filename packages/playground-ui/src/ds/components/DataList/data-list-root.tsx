import type { CSSProperties, ReactNode, RefObject } from 'react';
import { ScrollArea } from '@/ds/components/ScrollArea/scroll-area';
import type { ScrollAreaMask, ScrollAreaProps } from '@/ds/components/ScrollArea/scroll-area';
import { cn } from '@/lib/utils';

/**
 * Horizontal sizing of the list grid.
 *
 * - `content`: the grid is as wide as its widest content (`w-max`) and the
 *   ScrollArea scrolls horizontally when it exceeds the container.
 * - `container`: the grid fills the container width and never exceeds it;
 *   flexible tracks (`minmax(0, 1fr)`) shrink so truncating cells ellipsize
 *   instead of widening the table.
 */
export type DataListFit = 'content' | 'container';

/**
 * Surface treatment of the list.
 *
 * - `default`: rows sit on a rounded `surface4` panel.
 * - `light`: no panel behind the rows; rows sit directly on the page.
 */
export type DataListVariant = 'default' | 'light';

export type DataListRootProps = Omit<ScrollAreaProps, 'children' | 'orientation' | 'mask' | 'viewportRef'> & {
  children: ReactNode;
  columns: string;
  /** Grid width behavior; defaults to `content` (existing horizontal-scroll sizing). */
  fit?: DataListFit;
  /** Surface treatment; defaults to `default` (rows on a `surface4` panel). */
  variant?: DataListVariant;
  /**
   * Edge fades from the underlying ScrollArea. DataList keeps the top fade off
   * by default so it does not fade the sticky top header.
   */
  mask?: ScrollAreaMask;
  /**
   * Ref to the scroll container — pass this to TanStack Virtual's
   * `getScrollElement` when virtualizing. Without it, the ScrollArea viewport
   * scrolls normally.
   */
  scrollRef?: RefObject<HTMLDivElement | null>;
};

type DataListRootStyle = CSSProperties & {
  '--data-list-background'?: string;
};

function getDataListMask(mask: ScrollAreaMask | undefined): ScrollAreaMask {
  if (mask === undefined) return { top: false };
  if (typeof mask === 'object') return { top: false, ...mask };

  return mask;
}

/**
 * The root owns the unified table treatment so standalone and wrapped rows look
 * identical without requiring a per-row index. The ScrollArea provides the
 * fixed frame; this grid paints the sticky header and separators. The root is
 * the only element that defines a color: sticky parts read the background
 * through `--data-list-background` so they stay opaque while scrolling, and
 * rows/header draw no separators, borders or rings of their own.
 */
const dataListGridStyles = [
  'gap-y-px',
  // Rows are siblings of the header, so first/last are found via sibling combinators.
  '[&_.data-list-row:not(.data-list-row~.data-list-row)]:rounded-t-lg',
  '[&_.data-list-row:not(:has(~.data-list-row))]:rounded-b-lg',
  '[&_.data-list-row:not(.data-list-row~.data-list-row)>.data-list-sticky-start]:rounded-tl-lg',
  '[&_.data-list-row:not(:has(~.data-list-row))>.data-list-sticky-start]:rounded-bl-lg',
  // Subheaders split the rows into sections; each section gets its own rounded ends.
  '[&_.data-list-subheader+.data-list-row]:rounded-t-lg',
  '[&_.data-list-row:has(+.data-list-subheader)]:rounded-b-lg',
  '[&_.data-list-subheader+.data-list-row>.data-list-sticky-start]:rounded-tl-lg',
  '[&_.data-list-row:has(+.data-list-subheader)>.data-list-sticky-start]:rounded-bl-lg',
  '[&_.data-list-top]:bg-(--data-list-background)',
  '[&_.data-list-row>.data-list-sticky-start]:bg-surface2',
  '[&_.data-list-row>.data-list-sticky-start]:after:right-0',
  '[&_.data-list-top>.data-list-sticky-start]:after:right-0',
] as const;

const dataListVariantClasses: Record<DataListVariant, string> = {
  default: 'bg-surface4',
  light: '',
};

// The sticky header reads this so it stays opaque while scrolling: the panel
// color by default, the page surface when there is no panel.
const dataListVariantBackground: Record<DataListVariant, string> = {
  default: 'var(--surface4)',
  light: 'var(--surface1)',
};

const dataListFitClasses: Record<DataListFit, string> = {
  content: 'w-max max-w-none min-w-full',
  container: 'w-full max-w-full',
};

export function DataListRoot({
  children,
  columns,
  className,
  fit = 'content',
  variant = 'default',
  mask,
  scrollRef,
  ...props
}: DataListRootProps) {
  const gridStyle: DataListRootStyle = {
    '--data-list-background': dataListVariantBackground[variant],
    gridTemplateColumns: columns,
  };

  const grid = (
    <div
      // Lists scroll inside the ScrollArea viewport (below); the grid just lays out.
      className={cn('grid content-start', ...dataListGridStyles, dataListFitClasses[fit])}
      style={gridStyle}
    >
      {children}
    </div>
  );

  // DataList uses the DS ScrollArea: an overlay scrollbar, so the sticky header
  // spans the full width. Masks default to every overflowing edge except the
  // top — a top fade would fade the opaque sticky header. A virtualizing list
  // passes `scrollRef`, forwarded as `viewportRef` so it scrolls this viewport.
  return (
    <ScrollArea
      {...props}
      orientation="both"
      mask={getDataListMask(mask)}
      viewportRef={scrollRef}
      // Outer radius = row radius (8px) + 4px inset so the corners stay concentric.
      // Size to content but never exceed the parent. Flex (unlike grid `1fr`) lays
      // items out against the max-height-clamped container, so short lists stay
      // compact and long ones shrink the viewport and scroll. `self-start` stops
      // a grid/flex parent from stretching the root to the full row height.
      viewPortClassName="min-h-0 flex-1 basis-auto"
      className={cn(
        'flex max-h-full w-full flex-col self-start rounded-xl px-1 pb-1',
        dataListVariantClasses[variant],
        className,
      )}
    >
      {grid}
    </ScrollArea>
  );
}
