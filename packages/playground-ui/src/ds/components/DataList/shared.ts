/**
 * Row-level styling for the element that participates in the row sibling
 * chain — applied to `DataList.RowButton` / `DataList.RowLink` when used
 * standalone, and to `DataList.RowWrapper` when used as a shell around them.
 *
 * Carries the `.data-list-row` marker class the root styles target.
 */
export const dataListRowOuterStyles = [
  'group/data-list-row data-list-row col-span-full relative min-h-9',
  'transition-colors duration-200 rounded-lg',
] as const;

/**
 * Layout + focus ring only. The root paints the hover/focus fill on
 * `.data-list-row`, so a wrapped row and its button never show two tints.
 */
export const dataListRowInteractiveStyles = [
  'grid grid-cols-subgrid gap-8 px-5 outline-none cursor-pointer',
  'focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent1',
  'transition-colors duration-200 rounded-lg',
] as const;

export const dataListRowStyles = [...dataListRowInteractiveStyles, ...dataListRowOuterStyles] as const;

export const dataListRowStaticStyles = ['grid grid-cols-subgrid gap-8 px-5', ...dataListRowOuterStyles] as const;

/**
 * Row controls that stay out of the way until the row is hovered or focused.
 * Opacity, not display, so the column keeps its width and nothing shifts. A
 * coarse pointer never hovers, so there they stay visible — hidden controls
 * that still take taps would be worse than no reveal at all.
 */
export const dataListRowRevealStyles =
  'opacity-0 pointer-coarse:opacity-100 group-focus-within/data-list-row:opacity-100 group-hover/data-list-row:opacity-100';

/** Header counterpart of {@link dataListRowRevealStyles}. */
export const dataListTopRevealStyles =
  'opacity-0 pointer-coarse:opacity-100 group-focus-within/data-list-top:opacity-100 group-hover/data-list-top:opacity-100';

import { cva } from 'class-variance-authority';

export type DataListSticky = 'start';

export const dataListStickyStartStyles = [
  'data-list-sticky-start sticky left-0 z-10 isolate self-stretch overflow-visible',
  'after:absolute after:-right-4 after:top-1/2 after:-translate-y-1/2 after:h-4 after:w-px after:bg-border2 after:content-[""] after:pointer-events-none',
] as const;

/** Tone for a single row. `error` lays a subtle, theme-aware destructive tint
 *  over whatever background the row already has. */
export type DataListRowVariant = 'default' | 'error';

/**
 * Per-row tone. Kept as a `.ts` cva (safe to export — no react-refresh concern).
 * The error tint uses `!` so it wins over borderless table root-level styling
 * (higher-specificity descendant rules) and over the base row hover.
 */
export const dataListRowVariants = cva('', {
  variants: {
    variant: {
      default: '',
      error: 'bg-notice-destructive/10! hover:bg-notice-destructive/15!',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

/**
 * Layout/state modifiers shared by interactive row primitives
 * (`DataList.RowButton`, `DataList.RowLink`).
 */
export type DataListRowSharedProps = {
  /** Row tone — `error` applies a subtle destructive background tint. */
  variant?: DataListRowVariant;
  /**
   * Place the row starting at this column line. Defaults to column 1. Use
   * when the row sits beside a leading cell that owns column 1.
   */
  colStart?: number;
  /**
   * Place the row ending at this column line (use negative values to count
   * from the end, e.g. `-2`). Defaults to `-1` (the last line). Use when the
   * row sits beside a trailing cell that owns the last column.
   */
  colEnd?: number;
  /**
   * Apply the highlighted background. Use to mark the row that is currently
   * featured (e.g. the row whose detail is open in a side panel).
   */
  featured?: boolean;
};
