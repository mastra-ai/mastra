export const BOARD_LAYOUTS = ['board', 'list'] as const;
export type BoardLayout = (typeof BOARD_LAYOUTS)[number];

export const DEFAULT_BOARD_LAYOUT: BoardLayout = 'board';
