import type { BoardPhasesRequest } from '../../../api/types';
import { BOARD_FILTER_FIELDS } from './boardFilters';
import type { BoardFilterState } from './boardFilters';
import type { BoardSort } from './boardSort';

/** How many cards the server lists in a phase the request names no window for. */
const PHASE_PAGE = 50;
/** The deepest window the server accepts. */
const DEEPEST_PHASE_WINDOW = 999_999;
/** The longest search the server accepts. */
const LONGEST_SEARCH = 200;
const CARD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether `text` is a card id. The server refuses a card named by anything else, and nothing else names one. */
export function isCardId(text: string): boolean {
  return CARD_ID.test(text);
}

/**
 * What the server is asked to list a board view. The page and the route loader both build it here,
 * so the loader's read is the one the page then waits for.
 */
export function boardPhasesRequest({
  board,
  sort,
  search,
  filters,
  windows,
  item,
}: {
  board: string;
  sort: BoardSort;
  search: string;
  /** As links and saved views store them: every id a picked person stands for. */
  filters: BoardFilterState;
  /** How many cards each deepened phase lists. */
  windows: Readonly<Record<string, number>>;
  /** The card a link names, to show however deep its phase holds it. */
  item: string | undefined;
}): BoardPhasesRequest {
  const picked: BoardPhasesRequest['filters'] = {};
  for (const filter of BOARD_FILTER_FIELDS) {
    if (filters[filter].size > 0) picked[filter] = [...filters[filter]].sort();
  }
  return {
    board,
    sort,
    q: search.trim().slice(0, LONGEST_SEARCH),
    filters: picked,
    windows,
    ...(item !== undefined && isCardId(item) ? { item } : {}),
  };
}

/** The window that lists a phase twice as deep as the `listed` cards it shows. */
export function deeperPhaseWindow(listed: number): number {
  return Math.min(Math.max(listed, PHASE_PAGE) * 2, DEEPEST_PHASE_WINDOW);
}
