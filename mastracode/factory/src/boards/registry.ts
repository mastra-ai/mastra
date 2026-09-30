import type { BoardDefinition } from './define-board.js';
import { reviewBoard } from './review.js';
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

export const defaultBoards = Object.freeze([workBoard, reviewBoard]) as readonly InstalledBoard[];

export function createBoardRegistry(
  options: {
    boards?: readonly InstalledBoard[];
    includeDefaultBoards?: boolean;
  } = {},
): BoardRegistry {
  const installed = options.includeDefaultBoards === false ? [] : defaultBoards;
  const registry = new Map<string, InstalledBoard>();

  for (const board of [...installed, ...(options.boards ?? [])]) {
    const existing = registry.get(board.id);
    if (existing) {
      if (defaultBoards.includes(existing)) {
        throw new Error(
          `MastraFactory: board id '${board.id}' is already used by a built-in board. Set includeDefaultBoards: false to replace it.`,
        );
      }
      throw new Error(`MastraFactory: duplicate board id '${board.id}' in 'boards'.`);
    }
    registry.set(board.id, board);
  }

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
