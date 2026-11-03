import type { InlineSkill } from '@mastra/core/skills';

import { findBoardSkillProblems } from '../skills/app-skills.js';
import type {
  CodeBoardSeed,
  StoredBoardRecord,
  StoredBoardScope,
  StoredBoardsStorage,
} from '../storage/domains/boards/base.js';
import { codeBoardOf } from './define-board.js';
import { createBoardRegistry, defaultBoards } from './registry.js';
import type { BoardRegistry, InstalledBoard } from './registry.js';
import { reviewBoard } from './review.js';
import { boardDefinitionOf, codeBehaviourConflicts, codeBoardHash, compileStoredBoard } from './stored-board.js';
import { WORK_BOARD_DEFAULT_VERSION, workBoard } from './work.js';

const DEFAULT_RECHECK_MS = 1000;
const PRELOAD_CONCURRENCY = 8;
const SNAPSHOT_ATTEMPTS = 3;

/** Where a board in a project's catalog came from. */
export type BoardSourceKind = 'builtin' | 'app' | 'stored';

export interface StoredBoardDetails {
  source: BoardSourceKind;
  /**
   * Stored boards, the built-in Work board and app boards can be edited; the legacy Review board,
   * which is being retired, stays read-only.
   */
  editable: boolean;
  /** A code board the project edited; it no longer follows its code definition. */
  customized?: boolean;
  /** A customized code board whose code definition changed since the project last copied it. */
  defaultChanged?: boolean;
  problems: string[];
}

/**
 * Code boards each project gets an editable stored copy of: every code board except the legacy
 * Review board, which is being retired and is never copied.
 */
export function isEditableCodeBoard(board: InstalledBoard): boolean {
  return codeBoardOf(board) !== reviewBoard;
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
 * The per-project board cache. A project's boards are the code boards, followed by the boards the
 * project stored. A code board the project edited (a customized stored copy under its key) is
 * served as the stored fields plus the code behaviour of its board and phase keys; an unedited copy
 * serves the code board itself. The legacy Review board is always served from code. Loads recheck the
 * project's board version at most every `recheckMs` and recompile when it changed, so stored
 * edits on other replicas arrive within that delay. The cache never writes.
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
  readonly #codeSkills: readonly InlineSkill[];
  readonly #seeds: ReadonlyMap<string, CodeBoardSeed>;

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
          editable: isEditableCodeBoard(board),
          ...(isEditableCodeBoard(board) ? { customized: false, defaultChanged: false } : {}),
          problems: this.#skillProblems(board),
        },
      ]),
    );
    this.#seeds = new Map(
      [...this.codeRegistry.values()].filter(isEditableCodeBoard).map(board => [
        board.id,
        {
          definition: boardDefinitionOf(board),
          hash: codeBoardHash(board),
          // Only the built-in Work board has a numbered default; app boards are copied once.
          ...(board === workBoard ? { version: WORK_BOARD_DEFAULT_VERSION } : {}),
        },
      ]),
    );
  }

  /** The stored copy each editable code board starts from, for the boards API to seed and reset. */
  seeds(): CodeBoardSeed[] {
    return [...this.#seeds.values()];
  }

  /** The seed for one editable code board, or undefined when `key` isn't one. */
  seedFor(key: string): CodeBoardSeed | undefined {
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

  /** Loads every project, a few at a time, so sync reads find them warm. */
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

  #compile(scope: StoredBoardScope, rows: readonly StoredBoardRecord[]): ProjectBoards {
    const byKey = new Map(rows.map(row => [row.key, row]));
    const details = new Map(this.#codeDetails);
    const problems: string[] = [];
    // Code boards keep their code order. Unedited copies serve the code board itself, so a newer
    // Factory release's defaults reach them on every replica without a write.
    const boards: InstalledBoard[] = [...this.codeRegistry.values()].map(code => {
      const row = byKey.get(code.id);
      if (!row) return code;
      if (!this.#seeds.has(code.id)) {
        problems.push(`Stored board "${row.key}" is hidden by the code board with the same key.`);
        return code;
      }
      if (row.seedHash === null) {
        problems.push(
          `Stored board "${row.key}" was created before ${row.key} could be edited; edit or reset it to use it.`,
        );
        return code;
      }
      if (!row.customized) return code;
      const defaultChanged = row.seedHash !== this.#seeds.get(code.id)!.hash;
      const reason = this.#mergeProblem(row, code);
      if (typeof reason === 'string') {
        const message = `Board "${row.key}" keeps its built-in definition: ${reason}; edit or reset it.`;
        details.set(code.id, { ...details.get(code.id)!, customized: true, defaultChanged, problems: [message] });
        problems.push(message);
        this.#warnOnce(
          `merge:${scopeKey(scope)}:${row.key}:${row.revision}`,
          `${message} (project ${scope.factoryProjectId})`,
        );
        return code;
      }
      details.set(code.id, {
        ...details.get(code.id)!,
        customized: true,
        defaultChanged,
        problems: this.#skillProblems(reason),
      });
      return reason;
    });
    for (const row of rows) {
      if (this.codeRegistry.has(row.key)) continue;
      if (row.seedHash !== null) {
        problems.push(`Stored board "${row.key}" was copied from a code board this Factory no longer defines.`);
        continue;
      }
      let board: InstalledBoard;
      try {
        board = compileStoredBoard(row);
      } catch (error) {
        const message = `Board '${row.key}' could not be loaded: ${error instanceof Error ? error.message : String(error)}`;
        problems.push(message);
        this.#warnOnce(
          `compile:${scopeKey(scope)}:${row.key}:${row.revision}`,
          `${message} (project ${scope.factoryProjectId})`,
        );
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

  /** The edited code board, or why it can't be served. */
  #mergeProblem(row: StoredBoardRecord, code: InstalledBoard): InstalledBoard | string {
    const conflicts = codeBehaviourConflicts(row, code);
    if (conflicts.length > 0) return conflicts.join(' ');
    try {
      return compileStoredBoard(row, code);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
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
