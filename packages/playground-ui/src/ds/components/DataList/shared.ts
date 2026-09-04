/**
 * Row-level styling for the element that participates in the row sibling
 * chain — applied to `DataList.RowButton` / `DataList.RowLink` when used
 * standalone, and to `DataList.RowWrapper` when used as a shell around them.
 *
 * Carries the `.data-list-row` marker class the root styles target.
 */
export const dataListRowOuterStyles = [
  'group/data-list-row data-list-row col-span-full relative min-h-9 bg-surface2',
  'transition-colors duration-200',
] as const;

/**
 * Interactive state fills for the outer row element. Applied to standalone
 * `RowButton` / `RowLink` and to `RowWrapper`. The `has-*` forms let a wrapper
 * mirror the tone of the interactive row nested inside it.
 */
export const dataListRowStateStyles = [
  'hover:bg-surface3 active:bg-surface4',
  'data-featured:bg-surface3 has-data-featured:bg-surface3 has-data-selected:bg-surface3',
  'data-featured:hover:bg-surface4 has-data-featured:hover:bg-surface4 has-data-selected:hover:bg-surface4',
  'data-[variant=error]:bg-notice-destructive/10 has-data-[variant=error]:bg-notice-destructive/10',
] as const;

/**
 * Layout and focus for the interactive element. The background lives on the
 * outer row element so it sits inside the root surface.
 */
export const dataListRowInteractiveStyles = [
  'grid grid-cols-subgrid gap-8 px-5 cursor-pointer',
  'outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent1',
] as const;

export const dataListRowStyles = [
  ...dataListRowInteractiveStyles,
  ...dataListRowOuterStyles,
  ...dataListRowStateStyles,
] as const;

export const dataListRowStaticStyles = ['grid grid-cols-subgrid gap-8 px-5', ...dataListRowOuterStyles] as const;

/**
 * Row actions that stay out of the way until the row is hovered or focused.
 * Opacity, not display, so the column keeps its width and nothing shifts. A
 * coarse pointer never hovers, so there they stay visible — hidden controls
 * that still take taps would be worse than no reveal at all.
 */
export const dataListRowActionRevealStyles =
  'opacity-0 pointer-coarse:opacity-100 group-focus-within/data-list-row:opacity-100 group-hover/data-list-row:opacity-100';

export type DataListSticky = 'start';

export const dataListStickyStartStyles = [
  'data-list-sticky-start sticky left-0 z-10 isolate self-stretch overflow-visible',
] as const;

/** Tone for a single row. Exposed as `data-variant`; `error` tints the row. */
export type DataListRowVariant = 'default' | 'error';

/**
 * Layout/state modifiers shared by interactive row primitives
 * (`DataList.RowButton`, `DataList.RowLink`).
 */
export type DataListRowSharedProps = {
  /** Row tone — exposed on the element as `data-variant`. */
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
   * Mark the row as featured (e.g. the row whose detail is open in a side
   * panel). Exposed on the element as `data-featured` and tints the row.
   */
  featured?: boolean;
};
