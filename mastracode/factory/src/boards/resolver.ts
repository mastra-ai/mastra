import type { BoardScope, BoardsStorage, StoredIntakeRoute } from '../storage/domains/boards/base.js';
import { compileStoredBoard } from './compile.js';
import { freezeRegistry } from './registry.js';
import type { BoardRegistry, InstalledBoard } from './registry.js';
import { builtInRunners } from './runners.js';
import type { BoardRunnerRegistry } from './runners.js';

const DEFAULT_RECHECK_MS = 1_000;

interface ProjectBoards {
  revision: number;
  registry: BoardRegistry;
  /** Stored intake routes in order; empty when the project stores none. */
  intakeRoutes: readonly StoredIntakeRoute[];
}

interface CachedBoards extends ProjectBoards {
  checkedAt: number;
}

export interface BoardResolverOptions {
  /** Every board installed from code: the defaults plus `config.boards`. */
  codeBoards: BoardRegistry;
  /**
   * Ids of boards the deployment installed through `config.boards`. A stored
   * board with one of these keys is ignored: code a deployment wrote wins.
   * Built-in defaults are not listed, so a stored `work` board replaces code `work`.
   */
  installedBoardIds?: ReadonlySet<string>;
  storage?: BoardsStorage;
  /** False while the boards domain is unavailable (still starting, or failed to start): code boards are used. */
  storageReady?: () => boolean;
  runners?: BoardRunnerRegistry;
  /** How long a resolved registry is trusted before its revision is read again. */
  recheckMs?: number;
  warn?: (message: string) => void;
  now?: () => number;
}

const scopeKey = (scope: BoardScope) => `${scope.orgId}\u0000${scope.factoryProjectId}`;

/**
 * The boards a project runs: code boards plus the project's stored boards,
 * compiled with the code runner registry. Compiled registries are cached per
 * project and rebuilt when the project's board revision moves, which another
 * process sees within `recheckMs`.
 */
export class BoardResolver {
  readonly #code: BoardRegistry;
  readonly #installed: ReadonlySet<string>;
  readonly #storage: BoardsStorage | undefined;
  readonly #storageReady: () => boolean;
  readonly #runners: BoardRunnerRegistry;
  readonly #recheckMs: number;
  readonly #warn: (message: string) => void;
  readonly #now: () => number;
  readonly #cache = new Map<string, CachedBoards>();
  readonly #inFlight = new Map<string, Promise<ProjectBoards>>();

  constructor(options: BoardResolverOptions) {
    this.#code = options.codeBoards;
    this.#installed = options.installedBoardIds ?? new Set();
    this.#storage = options.storage;
    this.#storageReady = options.storageReady ?? (() => true);
    this.#runners = options.runners ?? builtInRunners;
    this.#recheckMs = options.recheckMs ?? DEFAULT_RECHECK_MS;
    this.#warn = options.warn ?? (message => console.warn(`[factory] ${message}`));
    this.#now = options.now ?? Date.now;
  }

  /** Boards installed from code, used where no project is in scope. */
  get code(): BoardRegistry {
    return this.#code;
  }

  /** Last registry resolved for the project, or the code boards if none yet. Never reads storage. */
  peek(scope: BoardScope): BoardRegistry {
    return this.#cache.get(scopeKey(scope))?.registry ?? this.#code;
  }

  /** Drops the project's cached boards so the next resolve reads storage. */
  invalidate(scope: BoardScope): void {
    this.#cache.delete(scopeKey(scope));
  }

  async forProject(scope: BoardScope): Promise<BoardRegistry> {
    return (await this.#resolve(scope)).registry;
  }

  /** The project's stored intake routes, in order. Empty means the project still routes by its legacy settings. */
  async intakeRoutes(scope: BoardScope): Promise<readonly StoredIntakeRoute[]> {
    return (await this.#resolve(scope)).intakeRoutes;
  }

  #resolve(scope: BoardScope): Promise<ProjectBoards> {
    const key = scopeKey(scope);
    const cached = this.#cache.get(key);
    if (cached && this.#now() - cached.checkedAt < this.#recheckMs) return Promise.resolve(cached);
    let pending = this.#inFlight.get(key);
    if (!pending) {
      pending = this.#refresh(scope, key, cached).finally(() => this.#inFlight.delete(key));
      this.#inFlight.set(key, pending);
    }
    return pending;
  }

  async #refresh(scope: BoardScope, key: string, cached: CachedBoards | undefined): Promise<ProjectBoards> {
    if (!this.#storage || !this.#storageReady()) return { revision: 0, registry: this.#code, intakeRoutes: [] };
    const revision = await this.#storage.getRevision(scope);
    if (cached && cached.revision === revision) {
      cached.checkedAt = this.#now();
      return cached;
    }
    const compiled = revision === 0 ? { revision, registry: this.#code, intakeRoutes: [] } : await this.#compile(scope);
    this.#cache.set(key, { ...compiled, checkedAt: this.#now() });
    return compiled;
  }

  async #compile(scope: BoardScope): Promise<ProjectBoards> {
    const config = await this.#storage!.getConfig(scope);
    const boards = new Map<string, InstalledBoard>(this.#code.entries());
    const where = `project ${scope.factoryProjectId}`;
    for (const stored of config.boards) {
      if (this.#installed.has(stored.key)) {
        this.#warn(`Stored board '${stored.key}' in ${where} is ignored: a code board uses that id.`);
        continue;
      }
      try {
        boards.set(
          stored.key,
          compileStoredBoard(stored, this.#runners, { warn: message => this.#warn(`${message} (${where})`) }),
        );
      } catch (error) {
        this.#warn(`Stored board '${stored.key}' in ${where} could not be compiled: ${(error as Error).message}`);
      }
    }
    return { revision: config.revision, registry: freezeRegistry(boards), intakeRoutes: config.intakeRoutes };
  }
}
