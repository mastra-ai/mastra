import { cva } from 'class-variance-authority';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { ScrollArea } from '@/ds/components/ScrollArea/scroll-area';
import type { ScrollAreaMask, ScrollAreaProps } from '@/ds/components/ScrollArea/scroll-area';
import { cn } from '@/lib/utils';

/**
 * Visual treatment for the whole list.
 *
 * Both are borderless and full-bleed, with a contrasting sticky header band and
 * no row separators. `striped` adds a zebra tint to every other row; `plain`
 * leaves rows transparent so only hover and selection tint them.
 */
export type DataListVariant = 'striped' | 'plain';

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
export type DataListStickyHeaderBackground = 'tinted' | 'surface' | 'transparent';
type DataListStickyHeaderBackgroundValue = { background: string; hoverBackground: string };

export type DataListRootProps = Omit<ScrollAreaProps, 'children' | 'orientation' | 'mask' | 'viewportRef'> & {
  children: ReactNode;
  columns: string;
  variant?: DataListVariant;
  /** Grid width behavior; defaults to `content` (existing horizontal-scroll sizing). */
  fit?: DataListFit;
  /**
   * Shared fill for the sticky top header and sticky row-header column.
   * `tinted` is the opaque `--surface-header` band, so sticky headers do not
   * reveal scrolled content beneath them.
   */
  stickyHeaderBackground?: DataListStickyHeaderBackground;
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

const stickyHeaderBackgroundValues = {
  tinted: {
    background: 'var(--surface-header)',
    hoverBackground: 'var(--surface-header-hover)',
  },
  surface: {
    background: 'var(--surface2)',
    hoverBackground: 'color-mix(in oklch, var(--surface2), var(--neutral6) 10%)',
  },
  transparent: {
    background: 'transparent',
    hoverBackground: 'transparent',
  },
} satisfies Record<DataListStickyHeaderBackground, DataListStickyHeaderBackgroundValue>;

type DataListRootStyle = CSSProperties & {
  '--data-list-sticky-header-background'?: string;
  '--data-list-sticky-header-hover-background'?: string;
};

function getDataListMask(mask: ScrollAreaMask | undefined): ScrollAreaMask {
  if (mask === undefined) return { top: false };
  if (typeof mask === 'object') return { top: false, ...mask };

  return mask;
}

/**
 * Root grid styling per `variant`. Kept module-private (an exported cva in a
 * `.tsx` trips react-refresh). The borderless table treatments are driven
 * entirely from the root with CSS descendant selectors on the `.data-list-top` /
 * `.data-list-row` markers - the header and row primitives stay untouched, no JS
 * per-row index:
 * - no container fill or border: rows composite over any view.
 * - `gap-y-px`: a uniform 1px gap between every grid track (header and rows).
 * - header: a contrasting band that owns its own radius, no hairline.
 * - rows: full-bleed, so the grid gap is the only spacing. Header, rows and
 *   subheader all share `rounded-lg`.
 * - striped adds translucent zebra tints with `:even`; hover & focus use `!` so
 *   they still win over root-level row styling.
 */
const borderlessTableStyles = [
  'gap-y-px',
  // A shared opaque tint gives both column headers and sticky row headers the
  // same treatment without revealing scrolled content beneath sticky surfaces.
  '[&_.data-list-top]:bg-[var(--data-list-sticky-header-background)] [&_.data-list-top]:rounded-lg',
  '[&_.data-list-row]:rounded-lg',
  '[&_.data-list-row]:hover:bg-surface-overlay-strong!',
  '[&_.data-list-row:focus-within]:bg-surface-overlay-strong!',
  '[&_.data-list-row>.data-list-sticky-start]:bg-[var(--data-list-sticky-header-background)]',
  '[&_.data-list-row>.data-list-sticky-start]:after:right-0',
  '[&_.data-list-row:hover>.data-list-sticky-start]:bg-[var(--data-list-sticky-header-hover-background)]',
  '[&_.data-list-row:focus-within>.data-list-sticky-start]:bg-[var(--data-list-sticky-header-hover-background)]',
  '[&_.data-list-top>.data-list-sticky-start]:after:right-0',
] as const;

const dataListFitClasses: Record<DataListFit, string> = {
  content: 'w-max max-w-none min-w-full',
  container: 'w-full max-w-full',
};

const dataListRootVariants = cva(cn('grid content-start', ...borderlessTableStyles), {
  variants: {
    variant: {
      striped: '[&_.data-list-row]:even:bg-surface-overlay-soft',
      plain: '',
    },
  },
  defaultVariants: {
    variant: 'plain',
  },
});

export function DataListRoot({
  children,
  columns,
  className,
  variant = 'plain',
  fit = 'content',
  stickyHeaderBackground = 'tinted',
  mask,
  scrollRef,
  ...props
}: DataListRootProps) {
  const stickyHeaderColors = stickyHeaderBackgroundValues[stickyHeaderBackground];
  const gridStyle: DataListRootStyle = {
    '--data-list-sticky-header-background': stickyHeaderColors.background,
    '--data-list-sticky-header-hover-background': stickyHeaderColors.hoverBackground,
    gridTemplateColumns: columns,
  };

  const grid = (
    <div
      // Lists scroll inside the ScrollArea viewport (below); the grid just lays out.
      className={cn(dataListRootVariants({ variant }), dataListFitClasses[fit])}
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
      viewPortClassName="max-h-[inherit]"
      className={cn('size-full', className)}
    >
      {grid}
    </ScrollArea>
  );
}
