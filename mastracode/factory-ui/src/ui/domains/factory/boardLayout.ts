export const BOARD_LAYOUTS = ['board', 'list'] as const;
export type BoardLayout = (typeof BOARD_LAYOUTS)[number];

export const DEFAULT_BOARD_LAYOUT: BoardLayout = 'list';

export const BOARD_LAYOUT_QUERY = 'layout';

function isBoardLayout(value: string): value is BoardLayout {
  return BOARD_LAYOUTS.some(layout => layout === value);
}

export function boardLayoutFromParams(params: URLSearchParams): BoardLayout {
  const value = params.get(BOARD_LAYOUT_QUERY);
  return value && isBoardLayout(value) ? value : DEFAULT_BOARD_LAYOUT;
}

export function boardLayoutParams(current: URLSearchParams, layout: BoardLayout): URLSearchParams {
  const next = new URLSearchParams(current);
  if (layout === DEFAULT_BOARD_LAYOUT) next.delete(BOARD_LAYOUT_QUERY);
  else next.set(BOARD_LAYOUT_QUERY, layout);
  return next;
}

/** Shared with loading placeholders so cards and rows occupy the same space. */
export const BOARD_CARD_LAYOUT_CLASS =
  'relative flex min-h-36 flex-col gap-3 rounded-card border border-surface-rim bg-fill-subtle p-2';

export const BOARD_LIST_ROW_LAYOUT_CLASS =
  'grid min-h-10 grid-cols-[auto_5rem_minmax(0,1fr)_var(--spacing-avatar-sm)_3.5rem] items-center gap-x-3 rounded-lg px-3 py-1 max-sm:grid-cols-[auto_minmax(0,1fr)_auto] max-sm:gap-y-1 max-sm:py-2';

export const BOARD_SCROLL_SURFACE_CLASS =
  '[container-type:inline-size] m-px min-h-0 min-w-0 flex-1 [scrollbar-gutter:stable] overflow-auto overscroll-x-contain rounded-[calc(var(--studio-frame-radius,1.5rem)-1px)] lg:overscroll-x-auto';
