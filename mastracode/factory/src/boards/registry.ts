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

/**
 * Factory's boards: its Work board, then `boards`. Work is always installed; to run another Work,
 * store it under the `work` key with `factory.upsertBoard()`. The exported `workBoard` itself is
 * accepted in `boards` and installed once.
 */
export function createBoardRegistry(options: { boards?: readonly InstalledBoard[] } = {}): BoardRegistry {
  const boards = (options.boards ?? []).filter(board => !defaultBoards.includes(board));
  for (const board of boards) {
    const builtIn = defaultBoards.find(candidate => candidate.id === board.id);
    if (builtIn) {
      throw new Error(
        `MastraFactory: board id '${board.id}' is Factory's ${builtIn.name} board, which every project has. ` +
          `To run your own, store it under '${board.id}' with factory.upsertBoard(board, { projects: 'all' }).`,
      );
    }
  }
  return boardRegistryOf([...defaultBoards, ...boards]);
}

/** A registry of exactly `boards`, in order, such as the boards a project stored. */
export function boardRegistryOf(boards: readonly InstalledBoard[]): BoardRegistry {
  const registry = new Map<string, InstalledBoard>();

  for (const board of boards) {
    if (registry.has(board.id)) {
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
