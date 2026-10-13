export const BOARD_LAYOUTS = ['board', 'list'] as const;
export type BoardLayout = (typeof BOARD_LAYOUTS)[number];

export const DEFAULT_BOARD_LAYOUT: BoardLayout = 'board';

export const SKELETON_ROW_CLASS: Record<BoardLayout, string> = { board: 'h-24 w-full', list: 'h-10 w-full' };
