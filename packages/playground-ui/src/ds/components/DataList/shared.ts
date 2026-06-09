/**
 * Row-level styling shared by anything that participates in the row sibling
 * chain — applied to `DataList.RowButton` / `DataList.RowLink` when used
 * standalone, and to `DataList.RowWrapper` when used as a wrapper around them.
 *
 * Contains the `.data-list-row` marker class (used by the sibling-aware
 * separator rules), the full-width separator treatment, and rounded corners.
 */
export const dataListRowOuterStyles = [
  'data-list-row col-span-full relative mt-1 mb-[3px]',
  'after:absolute after:inset-x-[-0.25rem] after:bottom-[-0.25rem] after:h-px after:bg-border1 after:content-[""] after:pointer-events-none',
  '[&:has(+.data-list-subheader)]:after:hidden [&:not(:has(~.data-list-row))]:after:hidden',
  'transition-colors duration-200 rounded-lg',
] as const;

export const dataListRowStyles = [
  'mx-1 grid grid-cols-subgrid gap-8 px-5 outline-none cursor-pointer',
  'hover:bg-surface4 focus-visible:bg-surface4 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent1',
  ...dataListRowOuterStyles,
] as const;

/**
 * Layout/state modifiers shared by interactive row primitives
 * (`DataList.RowButton`, `DataList.RowLink`).
 */
export type DataListRowSharedProps = {
  /**
   * Drop the row's default left margin. Use when the row is wrapped in a
   * `DataList.RowWrapper` that owns the leading inset (e.g. for selection rows where
   * the checkbox cell sits on the left).
   */
  flushLeft?: boolean;
  /**
   * Drop the row's default right margin. Use when the row is wrapped in a
   * `DataList.RowWrapper` that owns the trailing inset (e.g. for rows with a
   * trailing actions cell on the right).
   */
  flushRight?: boolean;
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
