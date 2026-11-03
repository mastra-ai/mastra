import type { InlineSkill } from '@mastra/core/skills';

import { findBoardSkillProblems } from '../skills/app-skills.js';
import type {
  StoredBoardInput,
  StoredBoardRecord,
  StoredBoardScope,
  StoredBoardsStorage,
} from '../storage/domains/boards/base.js';
import { LEGACY_REVIEW_BOARD } from '../storage/domains/work-items/legacy-review.js';
import { createBoardRegistry, defaultBoards } from './registry.js';
import type { BoardRegistry, InstalledBoard } from './registry.js';
import { boardDefinitionOf, compileStoredBoard, mergeCodeBehaviour } from './stored-board.js';

const DEFAULT_RECHECK_MS = 1000;
/** A row under the retired Review board's key can't be served: its cards read as Work. */
const RESERVED_REVIEW_ROW = `Stored board "${LEGACY_REVIEW_BOARD}" isn't served: the key is reserved for the retired Review board, whose cards now live on Work.`;
const PRELOAD_CONCURRENCY = 8;
const SNAPSHOT_ATTEMPTS = 3;

/** Where a board in a project's catalog came from. */
export type BoardSourceKind = 'builtin' | 'app' | 'stored';

export interface StoredBoardDetails {
  source: BoardSourceKind;
  /** Stored boards, the built-in Work board and app boards can all be edited. */
  editable: boolean;
  problems: string[];
}

/** A project's boards: the code boards plus its stored boards, and what to report about each board. */
export interface ProjectBoards {
  readonly registry: BoardRegistry;
  readonly details: ReadonlyMap<string, StoredBoardDetails>;
  /** Problems with stored boards that are left out of the registry. */
  readonly problems: readonly string[];
}

const PROJECT_BOARD_SOURCE = Symbol('ProjectBoardSource');

/**
 * Serves each project its boards. `load` is the async entry point that brings a project's
 * boards up to date; `forProject` is the sync read for code that already loaded the project.
 */
export interface ProjectBoardSource {
  readonly [PROJECT_BOARD_SOURCE]: true;
  /** The code boards: built-in and app boards, served to every project as code built them. */
  readonly codeRegistry: BoardRegistry;
  load(scope: StoredBoardScope): Promise<BoardRegistry>;
  forProject(scope: StoredBoardScope): BoardRegistry;
  describe?(scope: StoredBoardScope): Promise<ProjectBoards>;
}

/** Accepts either a fixed registry (tests, standalone services) or a per-project source. */
export function toBoardSource(boards: BoardRegistry | ProjectBoardSource | undefined): ProjectBoardSource {
  const source = boards ?? createBoardRegistry();
  if (isBoardSource(source)) return source;
  return {
    [PROJECT_BOARD_SOURCE]: true,
    codeRegistry: source,
    load: async () => source,
    forProject: () => source,
  };
}

function isBoardSource(boards: BoardRegistry | ProjectBoardSource): boards is ProjectBoardSource {
  return PROJECT_BOARD_SOURCE in boards;
}

interface CacheEntry {
  boards: ProjectBoards;
  version: string | null;
  checkedAt: number;
}

export interface ProjectBoardCacheOptions {
  /** The code boards, built-ins included when enabled. */
  codeRegistry: BoardRegistry;
  storage: StoredBoardsStorage;
  /** Lists every project, to warm them at boot. */
  projects?: { listAll(): Promise<readonly { orgId: string; id: string }[]> };
  codeSkills?: readonly InlineSkill[];
  recheckMs?: number;
  now?: () => number;
  warn?: (message: string) => void;
}

function scopeKey(scope: StoredBoardScope): string {
  return `${scope.orgId}\0${scope.factoryProjectId}`;
}

/**
 * The per-project board cache. A project's boards are its rows: the Work and app boards Factory
 * stored in it, in code order, then the others. A Work or app board's row runs with the code
 * behaviour of its board and phase keys that still fits it ({@link mergeCodeBehaviour}). The first load of each project in a process stores the
 * boards Factory hasn't stored in it yet, each once ({@link StoredBoardsStorage.seedBoards}); a
 * release never rewrites them. Loads recheck the project's board version at most every
 * `recheckMs` and recompile when it changed, so stored edits on other replicas arrive within that
 * delay.
 */
export class ProjectBoardCache implements ProjectBoardSource {
  readonly [PROJECT_BOARD_SOURCE] = true;
  readonly codeRegistry: BoardRegistry;
  readonly #codeDetails: ReadonlyMap<string, StoredBoardDetails>;
  readonly #storage: StoredBoardsStorage;
  readonly #projects: ProjectBoardCacheOptions['projects'];
  readonly #recheckMs: number;
  readonly #now: () => number;
  readonly #warn: (message: string) => void;
  readonly #entries = new Map<string, CacheEntry>();
  readonly #loading = new Map<string, Promise<ProjectBoards>>();
  readonly #generations = new Map<string, number>();
  readonly #warned = new Set<string>();
  readonly #seeded = new Set<string>();
  readonly #codeSkills: readonly InlineSkill[];
  readonly #seeds: ReadonlyMap<string, StoredBoardInput>;

  constructor(options: ProjectBoardCacheOptions) {
    this.codeRegistry = options.codeRegistry;
    this.#storage = options.storage;
    this.#projects = options.projects;
    this.#codeSkills = options.codeSkills ?? [];
    this.#recheckMs = options.recheckMs ?? DEFAULT_RECHECK_MS;
    this.#now = options.now ?? Date.now;
    this.#warn = options.warn ?? (message => console.warn(`[factory] ${message}`));
    this.#codeDetails = new Map(
      [...this.codeRegistry.values()].map(board => [
        board.id,
        {
          source: defaultBoards.includes(board) ? 'builtin' : 'app',
          editable: true,
          problems: this.#skillProblems(board),
        },
      ]),
    );
    this.#seeds = new Map([...this.codeRegistry.values()].map(board => [board.id, boardDefinitionOf(board)]));
  }

  /** The boards Factory stores in each project once, in order. */
  seeds(): StoredBoardInput[] {
    return [...this.#seeds.values()];
  }

  /** Factory's current definition for `key`, which reset restores; undefined when Factory has none. */
  seedFor(key: string): StoredBoardInput | undefined {
    return this.#seeds.get(key);
  }

  async load(scope: StoredBoardScope): Promise<BoardRegistry> {
    return (await this.describe(scope)).registry;
  }

  /** The project's boards with their source, whether they can be edited, and problems, brought up to date. */
  async describe(scope: StoredBoardScope): Promise<ProjectBoards> {
    const key = scopeKey(scope);
    const entry = this.#entries.get(key);
    if (entry && this.#now() - entry.checkedAt < this.#recheckMs) return entry.boards;
    const inFlight = this.#loading.get(key);
    if (inFlight) return inFlight;
    const generation = this.#generations.get(key) ?? 0;
    const loading = this.#refresh(scope, key, generation).finally(() => {
      if (this.#loading.get(key) === loading) this.#loading.delete(key);
    });
    this.#loading.set(key, loading);
    return loading;
  }

  /**
   * The project's loaded boards. Before the project's first load (boot preload not finished, or a
   * project created on another replica) this is the code boards alone, without the project's
   * stored boards.
   */
  forProject(scope: StoredBoardScope): BoardRegistry {
    // Storage asks about a row it is about to insert by its board and stages alone, with no
    // project to look up; the code boards answer for it.
    if (!scope.orgId || !scope.factoryProjectId) return this.codeRegistry;
    const entry = this.#entries.get(scopeKey(scope));
    if (entry) return entry.boards.registry;
    // Warm the project so the next sync read sees its stored boards.
    void this.load(scope).catch(() => {});
    this.#warnOnce(
      `cold:${scopeKey(scope)}`,
      `Boards for project ${scope.factoryProjectId} were read before they were loaded; using the code boards.`,
      true,
    );
    return this.codeRegistry;
  }

  /** The code skills stored runners may name. */
  get codeSkills(): readonly InlineSkill[] {
    return this.#codeSkills;
  }

  /** Makes the next load reread the project. The loaded boards keep serving sync reads until then. */
  invalidate(scope: StoredBoardScope): void {
    const key = scopeKey(scope);
    this.#generations.set(key, (this.#generations.get(key) ?? 0) + 1);
    this.#loading.delete(key);
    const entry = this.#entries.get(key);
    if (entry) entry.checkedAt = Number.NEGATIVE_INFINITY;
  }

  /** Loads every project, a few at a time, so sync reads find them warm and each has its boards stored. */
  async preload(): Promise<void> {
    const projects = (await this.#projects?.listAll()) ?? [];
    let next = 0;
    const worker = async () => {
      while (next < projects.length) {
        const project = projects[next++]!;
        // A project that fails to load here loads on first use; the others still load now.
        await this.load({ orgId: project.orgId, factoryProjectId: project.id }).catch(error =>
          this.#warn(
            `Boards for project ${project.id} did not load at startup; they load on first use: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    };
    await Promise.all(Array.from({ length: Math.min(PRELOAD_CONCURRENCY, projects.length) }, worker));
  }

  async #refresh(scope: StoredBoardScope, key: string, generation: number): Promise<ProjectBoards> {
    await this.#seed(scope, key);
    const current = this.#entries.get(key);
    const version = await this.#storage.readVersion(scope);
    if (current && current.version === version) {
      if ((this.#generations.get(key) ?? 0) === generation) current.checkedAt = this.#now();
      return current.boards;
    }
    const snapshot = await this.#consistentSnapshot(scope);
    const boards = this.#compile(scope, snapshot.boards);
    if ((this.#generations.get(key) ?? 0) === generation) {
      this.#entries.set(key, { boards, version: snapshot.version, checkedAt: this.#now() });
    }
    return boards;
  }

  /** Boards and phases are read in two statements; reread when a write landed between them. */
  async #consistentSnapshot(scope: StoredBoardScope) {
    let snapshot = await this.#storage.snapshot(scope);
    for (let attempt = 1; attempt < SNAPSHOT_ATTEMPTS; attempt++) {
      if ((await this.#storage.readVersion(scope)) === snapshot.version) break;
      snapshot = await this.#storage.snapshot(scope);
    }
    return snapshot;
  }

  /**
   * Stores the boards Factory hasn't stored in the project yet, once per process. A failure is
   * logged and retried on the next load; the boards it didn't store aren't served meanwhile.
   */
  async #seed(scope: StoredBoardScope, key: string): Promise<void> {
    if (this.#seeded.has(key)) return;
    try {
      if (this.#seeds.size > 0) await this.#storage.seedBoards(scope, this.seeds());
      this.#seeded.add(key);
    } catch (error) {
      this.#warnOnce(
        `seed:${key}`,
        `Boards for project ${scope.factoryProjectId} could not be stored; Factory stores them on the next load: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  #compile(scope: StoredBoardScope, rows: readonly StoredBoardRecord[]): ProjectBoards {
    const byKey = new Map(rows.map(row => [row.key, row]));
    const details = new Map(this.#codeDetails);
    const problems: string[] = [];
    const report = (row: StoredBoardRecord, messages: readonly string[]) => {
      problems.push(...messages);
      for (const message of messages) {
        this.#warnOnce(
          `row:${scopeKey(scope)}:${row.key}:${row.revision}:${message}`,
          `${message} (project ${scope.factoryProjectId})`,
        );
      }
    };
    const boards: InstalledBoard[] = [];
    // Work and app boards keep their code order, each served from its row.
    for (const code of this.codeRegistry.values()) {
      const row = byKey.get(code.id);
      if (!row) {
        details.delete(code.id);
        // Stored once and deleted since, or not stored because storing failed.
        if (!this.#seeded.has(scopeKey(scope))) {
          problems.push(`Board "${code.id}" isn't stored in this project yet; Factory stores it on the next load.`);
        }
        continue;
      }
      let merged: ReturnType<typeof mergeCodeBehaviour>;
      try {
        merged = mergeCodeBehaviour(row, code);
      } catch (error) {
        report(row, [
          `Board '${row.key}' could not be loaded: ${error instanceof Error ? error.message : String(error)}`,
        ]);
        continue;
      }
      report(row, merged.problems);
      details.set(code.id, {
        ...details.get(code.id)!,
        problems: [...merged.problems, ...this.#skillProblems(merged.board)],
      });
      boards.push(merged.board);
    }
    for (const row of rows) {
      if (this.codeRegistry.has(row.key)) continue;
      if (row.key === LEGACY_REVIEW_BOARD) {
        report(row, [RESERVED_REVIEW_ROW]);
        continue;
      }
      let board: InstalledBoard;
      try {
        board = compileStoredBoard(row);
      } catch (error) {
        report(row, [
          `Board '${row.key}' could not be loaded: ${error instanceof Error ? error.message : String(error)}`,
        ]);
        continue;
      }
      boards.push(board);
      details.set(row.key, { source: 'stored', editable: true, problems: this.#skillProblems(board) });
    }
    return {
      registry: createBoardRegistry({ boards, includeDefaultBoards: false }),
      details,
      problems,
    };
  }

  #skillProblems(board: InstalledBoard): string[] {
    return findBoardSkillProblems(
      createBoardRegistry({ boards: [board], includeDefaultBoards: false }),
      this.#codeSkills,
    );
  }

  #warnOnce(key: string, message: string, debug = false): void {
    if (this.#warned.has(key)) return;
    this.#warned.add(key);
    if (debug) {
      console.debug(`[factory] ${message}`);
      return;
    }
    this.#warn(message);
  }
}
