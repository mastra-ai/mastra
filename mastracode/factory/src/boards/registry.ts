import { RETIRED_BOARD_KEY } from '../storage/domains/boards/validation.js';
import type { BoardDefinition } from './define-board.js';
import { workBoard } from './work.js';

export type InstalledBoard = BoardDefinition<string, string>;
export interface BoardRegistry extends Iterable<[string, InstalledBoard]> {
  readonly size: number;
  get(id: string): InstalledBoard | undefined;
  has(id: string): boolean;
  keys(): MapIterator<string>;
  values(): MapIterator<InstalledBoard>;
  entries(): MapIterator<[string, InstalledBoard]>;
}

export const defaultBoards = Object.freeze([workBoard]) as readonly InstalledBoard[];

export function createBoardRegistry(
  options: {
    boards?: readonly InstalledBoard[];
    includeDefaultBoards?: boolean;
  } = {},
): BoardRegistry {
  const installed = options.includeDefaultBoards === false ? [] : defaultBoards;
  const registry = new Map<string, InstalledBoard>();

  for (const board of [...installed, ...(options.boards ?? [])]) {
    if (registry.has(board.id)) {
      throw new Error(`MastraFactory: duplicate board id '${board.id}' in 'boards'.`);
    }
    if (board.id === RETIRED_BOARD_KEY) {
      // Cards and routes naming 'review' are read as Work, so a board with this id would never be reached.
      throw new Error(
        `MastraFactory: board id '${RETIRED_BOARD_KEY}' is retired; pull requests are reviewed on the Work board.`,
      );
    }
    registry.set(board.id, board);
  }

  return freezeRegistry(registry);
}

/** Read-only registry view over a map of boards keyed by id. */
export function freezeRegistry(registry: Map<string, InstalledBoard>): BoardRegistry {
  return Object.freeze({
    size: registry.size,
    get: registry.get.bind(registry),
    has: registry.has.bind(registry),
    keys: registry.keys.bind(registry),
    values: registry.values.bind(registry),
    entries: registry.entries.bind(registry),
    [Symbol.iterator]: registry[Symbol.iterator].bind(registry),
  });
}
