import type { InlineSkill } from '@mastra/core/skills';

import { findBoardSkillProblems } from '../skills/app-skills.js';
import type { StoredBoardScope, StoredBoardsStorage } from '../storage/domains/boards/base.js';
import { createBoardRegistry, defaultBoards } from './registry.js';
import type { BoardRegistry, InstalledBoard } from './registry.js';
import { compileStoredBoard, seedFromDefinition } from './stored-board.js';
import type { BoardSeed } from './stored-board.js';

const DEFAULT_RECHECK_MS = 1000;
const PRELOAD_CONCURRENCY = 8;

export const DRIFT_PROBLEM = 'Code definition changed since this board was edited. Reset to adopt it.';
export const ORPHANED_BEHAVIORS_PROBLEM = 'Code behaviors for this board are no longer defined.';

/** Where a board in a project's catalog came from. */
export type BoardSourceKind = 'builtin' | 'app' | 'stored';

export interface StoredBoardDetails {
  source: BoardSourceKind;
  customized: boolean;
  problems: string[];
}

/** A project's boards: the registry compiled from its stored rows, and what to report about each board. */
export interface ProjectBoards {
  readonly registry: BoardRegistry;
  readonly details: ReadonlyMap<string, StoredBoardDetails>;
  /** Problems with boards that could not be compiled and are left out of the registry. */
  readonly problems: readonly string[];
}

/**
 * Serves each project its boards. `load` is the async entry point that brings a project's
 * boards up to date; `forProject` is the sync read for code that already loaded the project.
 */
export interface ProjectBoardSource {
  /** The compiled code boards: what a project holds before anyone edits its boards. */
  readonly seedRegistry: BoardRegistry;
  load(scope: StoredBoardScope): Promise<BoardRegistry>;
  forProject(scope: StoredBoardScope): BoardRegistry;
  describe?(scope: StoredBoardScope): Promise<ProjectBoards>;
}

/** Accepts either a fixed registry (tests, standalone services) or a per-project source. */
export function toBoardSource(boards: BoardRegistry | ProjectBoardSource | undefined): ProjectBoardSource {
  const source = boards ?? createBoardRegistry();
  if (isBoardSource(source)) return source;
  return {
    seedRegistry: source,
    load: async () => source,
    forProject: () => source,
  };
}

function isBoardSource(boards: BoardRegistry | ProjectBoardSource): boards is ProjectBoardSource {
  return typeof (boards as Partial<ProjectBoardSource>).forProject === 'function';
}

/** The code boards as seed input; Factory's own boards are `builtin`, the app's are `app`. */
export function boardSeeds(registry: BoardRegistry): BoardSeed[] {
  return [...registry.values()].map(board =>
    seedFromDefinition(board, defaultBoards.includes(board) ? 'builtin' : 'app'),
  );
}

interface CacheEntry {
  boards: ProjectBoards;
  version: string | null;
  checkedAt: number;
}

export interface ProjectBoardCacheOptions {
  /** The compiled code boards, built-ins included when enabled. */
  seedRegistry: BoardRegistry;
  storage: StoredBoardsStorage;
  /** Lists every project, to seed and warm them at boot. */
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
 * The per-project board cache. A project's first load in this process writes the code boards
 * into its database; after that, loads recheck the project's board version at most every
 * `recheckMs` and recompile when it changed, so edits on other replicas arrive within that delay.
 */
export class ProjectBoardCache implements ProjectBoardSource {
  readonly seedRegistry: BoardRegistry;
  readonly #seeds: readonly BoardSeed[];
  readonly #seedsByKey: ReadonlyMap<string, BoardSeed>;
  readonly #storage: StoredBoardsStorage;
  readonly #projects: ProjectBoardCacheOptions['projects'];
  readonly #codeSkills: readonly InlineSkill[];
  readonly #recheckMs: number;
  readonly #now: () => number;
  readonly #warn: (message: string) => void;
  readonly #entries = new Map<string, CacheEntry>();
  readonly #loading = new Map<string, Promise<ProjectBoards>>();
  readonly #generations = new Map<string, number>();
  readonly #seeded = new Set<string>();
  readonly #warned = new Set<string>();

  constructor(options: ProjectBoardCacheOptions) {
    this.seedRegistry = options.seedRegistry;
    this.#seeds = boardSeeds(options.seedRegistry);
    this.#seedsByKey = new Map(this.#seeds.map(seed => [seed.key, seed]));
    this.#storage = options.storage;
    this.#projects = options.projects;
    this.#codeSkills = options.codeSkills ?? [];
    this.#recheckMs = options.recheckMs ?? DEFAULT_RECHECK_MS;
    this.#now = options.now ?? Date.now;
    this.#warn = options.warn ?? (message => console.warn(`[factory] ${message}`));
  }

  async load(scope: StoredBoardScope): Promise<BoardRegistry> {
    return (await this.describe(scope)).registry;
  }

  /** The project's boards with their source, edit state and problems, brought up to date. */
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
   * project created on another replica) this is the code boards, which match the stored ones until
   * someone edits them.
   */
  forProject(scope: StoredBoardScope): BoardRegistry {
    // Storage asks about a row it is about to insert by its board and stages alone, with no
    // project to look up; the code boards answer for it.
    if (!scope.orgId || !scope.factoryProjectId) return this.seedRegistry;
    const entry = this.#entries.get(scopeKey(scope));
    if (entry) return entry.boards.registry;
    this.#warnOnce(
      `cold:${scopeKey(scope)}`,
      `Boards for project ${scope.factoryProjectId} were read before they were loaded; using the code boards.`,
      true,
    );
    return this.seedRegistry;
  }

  /** Makes the next load reread the project. The loaded boards keep serving sync reads until then. */
  invalidate(scope: StoredBoardScope): void {
    const key = scopeKey(scope);
    this.#generations.set(key, (this.#generations.get(key) ?? 0) + 1);
    this.#loading.delete(key);
    const entry = this.#entries.get(key);
    if (entry) entry.checkedAt = Number.NEGATIVE_INFINITY;
  }

  /** Seeds and loads every project, a few at a time. */
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
    if (!this.#seeded.has(key)) {
      const { drifted } = await this.#storage.applySeed(scope, this.#seeds);
      this.#seeded.add(key);
      for (const board of drifted) {
        this.#warnOnce(
          `drift:${key}:${board}`,
          `Board '${board}' in project ${scope.factoryProjectId} was edited, so its changed code definition was not applied. Reset the board to adopt it.`,
        );
      }
    }
    const current = this.#entries.get(key);
    const version = await this.#storage.readVersion(scope);
    if (current && current.version === version) {
      if ((this.#generations.get(key) ?? 0) === generation) current.checkedAt = this.#now();
      return current.boards;
    }
    const snapshot = await this.#storage.snapshot(scope);
    const boards = this.#compile(scope, snapshot.boards);
    if ((this.#generations.get(key) ?? 0) === generation) {
      this.#entries.set(key, { boards, version: snapshot.version, checkedAt: this.#now() });
    }
    return boards;
  }

  #compile(scope: StoredBoardScope, rows: Awaited<ReturnType<StoredBoardsStorage['list']>>): ProjectBoards {
    const compiled: InstalledBoard[] = [];
    const details = new Map<string, StoredBoardDetails>();
    const problems: string[] = [];
    for (const row of rows) {
      const seed = row.seedSource ? this.#seedsByKey.get(row.key) : undefined;
      let board: InstalledBoard;
      try {
        board = compileStoredBoard(row, seed?.behaviors);
      } catch (error) {
        const message = `Board '${row.key}' could not be loaded: ${error instanceof Error ? error.message : String(error)}`;
        problems.push(message);
        this.#warnOnce(
          `compile:${scopeKey(scope)}:${row.key}:${row.revision}`,
          `${message} (project ${scope.factoryProjectId})`,
        );
        continue;
      }
      compiled.push(board);
      const boardProblems: string[] = [];
      if (row.driftHash) boardProblems.push(DRIFT_PROBLEM);
      if (!row.seedSource && row.seedHash) boardProblems.push(ORPHANED_BEHAVIORS_PROBLEM);
      boardProblems.push(
        ...findBoardSkillProblems(
          createBoardRegistry({ boards: [board], includeDefaultBoards: false }),
          this.#codeSkills,
        ),
      );
      details.set(row.key, {
        source: row.seedSource ?? 'stored',
        customized: row.customized,
        problems: boardProblems,
      });
    }
    return {
      registry: createBoardRegistry({ boards: compiled, includeDefaultBoards: false }),
      details,
      problems,
    };
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
