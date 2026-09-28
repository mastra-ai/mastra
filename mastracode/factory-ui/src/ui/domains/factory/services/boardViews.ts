/**
 * Board view persistence: the filters and sort last used on each board, so reopening a board from
 * the sidebar brings them back. The URL stays the source of truth; this only refills it.
 */

import { BOARD_FILTER_QUERY } from '../boardFilters';
import { BOARD_SORT_QUERY } from '../boardSort';

const BOARD_VIEWS_KEY = 'mastracode.boardViews';
const MAX_BOARDS = 50;
const BOARD_VIEW_PARAMS: readonly string[] = [...Object.values(BOARD_FILTER_QUERY), BOARD_SORT_QUERY];

const boardScope = (factoryId: string, boardId: string) => `${factoryId}:${boardId}`;

function viewParams(params: URLSearchParams): URLSearchParams {
  const view = new URLSearchParams();
  for (const [key, value] of params) {
    if (BOARD_VIEW_PARAMS.includes(key)) view.append(key, value);
  }
  return view;
}

function viewsByBoard(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(BOARD_VIEWS_KEY) ?? '{}');
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
  } catch {
    return {};
  }
}

function hasBoardViewParams(params: URLSearchParams): boolean {
  return BOARD_VIEW_PARAMS.some(key => params.has(key));
}

/**
 * `params` with the saved view filled in, when the URL carries no filters or sort of its own and
 * doesn't point at a card (a saved filter could hide it). Undefined when nothing needs restoring.
 */
export function restoreBoardView(
  factoryId: string,
  boardId: string,
  params: URLSearchParams,
): URLSearchParams | undefined {
  if (hasBoardViewParams(params) || params.has('item')) return undefined;
  const saved = loadBoardView(factoryId, boardId);
  if (!saved) return undefined;
  const restored = new URLSearchParams(params);
  for (const [key, value] of saved) restored.append(key, value);
  return restored;
}

function loadBoardView(factoryId: string, boardId: string): URLSearchParams | undefined {
  const stored = viewsByBoard()[boardScope(factoryId, boardId)];
  if (!stored) return undefined;
  const view = viewParams(new URLSearchParams(stored));
  return hasBoardViewParams(view) ? view : undefined;
}

/** Records the view parameters in `params`; a board with none is forgotten. Most recent boards are kept. */
export function saveBoardView(factoryId: string, boardId: string, params: URLSearchParams): void {
  const scope = boardScope(factoryId, boardId);
  const view = viewParams(params).toString();
  const entries = Object.entries(viewsByBoard()).filter(([existing]) => existing !== scope);
  if (view) entries.push([scope, view]);
  try {
    localStorage.setItem(BOARD_VIEWS_KEY, JSON.stringify(Object.fromEntries(entries.slice(-MAX_BOARDS))));
  } catch {
    /* non-fatal */
  }
}
