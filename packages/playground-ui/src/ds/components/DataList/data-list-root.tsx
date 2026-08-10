import { cva } from 'class-variance-authority';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { ScrollArea } from '@/ds/components/ScrollArea/scroll-area';
import type { ScrollAreaMask, ScrollAreaProps } from '@/ds/components/ScrollArea/scroll-area';
import { cn } from '@/lib/utils';

/**
 * Visual treatment for the whole list.
 *
 * - `striped`: borderless and full-bleed, zebra-striped rows (every other row
 *   tinted), contrasting sticky header band, no row separators.
 * - `lined`: borderless and full-bleed like `striped`, but rows stay transparent
 *   and use subtle separators instead of zebra tints.
 */
export type DataListVariant = 'striped' | 'lined';

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
   * `tinted` is an opaque equivalent of the former `neutral6/10` tint, so sticky
   * headers do not reveal scrolled content beneath them.
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
    background: 'color-mix(in oklch, var(--surface1), var(--neutral6) 10%)',
    hoverBackground: 'color-mix(in oklch, var(--surface1), var(--neutral6) 14%)',
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
 * - header: a contrasting band that owns the radius (the container no longer
 *   rounds/clips) — `rounded-t-xl` top, `rounded-b-md` bottom to match the rows
 *   sitting below the 1px gap, no hairline.
 * - rows: full-bleed, `rounded-md` (last row included); rows zero
 *   their own margins so the grid gap is the only spacing.
 * - striped adds translucent zebra tints with `:even`; hover & focus use `!` so
 *   they still win over root-level row styling.
 */
const borderlessTableStyles = [
  'gap-y-px',
  // A shared opaque tint gives both column headers and sticky row headers the
  // same treatment without revealing scrolled content beneath sticky surfaces.
  '[&_.data-list-top]:mx-0 [&_.data-list-top]:bg-[var(--data-list-sticky-header-background)] [&_.data-list-top]:after:hidden',
  '[&_.data-list-top]:rounded-t-xl [&_.data-list-top]:rounded-b-md',
  // header column separators: a short, faint vertical line centered in the gap
  // to the left of every header cell but the first. A `before` pseudo (not a
  // `border-l` + padding) keeps header text aligned with the row cells below.
  // The cell's default `overflow-hidden` would clip a gap-positioned pseudo, so
  // these cells switch to `overflow-visible`; the title text still truncates via
  // its inner `truncate` span, so nothing else spills.
  '[&_.data-list-top>*:not(:first-child)]:relative [&_.data-list-top>*:not(:first-child)]:overflow-visible',
  '[&_.data-list-top>*:not(:first-child)]:before:absolute [&_.data-list-top>*:not(:first-child)]:before:-left-4 [&_.data-list-top>*:not(:first-child)]:before:top-1/2 [&_.data-list-top>*:not(:first-child)]:before:-translate-y-1/2 [&_.data-list-top>*:not(:first-child)]:before:h-4 [&_.data-list-top>*:not(:first-child)]:before:w-px [&_.data-list-top>*:not(:first-child)]:before:bg-border2 [&_.data-list-top>*:not(:first-child)]:before:content-[""]',
  '[&_.data-list-row]:mx-0 [&_.data-list-row]:my-0 [&_.data-list-row]:rounded-md',
  '[&_.data-list-row]:hover:bg-surface-overlay-strong!',
  '[&_.data-list-row]:focus-visible:bg-surface-overlay-strong!',
  '[&_.data-list-row>.data-list-sticky-start]:bg-[var(--data-list-sticky-header-background)]',
  '[&_.data-list-row>.data-list-sticky-start]:after:right-0',
  '[&_.data-list-row:hover>.data-list-sticky-start]:bg-[var(--data-list-sticky-header-hover-background)]',
  '[&_.data-list-row:focus-visible>.data-list-sticky-start]:bg-[var(--data-list-sticky-header-hover-background)]',
  '[&_.data-list-row:focus-within>.data-list-sticky-start]:bg-[var(--data-list-sticky-header-hover-background)]',
  '[&_.data-list-top>.data-list-sticky-start]:after:right-0',
  '[&_.data-list-top>.data-list-sticky-start+*]:before:hidden',
] as const;

const dataListFitClasses: Record<DataListFit, string> = {
  content: 'w-max max-w-none min-w-full',
  container: 'w-full max-w-full',
};

const dataListRootVariants = cva(cn('grid content-start'), {
  variants: {
    variant: {
      striped: cn(
        ...borderlessTableStyles,
        '[&_.data-list-row]:after:hidden',
        '[&_.data-list-row]:even:bg-surface-overlay-soft',
      ),
      lined: cn(
        ...borderlessTableStyles,
        '[&_.data-list-row]:after:pointer-events-none [&_.data-list-row]:after:absolute [&_.data-list-row]:after:h-px [&_.data-list-row]:after:content-[""]',
        '[&_.data-list-row]:after:inset-x-2 [&_.data-list-row]:after:-bottom-px [&_.data-list-row]:after:bg-neutral6/10',
      ),
    },
  },
  defaultVariants: {
    variant: 'lined',
  },
});

export function DataListRoot({
  children,
  columns,
  className,
  variant = 'lined',
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

  // DataList uses the DS ScrollArea: an overlay scrollbar (no reserved gutter,
  // so the sticky header spans the full width and both top corners clip cleanly)
  // plus the default edge fades. When the list virtualizes it passes a
  // `scrollRef`; forwarding it as `viewportRef` makes the virtualizer scroll
  // this viewport.
  //
  // `rounded-t-xl` clips the viewport top. Masks default to every overflowing
  // edge except the top — a top fade would fade the opaque sticky header.
  return (
    <ScrollArea
      {...props}
      orientation="both"
      mask={getDataListMask(mask)}
      viewportRef={scrollRef}
      viewPortClassName="max-h-[inherit]"
      className={cn('size-full rounded-t-xl', className)}
    >
      {grid}
    </ScrollArea>
  );
}
