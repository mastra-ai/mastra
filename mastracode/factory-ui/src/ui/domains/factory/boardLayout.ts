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

export const SKELETON_ROW_CLASS: Record<BoardLayout, string> = { board: 'h-24 w-full', list: 'h-10 w-full' };
