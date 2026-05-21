export const dataListRowStyles = [
  'mx-1 data-list-row grid grid-cols-subgrid gap-8 col-span-full px-5 outline-none cursor-pointer border-y border-b-border1 border-t-transparent',
  'hover:bg-surface4 hover:border-transparent focus-visible:bg-surface4 focus-visible:border-transparent focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent1',
  '[.data-list-row:hover+&]:border-t-transparent [.data-list-row:focus-visible+&]:border-t-transparent',
  '[.data-list-subheader+&]:border-t-transparent',
  '[&:has(+.data-list-subheader)]:border-b-transparent',
  '[&:not(:has(~.data-list-row))]:border-b-transparent',
  'transition-colors duration-200 rounded-lg',
] as const;

/**
 * Layout/state modifiers shared by interactive row primitives
 * (`DataList.RowButton`, `DataList.RowLink`).
 */
export type DataListRowSharedProps = {
  /**
   * Drop the row's default left margin. Use when the row is wrapped in a
   * `DataList.Row` that owns the leading inset (e.g. for selection rows where
   * the checkbox cell sits on the left).
   */
  flushLeft?: boolean;
  /**
   * Place the row starting at this column line, spanning through to the last
   * column. Defaults to the full grid (`col-span-full`). Use when the row
   * sits beside a leading cell that owns column 1.
   */
  colStart?: number;
  /**
   * Apply the highlighted background. Use to mark the row that is currently
   * featured (e.g. the row whose detail is open in a side panel).
   */
  featured?: boolean;
};
