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

/**
 * A registry whose stored boards (built from the UI or API) can change at runtime. Code-defined
 * boards are fixed; stored boards are installed, replaced, and removed as users edit them.
 */
export interface LiveBoardRegistry extends BoardRegistry {
  /** Whether `id` is a code-defined board, which users cannot edit or delete. */
  isCodeDefined(id: string): boolean;
  /** The Factory a stored board belongs to; undefined for code-defined or unknown boards. */
  ownerOf(id: string): string | undefined;
  /** Installs or replaces a stored board owned by one Factory. */
  install(board: InstalledBoard, factoryProjectId: string): void;
  /** Removes a stored board. */
  uninstall(id: string): void;
  /** Replaces every stored board, e.g. after reloading them from storage. */
  replaceStored(boards: readonly StoredBoardEntry[]): void;
  /** Sets how stored boards are reloaded; a lookup that misses a stored board id triggers it in the background. */
  setStoredReloader(reload: () => Promise<void>): void;
  /** Reloads stored boards (e.g. ones created on another replica); a no-op until a reloader is set. */
  reloadStored(): Promise<void>;
}

/** Prefix of server-generated ids for boards built from the UI or API. */
export const STORED_BOARD_ID_PREFIX = 'custom-';

export interface StoredBoardEntry {
  board: InstalledBoard;
  factoryProjectId: string;
}

/**
 * Whether a Factory may use `boardId`: code-defined boards are shared, stored boards belong to the
 * Factory that created them. A `null` Factory (e.g. an unrouted intake binding) sees code boards only.
 */
export function boardAvailableTo(registry: BoardRegistry, boardId: string, factoryProjectId: string | null): boolean {
  if (!registry.has(boardId)) return false;
  const owner = 'ownerOf' in registry ? (registry as LiveBoardRegistry).ownerOf(boardId) : undefined;
  return owner === undefined || owner === factoryProjectId;
}

export const defaultBoards = Object.freeze([workBoard, reviewBoard]) as readonly InstalledBoard[];

export function createBoardRegistry(
  options: {
    boards?: readonly InstalledBoard[];
    includeDefaultBoards?: boolean;
  } = {},
): LiveBoardRegistry {
  const installed = options.includeDefaultBoards === false ? [] : defaultBoards;
  const codeDefined = new Map<string, InstalledBoard>();
  for (const board of [...installed, ...(options.boards ?? [])]) {
    if (codeDefined.has(board.id)) {
      throw new Error(`MastraFactory: duplicate board id '${board.id}' in 'boards'.`);
    }
    codeDefined.set(board.id, board);
  }
  const registry = new Map(codeDefined);
  const owners = new Map<string, string>();
  let reloader: (() => Promise<void>) | undefined;
  const reloadOnMiss = (id: string) => {
    if (reloader && id.startsWith(STORED_BOARD_ID_PREFIX)) void reloader();
  };

  const assertStored = (id: string) => {
    if (codeDefined.has(id)) throw new Error(`MastraFactory: board '${id}' is defined in code and cannot be replaced.`);
  };

  return Object.freeze({
    get size() {
      return registry.size;
    },
    get(id: string) {
      const board = registry.get(id);
      if (!board) reloadOnMiss(id);
      return board;
    },
    has(id: string) {
      const found = registry.has(id);
      if (!found) reloadOnMiss(id);
      return found;
    },
    keys: () => registry.keys(),
    values: () => registry.values(),
    entries: () => registry.entries(),
    [Symbol.iterator]: () => registry[Symbol.iterator](),
    isCodeDefined: (id: string) => codeDefined.has(id),
    ownerOf: (id: string) => owners.get(id),
    install(board: InstalledBoard, factoryProjectId: string) {
      assertStored(board.id);
      registry.set(board.id, board);
      owners.set(board.id, factoryProjectId);
    },
    uninstall(id: string) {
      assertStored(id);
      registry.delete(id);
      owners.delete(id);
    },
    replaceStored(entries: readonly StoredBoardEntry[]) {
      for (const { board } of entries) assertStored(board.id);
      for (const id of owners.keys()) registry.delete(id);
      owners.clear();
      for (const { board, factoryProjectId } of entries) {
        registry.set(board.id, board);
        owners.set(board.id, factoryProjectId);
      }
    },
    setStoredReloader(reload: () => Promise<void>) {
      reloader = reload;
    },
    reloadStored: () => reloader?.() ?? Promise.resolve(),
  });
}
