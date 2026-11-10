/**
 * Board a card belongs to when nothing names one: rows written before boards were persisted, and
 * cards filed without a route, label route or intake binding. Every project is seeded with it (the
 * Work board); nothing else about it is special.
 */
export const DEFAULT_BOARD_ID = 'work';
