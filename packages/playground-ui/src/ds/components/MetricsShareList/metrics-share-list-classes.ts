export const ROW = '-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-md px-2 py-1 text-left';
export const NUM = 'shrink-0 text-right text-body-sm tabular-nums';

/**
 * The label column's width when left-aligned text columns follow it: fixed, so they sit right beside
 * the label and a spacer pushes the number columns to the right edge. Otherwise the label takes the
 * free space. It gives way first when the row is tight, down to `min-w-32`.
 */
export const FIXED_LABEL = 'w-56 min-w-32 shrink';
