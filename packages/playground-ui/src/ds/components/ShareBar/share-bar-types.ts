import type { ElementType, ReactNode } from 'react';

export type ShareBarRow = {
  /** Stable id, also used to link a row to its bar segment. */
  key: string;
  /** Row label: plain text, or richer content (e.g. a method and a path). */
  label: ReactNode;
  /** Full text of a label that may truncate, shown on hover. Defaults to `label` when it's a string. */
  title?: string;
  /** The measure the bar divides (requests, cost, time spent). Rows rank by it, largest first. */
  share: number;
  /** The main, right-most column, usually `share` formatted. */
  value: ReactNode;
  /** Extra columns before Share, in `columns` order. */
  cells?: ReactNode[];
  /** The row's own colour (e.g. one a project keeps across cards), instead of one from the palette. */
  color?: string;
  /** Drill-down for the whole row. */
  href?: string;
  /** Row action (e.g. filter the page to this row); the row renders as a button. */
  onClick?: () => void;
};

export type ShareBarColumn = {
  label: string;
  /** Tailwind width class, shared by the header and the cells. Default `w-16`. */
  width?: string;
};

export type ShareBarProps = {
  rows: ShareBarRow[];
  /** Extra columns before Share, in the rows' `cells` order. */
  columns?: ShareBarColumn[];
  /** Header of the main column. */
  valueLabel: string;
  /** Tailwind width class of the main column. Default `w-14`. */
  valueWidth?: string;
  /**
   * Row colors, from `color` (the first row) on.
   * - `shades`: one hue fading down the ranking. Reads well up to about six rows.
   * - `hues`: five cool hues, lighter each round. For long lists.
   */
  palette?: 'shades' | 'hues';
  /** Color of the first row. Default: brand green. */
  color?: string;
  /** Rows shown before the rest folds or pages. Default 5. */
  limit?: number;
  /**
   * What happens to rows past `limit`.
   * - `other`: one gray "Other (N)" row sums them.
   * - `more`: a "Show more" row pages them in.
   */
  overflow?: 'other' | 'more';
  /** Rows each "Show more" adds. Default 50. */
  pageSize?: number;
  /** Main value and extra cells of the "Other" row, from the rows folded into it. */
  other?: (rest: ShareBarRow[]) => Pick<ShareBarRow, 'value' | 'cells'>;
  /** Shown when there are no rows. */
  emptyState?: ReactNode;
  /** Skeleton rows in the bar's own markup, so the card keeps its height when data lands. */
  isLoading?: boolean;
  /** Router-aware link for `href` rows; plain `<a>` when omitted. */
  LinkComponent?: ElementType;
  className?: string;
};
