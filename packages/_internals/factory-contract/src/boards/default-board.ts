/**
 * Board a card belongs to when nothing names one: rows written before boards were persisted, and
 * new cards before the project's intake routes place them. Every project is seeded with it (the
 * Work board) and its default routes name it; nothing else about it is special.
 */
export const DEFAULT_BOARD_ID = 'work';
