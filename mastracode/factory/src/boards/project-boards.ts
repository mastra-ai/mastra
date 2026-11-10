import type { InlineSkill } from '@mastra/core/skills';
import type { FactoryStorageOps } from '@mastra/core/storage';

import { findBoardSkillProblems } from '../skills/app-skills.js';
import type {
  BoardMigrationContext,
  StoredBoardInput,
  StoredBoardRecord,
  StoredBoardScope,
  StoredBoardsStorage,
} from '../storage/domains/boards/base.js';
import { DEFAULT_INTAKE_ROUTE_ACTOR, readStoredBoard } from '../storage/domains/boards/base.js';
import type { RetiredAutomationSettings } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { LEGACY_REVIEW_BOARD } from '../storage/domains/work-items/legacy-review.js';
import type { ReviewBoardInUse } from '../storage/domains/work-items/legacy-review.js';
import { boardRegistryOf, createBoardRegistry, defaultBoards } from './registry.js';
import type { BoardRegistry, InstalledBoard } from './registry.js';
import { reviewBoard } from './review.js';
import { boardForWorkItem } from './semantics.js';
import { boardDefinitionOf, compileStoredBoard, mergeCodeBehaviour } from './stored-board.js';
import { BOARD_MIGRATIONS } from './work-migrations.js';
import { workSeedWithTriage } from './work-seeds.js';
import { workBoard } from './work.js';

const DEFAULT_RECHECK_MS = 1000;
const PRELOAD_CONCURRENCY = 8;
/** The phases every release seeded the Review board with; only runners and tools changed between them. */
const REVIEW_SEED_PHASES = boardDefinitionOf(reviewBoard).phases.map(({ key, name, kind }) => ({ key, name, kind }));

/**
 * Whether `row` is the Review board as Factory seeded it: written once by Factory, never
 * revised, and shaped like the seed. The actor alone is not proof, as any caller can pass it.
 */
function isUntouchedReviewSeed(row: StoredBoardRecord): boolean {
  if (row.revision !== 1 || row.createdBy !== DEFAULT_INTAKE_ROUTE_ACTOR) return false;
  if (row.updatedBy !== DEFAULT_INTAKE_ROUTE_ACTOR || row.name !== reviewBoard.name) return false;
  const phases = [...row.phases].sort((a, b) => a.position - b.position);
  return (
    phases.length === REVIEW_SEED_PHASES.length &&
    phases.every(
      (phase, index) =>
        phase.key === REVIEW_SEED_PHASES[index]!.key &&
        phase.name === REVIEW_SEED_PHASES[index]!.name &&
        phase.kind === REVIEW_SEED_PHASES[index]!.kind,
    )
  );
}

/**
 * Whether a project has a board of its own under `review`: an app board, or a stored row other
 * than the seed an earlier release left behind. Cards stored on it are its own; anywhere else they
 * are the retired Review board's.
 */
export function ownReviewBoard(codeRegistry: BoardRegistry, { stored = true } = {}): ReviewBoardInUse {
  if (codeRegistry.has(LEGACY_REVIEW_BOARD)) return async () => true;
  if (!stored) return async () => false;
  return async (ops, scope) => {
    const row = await readStoredBoard(ops, scope, LEGACY_REVIEW_BOARD);
    return row !== null && !isUntouchedReviewSeed(row);
  };
}

const SNAPSHOT_ATTEMPTS = 3;

/**
 * The creator Factory records on the Work board it stores in a project as the project is
 * created: that board is today's Work, and reset gives it back. Any other Work row Factory stored
 * is the one with Triage. Only Factory writes this id; a person's writes carry their user id.
 */
export const NEW_PROJECT_SEED_ACTOR = 'factory:new-project';

/** Where a board in a project's catalog came from. */
export type BoardSourceKind = 'builtin' | 'app' | 'stored';

export interface StoredBoardDetails {
  source: BoardSourceKind;
  /** Stored boards, the built-in Work board and app boards can all be edited; the retired Review board can't. */
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
  reviewInUse: boolean;
  checkedAt: number;
}

export interface ProjectBoardCacheOptions {
  /** The code boards, built-ins included when enabled. */
  codeRegistry: BoardRegistry;
  storage: StoredBoardsStorage;
  /**
   * Lists every project, to warm them at boot, and reads the retired switches the board
   * migrations carry into each project's boards.
   */
  projects?: {
    listAll(): Promise<readonly { orgId: string; id: string }[]>;
    retiredAutomationSettings?(
      project: { orgId: string; id: string },
      ops: FactoryStorageOps,
    ): Promise<RetiredAutomationSettings | null>;
  };
  /** The phases cards sit in on each of the project's boards, which a board migration must not remove. */
  occupiedPhases?: (
    scope: StoredBoardScope,
    ops: FactoryStorageOps,
  ) => Promise<ReadonlyMap<string, ReadonlySet<string>> | null>;
  codeSkills?: readonly InlineSkill[];
  /**
   * Whether the project still uses the retired Review board (an open card is stored on it). Such
   * a project is served Review alongside its boards; without this, no project is.
   */
  reviewBoardInUse?: (scope: StoredBoardScope) => Promise<boolean>;
  recheckMs?: number;
  now?: () => number;
  warn?: (message: string) => void;
}

function scopeKey(scope: StoredBoardScope): string {
  return `${scope.orgId}\0${scope.factoryProjectId}`;
}

/**
 * Reads the phases cards sit in on each of a project's boards, for `occupiedPhases`. Null while
 * cards from before the work-item split are still being copied: `listWith` can't see those yet.
 */
export function occupiedPhasesOf(workItems: Pick<WorkItemsStorage, 'listWith' | 'legacyBackfillPending'>) {
  return async (
    scope: StoredBoardScope,
    ops: FactoryStorageOps,
  ): Promise<ReadonlyMap<string, ReadonlySet<string>> | null> => {
    if (workItems.legacyBackfillPending) return null;
    const occupied = new Map<string, Set<string>>();
    for (const item of await workItems.listWith(ops, scope)) {
      const board = boardForWorkItem(item);
      const phases = occupied.get(board) ?? new Set<string>();
      for (const stage of item.stages) phases.add(stage);
      occupied.set(board, phases);
    }
    return occupied;
  };
}

/**
 * The per-project board cache. A project's boards are its rows: the Work and app boards Factory
 * stored in it, in code order, then the others. A Work or app board's row runs with the code
 * behaviour of its board and phase keys that still fits it ({@link mergeCodeBehaviour}). A project
 * that still uses the retired Review board is served it from code, never stored, until its last
 * open card there finishes. The first load of each project in a process stores the
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
  /** Boards the app upserted for every project, which a project with no boards gets before Factory's. */
  readonly #appBoards = new Map<string, StoredBoardInput>();
  readonly #reviewBoardInUse: ProjectBoardCacheOptions['reviewBoardInUse'];
  readonly #occupiedPhases: ProjectBoardCacheOptions['occupiedPhases'];

  constructor(options: ProjectBoardCacheOptions) {
    this.codeRegistry = options.codeRegistry;
    this.#storage = options.storage;
    this.#reviewBoardInUse = options.reviewBoardInUse;
    this.#occupiedPhases = options.occupiedPhases;
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

  /**
   * The boards Factory stores once in a project it didn't create: Work as it was with Triage, so a
   * project from an older release keeps the phases its cards know, then the app boards, in order.
   */
  seeds(): StoredBoardInput[] {
    return [...this.#seeds.values()].map(seed => (this.#isFactoryWork(seed.key) ? workSeedWithTriage() : seed));
  }

  /**
   * The definition reset restores for `key`; undefined when there is none. A board the app upserted
   * for every project comes first, so reset never swaps an app's Work for Factory's. Factory's Work
   * is today's Work for a project Factory created with it (`row` created by
   * {@link NEW_PROJECT_SEED_ACTOR}), and Work with Triage for every other project.
   */
  seedFor(key: string, row?: Pick<StoredBoardRecord, 'createdBy'>): StoredBoardInput | undefined {
    const app = this.#appBoards.get(key);
    if (app) return app;
    const seed = this.#seeds.get(key);
    if (!seed || !this.#isFactoryWork(key) || row?.createdBy === NEW_PROJECT_SEED_ACTOR) return seed;
    return workSeedWithTriage();
  }

  /**
   * Stores Factory's boards in a project that was just created, with today's Work (no Triage).
   * Only the project-creation route calls this; every other load stores {@link seeds}.
   */
  async seedNewProject(scope: StoredBoardScope): Promise<ProjectBoards> {
    if (this.#seeds.size > 0 || this.#appBoards.size > 0) {
      await this.#storage.seedBoards(scope, [...this.#seeds.values()], {
        actor: NEW_PROJECT_SEED_ACTOR,
        onlyIntoEmpty: this.#onlyIntoEmpty(),
        intoEmpty: [...this.#appBoards.values()],
      });
    }
    return this.describe(scope);
  }

  /**
   * Remembers a board the app upserted for every project, so a project that has no boards yet (one
   * created later, or one that never loaded) gets it on its first load before Factory's own boards;
   * having it, the project then gets no Work from Factory. Kept for this process: an app upserts
   * its boards at every startup.
   */
  rememberBoardForAllProjects(board: StoredBoardInput): void {
    this.#appBoards.set(board.key, board);
  }

  /** Whether `key` is Factory's own Work board, rather than none or an app board under its key. */
  #isFactoryWork(key: string): boolean {
    return key === workBoard.id && this.codeRegistry.get(key) === workBoard;
  }

  /** Work is stored only into a project with no boards: one that has any keeps what it has. */
  #onlyIntoEmpty(): string[] {
    return this.#isFactoryWork(workBoard.id) ? [workBoard.id] : [];
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
    const reviewInUse = (await this.#reviewBoardInUse?.(scope)) ?? false;
    if (current && current.version === version && current.reviewInUse === reviewInUse) {
      if ((this.#generations.get(key) ?? 0) === generation) current.checkedAt = this.#now();
      return current.boards;
    }
    const snapshot = await this.#consistentSnapshot(scope);
    const boards = this.#compile(scope, snapshot.boards, reviewInUse);
    if ((this.#generations.get(key) ?? 0) === generation) {
      this.#entries.set(key, { boards, version: snapshot.version, reviewInUse, checkedAt: this.#now() });
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
      // Read before seeding records Work's key: a project whose list lacked it has no Work of Factory's.
      const seeded = await this.#storage.seededBoardKeys(scope);
      if (this.#seeds.size > 0 || this.#appBoards.size > 0) {
        await this.#storage.seedBoards(scope, this.seeds(), {
          onlyIntoEmpty: this.#onlyIntoEmpty(),
          intoEmpty: [...this.#appBoards.values()],
        });
      }
      await this.#migrate(scope, seeded);
      this.#seeded.add(key);
    } catch (error) {
      this.#warnOnce(
        `seed:${key}`,
        `Boards for project ${scope.factoryProjectId} could not be stored; Factory stores them on the next load: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Runs the board migrations of the boards Factory stores here that the project hasn't had yet. */
  async #migrate(scope: StoredBoardScope, seededBefore: readonly string[] | null): Promise<void> {
    // A migration of one board rewrites Factory's own board; an app board under the same key keeps
    // its settings. One that carries a project setting into every board rewrites them all. A board
    // Factory never stored in the project (an app wrote the row first), or one the app upserts for
    // every project, is an app's: its one-board migrations are recorded as applied without running.
    const migrations = BOARD_MIGRATIONS.filter(migration => {
      if (migration.boardKey === null) return true;
      const code = this.codeRegistry.get(migration.boardKey);
      return code !== undefined && defaultBoards.includes(code);
    }).map(migration =>
      migration.boardKey !== null &&
      (this.#appBoards.has(migration.boardKey) || (seededBefore !== null && !seededBefore.includes(migration.boardKey)))
        ? { ...migration, migrate: () => undefined }
        : migration,
    );
    const changed = await this.#storage.applyBoardMigrations(scope, migrations, ops =>
      this.#migrationContext(scope, ops),
    );
    if (changed.length === 0) return;
    const filled = changed.map(({ boardKey, filled }) => `${boardKey}: ${filled.join(', ')}`).join('; ');
    console.info(`[factory] Migrated the boards of project ${scope.factoryProjectId} (${filled}).`);
  }

  /** Read through the migration transaction's `ops`, so card moves can't slip in unseen on LibSQL. */
  async #migrationContext(scope: StoredBoardScope, ops: FactoryStorageOps): Promise<BoardMigrationContext> {
    const retiredSettings =
      (await this.#projects?.retiredAutomationSettings?.({ orgId: scope.orgId, id: scope.factoryProjectId }, ops)) ??
      null;
    return {
      retiredSettings,
      occupiedPhases: retiredSettings && this.#occupiedPhases ? await this.#occupiedPhases(scope, ops) : null,
      codePhases: boardKey => {
        const code = this.codeRegistry.get(boardKey);
        return code ? new Set(Object.keys(code.phases)) : undefined;
      },
      warn: message =>
        this.#warnOnce(`migration:${scopeKey(scope)}:${message}`, `${message} (project ${scope.factoryProjectId})`),
    };
  }

  #compile(scope: StoredBoardScope, rows: readonly StoredBoardRecord[], reviewInUse: boolean): ProjectBoards {
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
    // A board of the project's own under the retired Review board's key is served like any other.
    const reviewRow = byKey.get(LEGACY_REVIEW_BOARD);
    const ownsReview =
      this.codeRegistry.has(LEGACY_REVIEW_BOARD) || (reviewRow !== undefined && !isUntouchedReviewSeed(reviewRow));
    // Served from code and never stored, so nobody edits a board on its way out.
    if (reviewInUse && !ownsReview) {
      boards.push(reviewBoard);
      details.set(reviewBoard.id, { source: 'builtin', editable: false, problems: [] });
    }
    for (const row of rows) {
      if (this.codeRegistry.has(row.key)) continue;
      // Factory seeded this row while Review was a built-in board and nobody edited it since:
      // it is not a board the project made, so it is not served.
      if (row.key === LEGACY_REVIEW_BOARD && !ownsReview) continue;
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
      registry: boardRegistryOf(boards),
      details,
      problems,
    };
  }

  #skillProblems(board: InstalledBoard): string[] {
    return findBoardSkillProblems(boardRegistryOf([board]), this.#codeSkills);
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
