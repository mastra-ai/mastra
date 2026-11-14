import { randomUUID } from 'node:crypto';

import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { FactoryStorageOps } from '@mastra/core/storage';

import { DEFAULT_ROUTE_EVENTS, routeEventsProblem } from '../../../boards/board-events.js';
import type { StatusEvent } from '../../../boards/board-events.js';
import type { FactoryPhaseTool } from '../../../boards/define-board.js';
import { deriveIntakeOrder, reconcileIntakeOrder } from '../../../boards/intake-order.js';
import { DEFAULT_INTAKE_ROUTES } from '../../../boards/work-routes.js';
import type { RuleGroup } from '../../../rules/rule-group.js';
import type { RetiredAutomationSettings } from '../projects/base.js';
import {
  FACTORY_BOARD_DEFINITION_VERSIONS_SCHEMA,
  FACTORY_BOARD_PHASES_SCHEMA,
  FACTORY_BOARDS_SCHEMA,
  FACTORY_INTAKE_DECISIONS_SCHEMA,
  FACTORY_INTAKE_ROUTE_LOCKS_SCHEMA,
  FACTORY_INTAKE_ROUTES_SCHEMA,
} from './schemas.js';

/** The project a board belongs to. */
export interface StoredBoardScope {
  orgId: string;
  factoryProjectId: string;
}

export type StoredPhaseKind = 'resting' | 'working' | 'terminal';

/** Who runs a working phase. Factory runs every phase with its code agent. */
export interface StoredPhaseRunner {
  skill?: string;
  context?: string;
  instructions?: string;
  /** The objective the phase's runs pursue as a goal. */
  goal?: { objective: string; maxRuns?: number };
}

export interface StoredPhaseExitTool {
  id: string;
  autoApprove?: boolean;
  autoApproveWhen?: RuleGroup;
}

/** A phase as it is written. `key` is the stage id cards sit in. */
export interface StoredPhaseInput {
  key: string;
  name: string;
  description?: string | null;
  kind: StoredPhaseKind;
  runner?: StoredPhaseRunner | null;
  /** Unset or `null` on a resting or working phase means every other phase; `[]` means none. */
  nextPhases?: string[] | null;
  autoStart?: boolean;
  autoStartWhen?: RuleGroup | null;
  exitTool?: StoredPhaseExitTool | null;
  /** Factory tools the phase grants the session working the card there. */
  tools?: FactoryPhaseTool[] | null;
}

/** A board as it is written. Phase order is significant: the first phase is where cards start. */
export interface StoredBoardInput {
  key: string;
  name: string;
  description?: string | null;
  phases: StoredPhaseInput[];
}

export interface StoredPhaseRecord {
  key: string;
  position: number;
  name: string;
  description: string | null;
  kind: StoredPhaseKind;
  runner: StoredPhaseRunner | null;
  nextPhases: string[] | null;
  autoStart: boolean;
  autoStartWhen: RuleGroup | null;
  exitTool: StoredPhaseExitTool | null;
  tools: FactoryPhaseTool[] | null;
}

export interface StoredBoardRecord {
  id: string;
  orgId: string;
  factoryProjectId: string;
  key: string;
  name: string;
  description: string | null;
  position: number;
  revision: number;
  createdBy: string;
  createdAt: Date;
  updatedBy: string;
  updatedAt: Date;
  phases: StoredPhaseRecord[];
}

/** What a board migration may know about the project besides the board it rewrites. */
export interface BoardMigrationContext {
  /** The project switches the boards replaced, as the project last stored them; null when unknown. */
  readonly retiredSettings: RetiredAutomationSettings | null;
  /** The phases of each board that cards sit in, by board key; null when the cards can't be read. */
  readonly occupiedPhases: ReadonlyMap<string, ReadonlySet<string>> | null;
  /**
   * The phases the code board under this key declares; undefined for a board only the project
   * stores. A row that drops one runs without its code rules (`mergeCodeBehaviour`).
   */
  codePhases(boardKey: string): ReadonlySet<string> | undefined;
  /** Tells the operator about a board a migration left as it is. */
  warn(message: string): void;
}

/** A one-time rewrite of a stored board, keyed so each project gets it once. */
export interface StoredBoardMigration {
  key: string;
  /** The board it rewrites; `null` rewrites every board the project stores. */
  boardKey: string | null;
  /** The board to write instead, with what changed; undefined leaves it as it is. */
  migrate(
    board: StoredBoardRecord,
    context: BoardMigrationContext,
  ): { board: Omit<StoredBoardInput, 'key'>; filled: string[] } | undefined;
}

const EMPTY_MIGRATION_CONTEXT: BoardMigrationContext = {
  retiredSettings: null,
  occupiedPhases: new Map(),
  codePhases: () => undefined,
  warn: () => {},
};

export interface AppliedBoardMigration {
  key: string;
  boardKey: string;
  filled: string[];
}

export interface StoredBoardSnapshot {
  version: string | null;
  boards: StoredBoardRecord[];
}

export interface IntakeRouteTarget {
  boardKey: string;
  /**
   * Unset lands the card in the board's first phase. On a route that joins a closed issue's
   * card, the phase that card moves to when its board allows it; unset leaves it where it is.
   */
  phaseKey?: string | null;
  /**
   * Files a pull request on the card of the issue it closes, which must be on `boardKey`, as one
   * more source instead of a card of its own. The route doesn't match any other arrival.
   */
  joinClosedIssue?: boolean;
}

/** An intake route as it is written. */
export interface StoredIntakeRouteInput {
  name: string;
  enabled?: boolean;
  /** Null matches every card. */
  when?: RuleGroup | null;
  target: IntakeRouteTarget;
  /** The status events the route handles; unset handles new cards (`work_item.created`). */
  on?: StatusEvent[];
}

export interface StoredIntakeRouteRecord {
  id: string;
  orgId: string;
  factoryProjectId: string;
  name: string;
  enabled: boolean;
  position: number;
  when: RuleGroup | null;
  target: { boardKey: string; phaseKey: string | null; joinClosedIssue: boolean };
  on: StatusEvent[];
  revision: number;
  createdBy: string;
  createdAt: Date;
  updatedBy: string;
  updatedAt: Date;
}

export type StoredBoardErrorCode =
  | 'board_exists'
  | 'board_not_found'
  | 'revision_mismatch'
  | 'intake_route_not_found'
  | 'intake_route_set_mismatch'
  | 'intake_route_limit'
  | 'invalid_intake_route'
  | 'intake_order_set_mismatch'
  | 'intake_decision_not_found'
  | 'invalid_intake_cursor';

/** A board's most intake routes. */
export const MAX_INTAKE_ROUTES_PER_BOARD = 100;

/** How an arrival was decided. */
export type IntakeDecisionOutcome = 'placed' | 'not_routed';

/** Which evaluator decided where an arrival goes; `route-list` is the old one, behind the flag. */
export type IntakeEvaluator = 'route-list' | 'intake-order';

/** How the old and new evaluators compared over the project's recent cards when the order was derived. */
export interface IntakeOrderMigration {
  startedAt: string;
  measuredAt: string | null;
  /** Cards compared. */
  compared: number;
  /** Cards the new evaluator would place on a different board than the old one. */
  differing: number;
  /** Cards no board's rules take under the new evaluator. */
  notRouted: number;
}

/**
 * `derived` while the order still follows the route list: every rule write re-derives it and drops
 * its measure. `explicit` once an admin sets it.
 */
export type IntakeOrderOrigin = 'derived' | 'explicit';

export interface StoredIntakeOrder {
  /** Board keys in the order intake checks them. */
  boardKeys: string[];
  origin: IntakeOrderOrigin;
  migration: IntakeOrderMigration | null;
}

export interface IntakeDecisionInput {
  idempotencyKey: string;
  outcome: IntakeDecisionOutcome;
  evaluator: IntakeEvaluator;
  boardKey?: string | null;
  routeId?: string | null;
  reason?: string | null;
  sourceKey?: string | null;
  title: string;
  url?: string | null;
  /** The arrival as it was decided on; kept so Route again can file it. */
  arrival?: Record<string, unknown> | null;
}

export interface StoredIntakeDecisionRecord {
  id: string;
  orgId: string;
  factoryProjectId: string;
  idempotencyKey: string;
  outcome: IntakeDecisionOutcome;
  evaluator: IntakeEvaluator;
  boardKey: string | null;
  routeId: string | null;
  reason: string | null;
  sourceKey: string | null;
  title: string;
  url: string | null;
  arrival: Record<string, unknown> | null;
  decidedAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
}

// Work's routes are its seed data, kept with the board they target.
export {
  DEFAULT_INTAKE_ROUTE,
  PULL_REQUEST_INTAKE_ROUTE,
  CLOSED_COMPLETED_ROUTE,
  CLOSED_CANCELED_ROUTE,
  REOPENED_ROUTE,
  PULL_REQUEST_MERGED_ROUTE,
  PULL_REQUEST_CLOSED_ROUTE,
  PULL_REQUEST_CLOSED_ISSUE_ROUTE,
  PULL_REQUEST_UPDATED_ROUTE,
  PULL_REQUEST_REVIEW_REQUESTED_ROUTE,
  CLOSES_ISSUE_INTAKE_ROUTE,
  CATCH_ALL_INTAKE_ROUTE,
  DEFAULT_INTAKE_ROUTES,
} from '../../../boards/work-routes.js';

/** The defaults a project whose lock row predates `seeded_defaults` was set up with. */
const ORIGINAL_DEFAULT_KEYS = ['outside-authors'];

/** Who the default intake routes are created and last updated by. */
export const DEFAULT_INTAKE_ROUTE_ACTOR = 'factory';

export class StoredBoardError extends Error {
  override name = 'StoredBoardError';
  constructor(
    readonly code: StoredBoardErrorCode,
    message: string,
  ) {
    super(message);
  }
}

interface BoardRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  factory_project_id: string;
  board_key: string;
  name: string;
  description: string | null;
  position: number;
  revision: number;
  created_by: string;
  created_at: Date;
  updated_by: string;
  updated_at: Date;
}

interface VersionRow extends Record<string, unknown> {
  version: string;
  /** Keys of the boards Factory stored in the project; null on rows written before the list. */
  seeded_boards: string[] | null;
  /** Keys of the board migrations applied to the project; null before the first one. */
  applied_migrations: string[] | null;
}

interface PhaseRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  factory_project_id: string;
  board_key: string;
  phase_key: string;
  position: number;
  name: string;
  description: string | null;
  kind: StoredPhaseKind;
  runner: StoredPhaseRunner | null;
  next_phases: string[] | null;
  auto_start: boolean;
  auto_start_when: RuleGroup | null;
  exit_tool: StoredPhaseExitTool | null;
  tools: FactoryPhaseTool[] | null;
}

interface IntakeRouteRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  factory_project_id: string;
  name: string;
  enabled: boolean;
  position: number;
  when_condition: RuleGroup | null;
  board_key: string;
  phase_key: string | null;
  /** Null on rows written before routes named events: they place new cards. */
  on_events: StatusEvent[] | null;
  join_closed_issue: boolean | null;
  revision: number;
  created_by: string;
  created_at: Date;
  updated_by: string;
  updated_at: Date;
}

interface IntakeRouteLockRow extends Record<string, unknown> {
  /** Keys of the `DEFAULT_INTAKE_ROUTES` added to the project; null on rows written before the list. */
  seeded_defaults: string[] | null;
  intake_order: string[] | null;
  /** Null while derived. */
  intake_order_origin: 'explicit' | null;
  intake_order_migration: IntakeOrderMigration | null;
}

interface IntakeDecisionRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  factory_project_id: string;
  idempotency_key: string;
  outcome: IntakeDecisionOutcome;
  evaluator: IntakeEvaluator;
  board_key: string | null;
  route_id: string | null;
  reason: string | null;
  source_key: string | null;
  title: string;
  url: string | null;
  arrival: Record<string, unknown> | null;
  decided_at: Date;
  resolved_at: Date | null;
  resolved_by: string | null;
}

function toIntakeDecisionRecord(row: IntakeDecisionRow): StoredIntakeDecisionRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    factoryProjectId: row.factory_project_id,
    idempotencyKey: row.idempotency_key,
    outcome: row.outcome,
    evaluator: row.evaluator,
    boardKey: row.board_key,
    routeId: row.route_id,
    reason: row.reason,
    sourceKey: row.source_key,
    title: row.title,
    url: row.url,
    arrival: row.arrival,
    decidedAt: row.decided_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
  };
}

/** A measure that started this long ago without finishing is taken over by the next one. */
const MIGRATION_CLAIM_MS = 10 * 60 * 1000;

function seededDefaults(lock: IntakeRouteLockRow): string[] {
  return lock.seeded_defaults ?? ORIGINAL_DEFAULT_KEYS;
}

function missingDefaults(lock: IntakeRouteLockRow): (typeof DEFAULT_INTAKE_ROUTES)[number][] {
  const seeded = new Set(seededDefaults(lock));
  return DEFAULT_INTAKE_ROUTES.filter(({ key }) => !seeded.has(key));
}

const BOARDS = 'factory_boards';
const PHASES = 'factory_board_phases';
const VERSIONS = 'factory_board_definition_versions';
const INTAKE_ROUTES = 'factory_intake_routes';
const INTAKE_ROUTE_LOCKS = 'factory_intake_route_locks';
const INTAKE_DECISIONS = 'factory_intake_decisions';
const MAX_WRITE_ATTEMPTS = 3;
const MIGRATION_ACTOR = 'factory';

function scopeWhere({ orgId, factoryProjectId }: StoredBoardScope) {
  return { org_id: orgId, factory_project_id: factoryProjectId };
}

function toPhaseRecord(row: PhaseRow): StoredPhaseRecord {
  return {
    key: row.phase_key,
    position: row.position,
    name: row.name,
    description: row.description,
    kind: row.kind,
    runner: row.runner,
    nextPhases: row.next_phases,
    autoStart: row.auto_start,
    autoStartWhen: row.auto_start_when,
    exitTool: row.exit_tool,
    tools: row.tools ?? null,
  };
}

function toRecord(row: BoardRow, phases: PhaseRow[]): StoredBoardRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    factoryProjectId: row.factory_project_id,
    key: row.board_key,
    name: row.name,
    description: row.description,
    position: row.position,
    revision: row.revision,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    phases: phases.sort((left, right) => left.position - right.position).map(toPhaseRecord),
  };
}

/** Runs inside a board write's transaction, before the board is written. */
export type BoardWriteStep = (ops: FactoryStorageOps) => Promise<void>;

/** A compare-and-set inside a write lost to a concurrent writer; the write is retried from fresh reads. */
class ConcurrentBoardWrite extends Error {}

/**
 * Each project's boards and their ordered phases. Every write runs in one transaction that also
 * replaces the project's row in `factory_board_definition_versions`, so caches on other
 * replicas can detect it.
 */
export class StoredBoardsStorage extends FactoryStorageDomain {
  constructor() {
    super('boards');
  }

  async init(): Promise<void> {
    await this.ensureCollections([
      FACTORY_BOARDS_SCHEMA,
      FACTORY_BOARD_PHASES_SCHEMA,
      FACTORY_BOARD_DEFINITION_VERSIONS_SCHEMA,
      FACTORY_INTAKE_ROUTES_SCHEMA,
      FACTORY_INTAKE_ROUTE_LOCKS_SCHEMA,
      FACTORY_INTAKE_DECISIONS_SCHEMA,
    ]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany(INTAKE_DECISIONS, {});
    await this.ops.deleteMany(PHASES, {});
    await this.ops.deleteMany(BOARDS, {});
    await this.ops.deleteMany(VERSIONS, {});
    await this.ops.deleteMany(INTAKE_ROUTES, {});
    await this.ops.deleteMany(INTAKE_ROUTE_LOCKS, {});
  }

  /** The project's current definition version; null before its first board write. */
  async readVersion(scope: StoredBoardScope): Promise<string | null> {
    return readVersion(this.ops, scope);
  }

  /** The project's boards in order. */
  async list(scope: StoredBoardScope): Promise<StoredBoardRecord[]> {
    return readBoards(this.ops, scope);
  }

  /**
   * The version and the boards, read in that order: a write landing between the two reads leaves a
   * version older than the rows, so a cache keyed on it rereads on its next check instead of
   * keeping the stale rows.
   */
  async snapshot(scope: StoredBoardScope): Promise<StoredBoardSnapshot> {
    const version = await readVersion(this.ops, scope);
    return { version, boards: await this.list(scope) };
  }

  get(scope: StoredBoardScope, key: string): Promise<StoredBoardRecord | null> {
    return readStoredBoard(this.ops, scope, key);
  }

  /**
   * Creates a board through the API. `before` runs in the same transaction, once the key is known
   * to be free. A row under the key that `over` accepts does not hold it: the board is written
   * over that row.
   */
  async create(
    scope: StoredBoardScope,
    input: StoredBoardInput,
    actor: string,
    before?: BoardWriteStep,
    over?: (row: StoredBoardRecord) => boolean,
  ): Promise<StoredBoardRecord> {
    await ensureVersionRow(this.ops, scope);
    try {
      return await this.#write(scope, async ops => {
        const rows = await ops.findMany<BoardRow>(BOARDS, scopeWhere(scope));
        const taken = rows.find(row => row.board_key === input.key);
        const stored = taken && over ? await readStoredBoard(ops, scope, input.key) : null;
        if (taken && !(stored && over?.(stored))) {
          throw new StoredBoardError('board_exists', `Board "${input.key}" already exists in this project.`);
        }
        await before?.(ops);
        if (taken) await writeBoard(ops, scope, taken, input, actor);
        else await insertBoard(ops, scope, input, { position: nextPosition(rows), actor });
        return { result: undefined, changed: true };
      }).then(async () => (await this.get(scope, input.key))!);
    } catch (error) {
      // Only the board key's index means the board exists; a lost race on another table is not that.
      if (error instanceof UniqueViolationError && error.collection === BOARDS) {
        throw new StoredBoardError('board_exists', `Board "${input.key}" already exists in this project.`);
      }
      throw error;
    }
  }

  /** Replaces a board's name, description and phases. The board key never changes. */
  async replace(
    scope: StoredBoardScope,
    key: string,
    input: Omit<StoredBoardInput, 'key'>,
    options: { expectedRevision: number; actor: string; before?: BoardWriteStep },
  ): Promise<StoredBoardRecord> {
    await this.#write(scope, async ops => {
      const row = await findBoard(ops, scope, key);
      checkRevision(row, key, options.expectedRevision);
      await options.before?.(ops);
      await writeBoard(ops, scope, row, { key, ...input }, options.actor);
      return { result: undefined, changed: true };
    });
    return (await this.get(scope, key))!;
  }

  /**
   * Stores Factory's boards (Work, app and seed boards) in the project, each key once: a key the
   * project has had before is skipped even if its board was deleted since, and a stored board is
   * never rewritten. A project stored before the list was kept counts the boards it has as stored.
   * Reads one row when every key was stored before. Returns the keys it inserted.
   *
   * A key in `onlyIntoEmpty` is inserted only into a project that has no boards at all: one that
   * already has any board, such as one an app stored under that key, is left as it is. The key
   * is still recorded as stored, so it never goes in later, even after the project's boards are
   * deleted: that project chose its boards, and Work is never added beside or after them. The
   * `intoEmpty` boards (an app's, for every project) go first into a project with no boards, so
   * Factory's own under the same key, or in `onlyIntoEmpty`, then stay out. `actor` is recorded
   * as the inserted boards' creator. `before` runs in the same
   * transaction ahead of each board it inserts.
   */
  async seedBoards(
    scope: StoredBoardScope,
    boards: readonly StoredBoardInput[],
    options: {
      actor?: string;
      onlyIntoEmpty?: readonly string[];
      intoEmpty?: readonly StoredBoardInput[];
      before?: (ops: FactoryStorageOps, key: string) => Promise<void>;
    } = {},
  ): Promise<string[]> {
    const marker = await this.ops.findOne<VersionRow>(VERSIONS, scopeWhere(scope));
    if (marker?.seeded_boards && boards.every(board => marker.seeded_boards!.includes(board.key))) return [];
    return this.#insertOnce(scope, boards, {
      actor: options.actor ?? DEFAULT_INTAKE_ROUTE_ACTOR,
      skipSeeded: true,
      onlyIntoEmpty: options.onlyIntoEmpty ?? [],
      intoEmpty: options.intoEmpty ?? [],
      before: options.before,
    });
  }

  /** The keys of the boards Factory stored in the project; null before it kept the list. */
  async seededBoardKeys(scope: StoredBoardScope): Promise<string[] | null> {
    return (await this.ops.findOne<VersionRow>(VERSIONS, scopeWhere(scope)))?.seeded_boards ?? null;
  }

  /**
   * Rewrites the board stored under `seed.key` to `seed` at its next revision when `when` says the
   * row is nobody's: one an earlier release seeded for a board Factory no longer has, under a key
   * the app now defines. `before` runs in the same transaction. Returns whether it rewrote the row.
   */
  async adoptSeed(
    scope: StoredBoardScope,
    seed: StoredBoardInput,
    options: { when: (row: StoredBoardRecord) => boolean; before?: BoardWriteStep },
  ): Promise<boolean> {
    return this.#write(scope, async ops => {
      const stored = await readStoredBoard(ops, scope, seed.key);
      if (!stored || !options.when(stored)) return { result: false, changed: false };
      await options.before?.(ops);
      await writeBoard(ops, scope, await findBoard(ops, scope, seed.key), seed, DEFAULT_INTAKE_ROUTE_ACTOR);
      return { result: true, changed: true };
    });
  }

  /**
   * Inserts a board into the project unless one is stored under its key, and records the key as
   * stored, so seeding never adds it again. Unlike seeding, it inserts a key the project deleted.
   * Returns whether it inserted the board. `before` runs in the same transaction when it does.
   */
  async insertIfMissing(
    scope: StoredBoardScope,
    board: StoredBoardInput,
    actor: string,
    before?: BoardWriteStep,
  ): Promise<boolean> {
    return (await this.#insertOnce(scope, [board], { actor, skipSeeded: false, before })).length > 0;
  }

  async #insertOnce(
    scope: StoredBoardScope,
    boards: readonly StoredBoardInput[],
    options: {
      actor: string;
      skipSeeded: boolean;
      onlyIntoEmpty?: readonly string[];
      intoEmpty?: readonly StoredBoardInput[];
      before?: (ops: FactoryStorageOps, key: string) => Promise<void>;
    },
  ): Promise<string[]> {
    await ensureVersionRow(this.ops, scope);
    return this.#transact(async ops => {
      const marker = (await ops.findOne<VersionRow>(VERSIONS, scopeWhere(scope)))!;
      const rows = await ops.findMany<BoardRow>(BOARDS, scopeWhere(scope));
      const present = new Set(rows.map(row => row.board_key));
      const seeded = new Set(marker.seeded_boards ?? present);
      // The `intoEmpty` boards go into a project with no boards, first; `onlyIntoEmpty` keys then
      // go in only when nothing is stored yet, so a project holding them gets no default beside them.
      const candidates = [...(rows.length === 0 ? (options.intoEmpty ?? []) : []), ...boards];
      let position = nextPosition(rows);
      const inserted: string[] = [];
      for (const board of candidates) {
        if (present.has(board.key) || (options.skipSeeded && seeded.has(board.key))) continue;
        if (present.size > 0 && options.onlyIntoEmpty?.includes(board.key)) continue;
        await options.before?.(ops, board.key);
        await insertBoard(ops, scope, board, { position: position++, actor: options.actor });
        present.add(board.key);
        inserted.push(board.key);
      }
      const next = [...new Set([...seeded, ...candidates.map(board => board.key)])];
      const unchanged = marker.seeded_boards !== null && next.length === marker.seeded_boards.length;
      if (inserted.length === 0 && unchanged) return inserted;
      // Compare-and-set on the version, and every marker write takes a new one: two replicas
      // recording different keys can't both match the version they read, so neither key is lost.
      const updated = await ops.updateMany(
        VERSIONS,
        { ...scopeWhere(scope), version: marker.version },
        {
          seeded_boards: next,
          version: randomUUID(),
          updated_at: new Date(),
        },
      );
      if (updated !== 1) throw new ConcurrentBoardWrite();
      return inserted;
    });
  }

  /**
   * Runs each migration the project hasn't had yet, once: the keys applied are recorded on the
   * project's version row in the same transaction as the board writes, and the compare-and-set on
   * its version makes a concurrent first load retry from fresh reads, where it finds them applied.
   * A migration whose board the project doesn't have is recorded without running, and the version
   * only changes when a board was rewritten. Reads one row
   * when every key was applied before. Returns what each migration that rewrote a board filled.
   */
  async applyBoardMigrations(
    scope: StoredBoardScope,
    migrations: readonly StoredBoardMigration[],
    /**
     * Read through the transaction's `ops`, again on every retry, and only when a migration is still
     * pending, so what it reports is as fresh as the boards the migrations rewrite.
     */
    context: (ops: FactoryStorageOps) => Promise<BoardMigrationContext> = async () => EMPTY_MIGRATION_CONTEXT,
  ): Promise<AppliedBoardMigration[]> {
    if (migrations.length === 0) return [];
    const marker = await this.ops.findOne<VersionRow>(VERSIONS, scopeWhere(scope));
    if (marker?.applied_migrations && migrations.every(({ key }) => marker.applied_migrations!.includes(key))) {
      return [];
    }
    await ensureVersionRow(this.ops, scope);
    return this.#transact(async ops => {
      const current = (await ops.findOne<VersionRow>(VERSIONS, scopeWhere(scope)))!;
      const applied = current.applied_migrations ?? [];
      const pending = migrations.filter(({ key }) => !applied.includes(key));
      if (pending.length === 0) return [];
      const project = await context(ops);
      const changed: AppliedBoardMigration[] = [];
      for (const migration of pending) {
        const rows =
          migration.boardKey === null
            ? await ops.findMany<BoardRow>(BOARDS, scopeWhere(scope))
            : await ops.findMany<BoardRow>(BOARDS, { ...scopeWhere(scope), board_key: migration.boardKey });
        for (const row of rows) {
          const phases = await ops.findMany<PhaseRow>(PHASES, { ...scopeWhere(scope), board_key: row.board_key });
          const result = migration.migrate(toRecord(row, phases), project);
          if (!result) continue;
          await writeBoard(ops, scope, row, { ...result.board, key: row.board_key }, MIGRATION_ACTOR);
          changed.push({ key: migration.key, boardKey: row.board_key, filled: result.filled });
        }
      }
      const updated = await ops.updateMany(
        VERSIONS,
        { ...scopeWhere(scope), version: current.version },
        {
          applied_migrations: [...applied, ...pending.map(({ key }) => key)],
          // Only a rewritten board is news to the other replicas' caches.
          version: changed.length > 0 ? randomUUID() : current.version,
          updated_at: new Date(),
        },
      );
      if (updated !== 1) throw new ConcurrentBoardWrite();
      return changed;
    });
  }

  /** Rewrites a board to `definition` (Factory's current one for its key), raising its revision. */
  async resetTo(
    scope: StoredBoardScope,
    key: string,
    definition: StoredBoardInput,
    options: { expectedRevision: number; actor: string },
  ): Promise<StoredBoardRecord> {
    await this.#write(scope, async ops => {
      const row = await findBoard(ops, scope, key);
      checkRevision(row, key, options.expectedRevision);
      await writeBoard(ops, scope, row, { ...definition, key }, options.actor);
      return { result: undefined, changed: true };
    });
    return (await this.get(scope, key))!;
  }

  /**
   * Deletes a board, its phases and its intake routes in one transaction, and takes it out of the
   * intake order. Returns the routes it deleted, for the caller to audit.
   */
  async delete(
    scope: StoredBoardScope,
    key: string,
    options: { expectedRevision: number },
  ): Promise<{ intakeRoutes: StoredIntakeRouteRecord[] }> {
    await this.#ensureIntakeRoutes(scope);
    return this.#write(scope, async ops => {
      const row = await findBoard(ops, scope, key);
      checkRevision(row, key, options.expectedRevision);
      const routes = await lockIntakeRoutes(ops, scope);
      if ((await ops.deleteMany(BOARDS, { id: row.id, revision: row.revision })) === 0)
        throw new ConcurrentBoardWrite();
      await ops.deleteMany(PHASES, { ...scopeWhere(scope), board_key: key });
      const deleted = routes.filter(route => route.board_key === key);
      if (deleted.length > 0) {
        await ops.deleteMany(INTAKE_ROUTES, { ...scopeWhere(scope), board_key: key });
        await placeIntakeRoutes(
          ops,
          routes.filter(route => route.board_key !== key),
        );
        await forgetDerivedIntakeOrder(ops, scope);
      }
      const lock = (await ops.findOne<IntakeRouteLockRow>(INTAKE_ROUTE_LOCKS, scopeWhere(scope)))!;
      if (lock.intake_order?.includes(key)) {
        await ops.updateMany(INTAKE_ROUTE_LOCKS, scopeWhere(scope), {
          intake_order: lock.intake_order.filter(other => other !== key),
        });
      }
      return { result: { intakeRoutes: deleted.map(toIntakeRouteRecord) }, changed: true };
    });
  }

  /**
   * The project's intake routes in the order they are tried, or one board's list when `boardKey`
   * is set; Factory's `DEFAULT_INTAKE_ROUTES` are added once each.
   */
  async listIntakeRoutes(
    scope: StoredBoardScope,
    options: { boardKey?: string } = {},
  ): Promise<StoredIntakeRouteRecord[]> {
    await this.#ensureIntakeRoutes(scope);
    const rows = await readIntakeRoutes(this.ops, scope);
    return rows
      .filter(row => options.boardKey === undefined || row.board_key === options.boardKey)
      .map(toIntakeRouteRecord);
  }

  /**
   * The project's intake order, derived from the route list the first time it is read and kept up
   * to date with its boards (see `reconcileIntakeOrder`), with the migration marker. Its boards are
   * the stored ones plus `options.boards` (the caller's registry, so a code board keeps its place).
   */
  async readIntakeOrder(
    scope: StoredBoardScope,
    options: { boards?: readonly string[] } = {},
  ): Promise<StoredIntakeOrder> {
    await this.#ensureIntakeRoutes(scope);
    const current = await this.#intakeOrderState(this.ops, scope, options.boards);
    if (current.lock.intake_order && sameKeys(current.lock.intake_order, current.boardKeys)) {
      return toIntakeOrder(current.lock, current.boardKeys);
    }
    return this.#transact(async ops => {
      await lockIntakeRoutes(ops, scope);
      const fresh = await this.#intakeOrderState(ops, scope, options.boards);
      if (!fresh.lock.intake_order || !sameKeys(fresh.lock.intake_order, fresh.boardKeys)) {
        await ops.updateMany(INTAKE_ROUTE_LOCKS, scopeWhere(scope), { intake_order: fresh.boardKeys });
      }
      return toIntakeOrder(fresh.lock, fresh.boardKeys);
    });
  }

  /**
   * Sets the project's intake order, which then no longer follows the route list; `boardKeys` must
   * name every board of the project exactly once: its stored boards, or `options.boards` when given
   * (the caller's registry, code boards too).
   */
  async setIntakeOrder(
    scope: StoredBoardScope,
    boardKeys: string[],
    options: { boards?: readonly string[] } = {},
  ): Promise<StoredIntakeOrder> {
    await this.#ensureIntakeRoutes(scope);
    return this.#transact(async ops => {
      await lockIntakeRoutes(ops, scope);
      const keys = new Set(
        options.boards ?? (await ops.findMany<BoardRow>(BOARDS, scopeWhere(scope))).map(board => board.board_key),
      );
      if (
        boardKeys.length !== keys.size ||
        new Set(boardKeys).size !== boardKeys.length ||
        boardKeys.some(key => !keys.has(key))
      ) {
        throw new StoredBoardError(
          'intake_order_set_mismatch',
          'The intake order must list every board of the project exactly once; reload the boards and try again.',
        );
      }
      await ops.updateMany(INTAKE_ROUTE_LOCKS, scopeWhere(scope), {
        intake_order: boardKeys,
        intake_order_origin: 'explicit',
      });
      const lock = (await ops.findOne<IntakeRouteLockRow>(INTAKE_ROUTE_LOCKS, scopeWhere(scope)))!;
      return toIntakeOrder(lock, boardKeys);
    });
  }

  /**
   * Claims the project's intake order measure: the claim's `startedAt` for exactly one caller until
   * it records its result, or until the claim is old enough that its holder is taken to have died;
   * null otherwise.
   */
  async claimIntakeOrderMigration(scope: StoredBoardScope, now = new Date()): Promise<string | null> {
    await this.#ensureIntakeRoutes(scope);
    const unclaimed = (marker: IntakeOrderMigration | null) =>
      !marker || (!marker.measuredAt && now.getTime() - Date.parse(marker.startedAt) >= MIGRATION_CLAIM_MS);
    const before = await this.ops.findOne<IntakeRouteLockRow>(INTAKE_ROUTE_LOCKS, scopeWhere(scope));
    if (!unclaimed(before!.intake_order_migration)) return null;
    // Under the route lock, so two replicas reading an unclaimed marker can't both take it.
    return this.#transact(async ops => {
      await lockIntakeRoutes(ops, scope);
      const lock = (await ops.findOne<IntakeRouteLockRow>(INTAKE_ROUTE_LOCKS, scopeWhere(scope)))!;
      if (!unclaimed(lock.intake_order_migration)) return null;
      const startedAt = now.toISOString();
      await ops.updateMany(INTAKE_ROUTE_LOCKS, scopeWhere(scope), {
        intake_order_migration: {
          startedAt,
          measuredAt: null,
          compared: 0,
          differing: 0,
          notRouted: 0,
        } satisfies IntakeOrderMigration,
      });
      return startedAt;
    });
  }

  /**
   * Records what the intake order measure found. With `claimed`, only while that claim still holds:
   * null when a rule write re-derived the order since, so the result describes an order that's gone.
   */
  async recordIntakeOrderMigration(
    scope: StoredBoardScope,
    result: Pick<IntakeOrderMigration, 'compared' | 'differing' | 'notRouted'>,
    options: { claimed?: string; now?: Date } = {},
  ): Promise<IntakeOrderMigration | null> {
    const now = options.now ?? new Date();
    return this.#transact(async ops => {
      await lockIntakeRoutes(ops, scope);
      const lock = (await ops.findOne<IntakeRouteLockRow>(INTAKE_ROUTE_LOCKS, scopeWhere(scope)))!;
      if (options.claimed !== undefined && lock.intake_order_migration?.startedAt !== options.claimed) return null;
      const marker: IntakeOrderMigration = {
        startedAt: lock.intake_order_migration?.startedAt ?? now.toISOString(),
        measuredAt: now.toISOString(),
        ...result,
      };
      await ops.updateMany(INTAKE_ROUTE_LOCKS, scopeWhere(scope), { intake_order_migration: marker });
      return marker;
    });
  }

  /** Records how intake decided an arrival; a redelivery under the same key replaces the row. */
  async recordIntakeDecision(
    scope: StoredBoardScope,
    input: IntakeDecisionInput,
    now = new Date(),
  ): Promise<StoredIntakeDecisionRecord> {
    const row = await this.ops.upsertOne<IntakeDecisionRow>(
      INTAKE_DECISIONS,
      ['org_id', 'factory_project_id', 'idempotency_key'],
      {
        ...scopeWhere(scope),
        idempotency_key: input.idempotencyKey,
        outcome: input.outcome,
        evaluator: input.evaluator,
        board_key: input.boardKey ?? null,
        route_id: input.routeId ?? null,
        reason: input.reason ?? null,
        source_key: input.sourceKey ?? null,
        title: input.title,
        url: input.url ?? null,
        arrival: input.arrival ?? null,
        decided_at: now,
        resolved_at: null,
        resolved_by: null,
      },
    );
    return toIntakeDecisionRecord(row);
  }

  async getIntakeDecision(scope: StoredBoardScope, id: string): Promise<StoredIntakeDecisionRecord | null> {
    const row = await this.ops.findOne<IntakeDecisionRow>(INTAKE_DECISIONS, { ...scopeWhere(scope), id });
    return row ? toIntakeDecisionRecord(row) : null;
  }

  /**
   * Items no board took and nobody has filed since, oldest first, `limit` at a time; pass
   * `nextCursor` back as `cursor` for the next page.
   */
  async listNotRouted(
    scope: StoredBoardScope,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<{ notRouted: StoredIntakeDecisionRecord[]; nextCursor: string | null }> {
    const limit = options.limit ?? 50;
    const after = options.cursor === undefined ? undefined : decodeDecisionCursor(options.cursor);
    const rows = await this.ops.findMany<IntakeDecisionRow>(
      INTAKE_DECISIONS,
      { ...scopeWhere(scope), outcome: 'not_routed', resolved_at: null },
      {
        orderBy: DECISION_ORDER,
        limit: limit + 1,
        ...(after && { cursor: { values: [after.decidedAt, after.id] } }),
      },
    );
    const page = rows.slice(0, limit).map(toIntakeDecisionRecord);
    const last = page.at(-1);
    return {
      notRouted: page,
      nextCursor: rows.length > limit && last ? `${last.decidedAt.toISOString()}_${last.id}` : null,
    };
  }

  /** Marks the Not routed rows for a source resolved once a card is filed for it. Returns how many. */
  async resolveNotRouted(scope: StoredBoardScope, sourceKey: string, by: string, now = new Date()): Promise<number> {
    return this.ops.updateMany(
      INTAKE_DECISIONS,
      { ...scopeWhere(scope), outcome: 'not_routed', source_key: sourceKey, resolved_at: null },
      { resolved_at: now, resolved_by: by },
    );
  }

  async #intakeOrderState(
    ops: FactoryStorageOps,
    scope: StoredBoardScope,
    extra: readonly string[] = [],
  ): Promise<{ lock: IntakeRouteLockRow; boardKeys: string[] }> {
    const [lock, boards, routes] = await Promise.all([
      ops.findOne<IntakeRouteLockRow>(INTAKE_ROUTE_LOCKS, scopeWhere(scope)),
      ops.findMany<BoardRow>(BOARDS, scopeWhere(scope)),
      readIntakeRoutes(ops, scope),
    ]);
    const sidebar = boards
      .sort((left, right) => left.position - right.position || left.board_key.localeCompare(right.board_key))
      .map(board => board.board_key);
    sidebar.push(...extra.filter(key => !sidebar.includes(key)));
    const records = routes.map(toIntakeRouteRecord);
    const stored = lock!.intake_order ?? deriveIntakeOrder(records, sidebar);
    return { lock: lock!, boardKeys: reconcileIntakeOrder(stored, sidebar, records) };
  }

  async getIntakeRoute(scope: StoredBoardScope, id: string): Promise<StoredIntakeRouteRecord | null> {
    const row = await this.ops.findOne<IntakeRouteRow>(INTAKE_ROUTES, { ...scopeWhere(scope), id });
    return row ? toIntakeRouteRecord(row) : null;
  }

  /**
   * Adds a route after the project's last one. A route that places new cards goes just ahead of the
   * first route that takes every new card instead, since after it it would never place one.
   */
  async createIntakeRoute(
    scope: StoredBoardScope,
    input: StoredIntakeRouteInput,
    actor: string,
  ): Promise<StoredIntakeRouteRecord> {
    const id = randomUUID();
    checkRouteEvents(input.on ?? DEFAULT_ROUTE_EVENTS, input.when ?? null);
    await this.#ensureIntakeRoutes(scope);
    await this.#transact(async ops => {
      const rows = await lockIntakeRoutes(ops, scope);
      if (boardRouteCount(rows, input.target.boardKey) >= MAX_INTAKE_ROUTES_PER_BOARD) {
        throw new StoredBoardError(
          'intake_route_limit',
          `A board can have at most ${MAX_INTAKE_ROUTES_PER_BOARD} intake rules; delete one first.`,
        );
      }
      const position = rows.reduce((max, row) => Math.max(max, row.position), -1) + 1;
      await insertIntakeRoute(ops, scope, { id, input, position, actor });
      await forgetDerivedIntakeOrder(ops, scope);
      const ahead = (input.on ?? DEFAULT_ROUTE_EVENTS).includes('work_item.created')
        ? rows.findIndex(catchesEveryNewCard)
        : -1;
      if (ahead >= 0) {
        const added = (await readIntakeRoutes(ops, scope)).find(row => row.id === id)!;
        await placeIntakeRoutes(ops, rows.toSpliced(ahead, 0, added), actor);
      }
    });
    return (await this.getIntakeRoute(scope, id))!;
  }

  /** Changes the fields `patch` names; the route keeps its place in the order. */
  async updateIntakeRoute(
    scope: StoredBoardScope,
    id: string,
    patch: Partial<StoredIntakeRouteInput>,
    options: { expectedRevision: number; actor: string },
  ): Promise<StoredIntakeRouteRecord> {
    await this.#transact(async ops => {
      // Lock first, as every route write does, so it can't deadlock against a reorder.
      const rows = await lockIntakeRoutes(ops, scope);
      const row = rows.find(route => route.id === id);
      if (!row) throw intakeRouteNotFound(id);
      checkIntakeRouteRevision(row, options.expectedRevision);
      const boardKey = patch.target?.boardKey;
      if (
        boardKey !== undefined &&
        boardKey !== row.board_key &&
        boardRouteCount(rows, boardKey) >= MAX_INTAKE_ROUTES_PER_BOARD
      ) {
        throw new StoredBoardError(
          'intake_route_limit',
          `A board can have at most ${MAX_INTAKE_ROUTES_PER_BOARD} intake rules; delete one first.`,
        );
      }
      checkRouteEvents(patch.on ?? routeEvents(row), patch.when !== undefined ? patch.when : row.when_condition);
      await updateIntakeRouteRow(ops, row, {
        ...(patch.on !== undefined && { on_events: patch.on }),
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.enabled !== undefined && { enabled: patch.enabled }),
        ...(patch.when !== undefined && { when_condition: patch.when }),
        ...(patch.target !== undefined && {
          board_key: patch.target.boardKey,
          phase_key: patch.target.phaseKey ?? null,
          join_closed_issue: patch.target.joinClosedIssue ?? false,
        }),
        updated_by: options.actor,
      });
      await forgetDerivedIntakeOrder(ops, scope);
    });
    return (await this.getIntakeRoute(scope, id))!;
  }

  /** Deletes a route; the routes after it move up one place. */
  async deleteIntakeRoute(scope: StoredBoardScope, id: string, options: { expectedRevision: number }): Promise<void> {
    await this.#ensureIntakeRoutes(scope);
    await this.#transact(async ops => {
      const rows = await lockIntakeRoutes(ops, scope);
      const row = rows.find(route => route.id === id);
      if (!row) throw intakeRouteNotFound(id);
      checkIntakeRouteRevision(row, options.expectedRevision);
      if ((await ops.deleteMany(INTAKE_ROUTES, { id: row.id, revision: row.revision })) === 0) {
        throw new ConcurrentBoardWrite();
      }
      await placeIntakeRoutes(
        ops,
        rows.filter(route => route.id !== row.id),
      );
      await forgetDerivedIntakeOrder(ops, scope);
    });
  }

  /**
   * Puts the project's routes in the order of `ids`, which must name every route exactly once. With
   * `boardKey`, `ids` names every route of that board instead: they trade the places the board's
   * routes hold, and every other board's routes keep theirs. Returns the routes reordered.
   */
  async reorderIntakeRoutes(
    scope: StoredBoardScope,
    ids: string[],
    actor: string,
    options: { boardKey?: string } = {},
  ): Promise<StoredIntakeRouteRecord[]> {
    const { boardKey } = options;
    await this.#ensureIntakeRoutes(scope);
    await this.#transact(async ops => {
      const rows = await lockIntakeRoutes(ops, scope);
      const scoped = boardKey === undefined ? rows : rows.filter(row => row.board_key === boardKey);
      const byId = new Map(scoped.map(row => [row.id, row]));
      if (ids.length !== scoped.length || new Set(ids).size !== ids.length || ids.some(id => !byId.has(id))) {
        throw new StoredBoardError(
          'intake_route_set_mismatch',
          boardKey === undefined
            ? 'The order must list every intake route of the project exactly once; reload the routes and try again.'
            : `The order must list every intake rule of board "${boardKey}" exactly once; reload the rules and try again.`,
        );
      }
      const queue = ids.map(id => byId.get(id)!);
      const order =
        boardKey === undefined ? queue : rows.map(row => (row.board_key === boardKey ? queue.shift()! : row));
      await placeIntakeRoutes(ops, order, actor);
      await forgetDerivedIntakeOrder(ops, scope);
    });
    return this.listIntakeRoutes(scope, { boardKey });
  }

  /**
   * Creates the project's route lock row (see `FACTORY_INTAKE_ROUTE_LOCKS_SCHEMA`) and adds each of
   * `DEFAULT_INTAKE_ROUTES` the row doesn't list as added yet, after the project's routes. The row
   * records every default it added, so a project whose admin deleted one doesn't get it back. Runs
   * before, never inside, a write's transaction: the lock taken there must always be an update.
   */
  async #ensureIntakeRoutes(scope: StoredBoardScope): Promise<void> {
    const lock = await this.ops.findOne<IntakeRouteLockRow>(INTAKE_ROUTE_LOCKS, scopeWhere(scope));
    if (lock && missingDefaults(lock).length === 0) return;
    await this.#transact(async ops => {
      if (await ops.findOne(INTAKE_ROUTE_LOCKS, scopeWhere(scope))) await lockIntakeRoutes(ops, scope);
      // A racing first read inserted the lock row first: this one fails on the unique index and
      // retries, taking the lock above.
      else
        await ops.insertOne(INTAKE_ROUTE_LOCKS, { ...scopeWhere(scope), locked_at: new Date(), seeded_defaults: [] });
      // Read under the lock: a racing seeder that committed first already added what it listed.
      const current = (await ops.findOne<IntakeRouteLockRow>(INTAKE_ROUTE_LOCKS, scopeWhere(scope)))!;
      const missing = missingDefaults(current);
      if (missing.length === 0) return;
      const rows = await readIntakeRoutes(ops, scope);
      let position = rows.reduce((max, row) => Math.max(max, row.position), -1) + 1;
      const first: string[] = [];
      const perBoard = new Map<string, number>();
      for (const { route, first: leads } of missing) {
        // A board at the limit keeps its own routes; the default counts as added all the same.
        const count = perBoard.get(route.target.boardKey) ?? boardRouteCount(rows, route.target.boardKey);
        if (count >= MAX_INTAKE_ROUTES_PER_BOARD) continue;
        perBoard.set(route.target.boardKey, count + 1);
        const id = randomUUID();
        await insertIntakeRoute(ops, scope, {
          id,
          input: route,
          position: position++,
          actor: DEFAULT_INTAKE_ROUTE_ACTOR,
        });
        if (leads) first.push(id);
      }
      // A project that had routes before gets a leading default ahead of them.
      if (first.length > 0 && rows.length > 0) {
        const placed = await readIntakeRoutes(ops, scope);
        const leading = new Set(first);
        await placeIntakeRoutes(ops, [
          ...first.map(id => placed.find(row => row.id === id)!),
          ...placed.filter(row => !leading.has(row.id)),
        ]);
      }
      await ops.updateMany(INTAKE_ROUTE_LOCKS, scopeWhere(scope), {
        seeded_defaults: [...seededDefaults(current), ...missing.map(({ key }) => key)],
      });
    });
  }

  /**
   * Runs `fn` in a transaction and replaces the project's version when it changed anything.
   * Lost races (a compare-and-set miss, or a concurrent write that inserted the same board or the
   * project's first version row) retry from fresh reads.
   */
  async #write<T>(
    scope: StoredBoardScope,
    fn: (ops: FactoryStorageOps) => Promise<{ result: T; changed: boolean }>,
  ): Promise<T> {
    return this.#transact(async ops => {
      const { result, changed } = await fn(ops);
      if (changed) await bumpVersion(ops, scope);
      return result;
    });
  }

  /**
   * Runs `fn` in a transaction, retrying lost races from fresh reads. Intake route writes use it
   * directly: routes are read uncached, so they leave the board definition version alone.
   */
  async #transact<T>(fn: (ops: FactoryStorageOps) => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        // Read committed is enough: every row change is a compare-and-set on `revision` and every
        // insert meets the unique index. Serializable isolation would also fail writes to
        // unrelated projects that replicas run side by side.
        return await this.storage.withTransaction(fn);
      } catch (error) {
        const retryable = error instanceof ConcurrentBoardWrite || error instanceof UniqueViolationError;
        if (!retryable || attempt >= MAX_WRITE_ATTEMPTS) throw error;
      }
    }
  }
}

async function readVersion(ops: FactoryStorageOps, scope: StoredBoardScope): Promise<string | null> {
  const row = await ops.findOne<{ version: string }>(VERSIONS, scopeWhere(scope));
  return row?.version ?? null;
}

/** The project's board under `key`, read through `ops` so a caller inside a transaction reads within it. */
export async function readStoredBoard(
  ops: FactoryStorageOps,
  scope: StoredBoardScope,
  key: string,
): Promise<StoredBoardRecord | null> {
  const row = await ops.findOne<BoardRow>(BOARDS, { ...scopeWhere(scope), board_key: key });
  if (!row) return null;
  const phases = await ops.findMany<PhaseRow>(PHASES, { ...scopeWhere(scope), board_key: key });
  return toRecord(row, phases);
}

async function readBoards(ops: FactoryStorageOps, scope: StoredBoardScope): Promise<StoredBoardRecord[]> {
  const [rows, phases] = await Promise.all([
    ops.findMany<BoardRow>(BOARDS, scopeWhere(scope)),
    ops.findMany<PhaseRow>(PHASES, scopeWhere(scope)),
  ]);
  const byBoard = new Map<string, PhaseRow[]>();
  for (const phase of phases) {
    const list = byBoard.get(phase.board_key) ?? [];
    list.push(phase);
    byBoard.set(phase.board_key, list);
  }
  return rows
    .sort((left, right) => left.position - right.position || left.board_key.localeCompare(right.board_key))
    .map(row => toRecord(row, byBoard.get(row.board_key) ?? []));
}

/**
 * Inserts the project's version row if it has none. This runs outside the write transaction: on
 * Postgres, two transactions racing to insert it would leave the loser's transaction aborted, so
 * the version bump inside a write must always be an update.
 */
async function ensureVersionRow(ops: FactoryStorageOps, scope: StoredBoardScope): Promise<void> {
  if (await ops.findOne(VERSIONS, scopeWhere(scope))) return;
  try {
    await ops.insertOne(VERSIONS, { ...scopeWhere(scope), version: randomUUID(), updated_at: new Date() });
  } catch (error) {
    if (!(error instanceof UniqueViolationError)) throw error;
  }
}

async function bumpVersion(ops: FactoryStorageOps, scope: StoredBoardScope): Promise<void> {
  await ops.upsertOne(VERSIONS, ['org_id', 'factory_project_id'], {
    ...scopeWhere(scope),
    version: randomUUID(),
    updated_at: new Date(),
  });
}

async function findBoard(ops: FactoryStorageOps, scope: StoredBoardScope, key: string): Promise<BoardRow> {
  const row = await ops.findOne<BoardRow>(BOARDS, { ...scopeWhere(scope), board_key: key });
  if (!row) {
    throw new StoredBoardError('board_not_found', `Board "${key}" does not exist in this project.`);
  }
  return row;
}

function checkRevision(row: BoardRow, key: string, expectedRevision: number): void {
  if (row.revision !== expectedRevision) {
    throw new StoredBoardError(
      'revision_mismatch',
      `Board "${key}" is at revision ${row.revision}, not ${expectedRevision}; reload it and try again.`,
    );
  }
}

function nextPosition(rows: BoardRow[]): number {
  return rows.reduce((max, row) => Math.max(max, row.position), -1) + 1;
}

/** Sets columns on a board row and raises its revision, unless another writer changed it first. */
async function updateRow(ops: FactoryStorageOps, row: BoardRow, set: Partial<BoardRow>): Promise<void> {
  const updated = await ops.updateMany(
    BOARDS,
    { id: row.id, revision: row.revision },
    { ...set, revision: row.revision + 1, updated_at: new Date() },
  );
  if (updated !== 1) throw new ConcurrentBoardWrite();
}

async function insertPhases(ops: FactoryStorageOps, scope: StoredBoardScope, input: StoredBoardInput): Promise<void> {
  for (const [position, phase] of input.phases.entries()) {
    await ops.insertOne<PhaseRow>(PHASES, {
      ...scopeWhere(scope),
      board_key: input.key,
      phase_key: phase.key,
      position,
      name: phase.name,
      description: phase.description ?? null,
      kind: phase.kind,
      runner: phase.runner ?? null,
      next_phases: phase.nextPhases ?? null,
      auto_start: phase.autoStart ?? false,
      auto_start_when: phase.autoStartWhen ?? null,
      exit_tool: phase.exitTool ?? null,
      tools: phase.tools?.length ? phase.tools : null,
    });
  }
}

async function insertBoard(
  ops: FactoryStorageOps,
  scope: StoredBoardScope,
  input: StoredBoardInput,
  options: { position: number; actor: string },
): Promise<void> {
  const now = new Date();
  await ops.insertOne<BoardRow>(BOARDS, {
    ...scopeWhere(scope),
    board_key: input.key,
    name: input.name,
    description: input.description ?? null,
    position: options.position,
    revision: 1,
    created_by: options.actor,
    created_at: now,
    updated_by: options.actor,
    updated_at: now,
  });
  await insertPhases(ops, scope, input);
}

/** Replaces a board's definition and phases in place, keeping its key, position and history. */
async function writeBoard(
  ops: FactoryStorageOps,
  scope: StoredBoardScope,
  row: BoardRow,
  input: StoredBoardInput,
  actor: string,
): Promise<void> {
  await updateRow(ops, row, { name: input.name, description: input.description ?? null, updated_by: actor });
  await ops.deleteMany(PHASES, { ...scopeWhere(scope), board_key: row.board_key });
  await insertPhases(ops, scope, { ...input, key: row.board_key });
}

function routeEvents(row: IntakeRouteRow): StatusEvent[] {
  return row.on_events ?? [...DEFAULT_ROUTE_EVENTS];
}

function checkRouteEvents(on: readonly string[], when: RuleGroup | null): void {
  const problem = routeEventsProblem(on, when);
  if (problem) throw new StoredBoardError('invalid_intake_route', problem);
}

function toIntakeRouteRecord(row: IntakeRouteRow): StoredIntakeRouteRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    factoryProjectId: row.factory_project_id,
    name: row.name,
    enabled: row.enabled,
    position: row.position,
    when: row.when_condition,
    target: { boardKey: row.board_key, phaseKey: row.phase_key, joinClosedIssue: row.join_closed_issue === true },
    on: routeEvents(row),
    revision: row.revision,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

const DECISION_ORDER: [string, 'asc'][] = [
  ['decided_at', 'asc'],
  ['id', 'asc'],
];

function decodeDecisionCursor(cursor: string): { decidedAt: Date; id: string } {
  const sep = cursor.lastIndexOf('_');
  const decidedAt = new Date(cursor.slice(0, sep));
  const id = cursor.slice(sep + 1);
  if (sep <= 0 || Number.isNaN(decidedAt.getTime()) || !id) {
    throw new StoredBoardError('invalid_intake_cursor', 'The cursor is not one this list returned.');
  }
  return { decidedAt, id };
}

function toIntakeOrder(lock: IntakeRouteLockRow, boardKeys: string[]): StoredIntakeOrder {
  return { boardKeys, origin: lock.intake_order_origin ?? 'derived', migration: lock.intake_order_migration };
}

/**
 * A rule write changes what a derived order would be: drop it and its measure, so the next read
 * derives it afresh and the measure runs again. An order an admin set stays.
 */
async function forgetDerivedIntakeOrder(ops: FactoryStorageOps, scope: StoredBoardScope): Promise<void> {
  await ops.updateMany(
    INTAKE_ROUTE_LOCKS,
    { ...scopeWhere(scope), intake_order_origin: null },
    { intake_order: null, intake_order_migration: null },
  );
}

function sameKeys(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((key, index) => key === right[index]);
}

function boardRouteCount(rows: readonly IntakeRouteRow[], boardKey: string): number {
  return rows.filter(row => row.board_key === boardKey).length;
}

/** Whether `row` places every new card that reaches it, as the seeded "Everything else" route does. */
function catchesEveryNewCard(row: IntakeRouteRow): boolean {
  return (
    row.enabled &&
    row.when_condition === null &&
    (row.on_events ?? DEFAULT_ROUTE_EVENTS).includes('work_item.created') &&
    !row.join_closed_issue
  );
}

async function readIntakeRoutes(ops: FactoryStorageOps, scope: StoredBoardScope): Promise<IntakeRouteRow[]> {
  const rows = await ops.findMany<IntakeRouteRow>(INTAKE_ROUTES, scopeWhere(scope));
  return rows.sort((left, right) => left.position - right.position);
}

function intakeRouteNotFound(id: string): StoredBoardError {
  return new StoredBoardError('intake_route_not_found', `Intake route "${id}" does not exist in this project.`);
}

function checkIntakeRouteRevision(row: IntakeRouteRow, expectedRevision: number): void {
  if (row.revision !== expectedRevision) {
    throw new StoredBoardError(
      'revision_mismatch',
      `Intake route "${row.name}" is at revision ${row.revision}, not ${expectedRevision}; reload it and try again.`,
    );
  }
}

/** Sets columns on a route row and raises its revision, unless another writer changed it first. */
async function updateIntakeRouteRow(
  ops: FactoryStorageOps,
  row: IntakeRouteRow,
  set: Partial<IntakeRouteRow>,
): Promise<number> {
  const revision = row.revision + 1;
  const updated = await ops.updateMany(
    INTAKE_ROUTES,
    { id: row.id, revision: row.revision },
    { ...set, revision, updated_at: new Date() },
  );
  if (updated !== 1) throw new ConcurrentBoardWrite();
  return revision;
}

async function insertIntakeRoute(
  ops: FactoryStorageOps,
  scope: StoredBoardScope,
  route: { id: string; input: StoredIntakeRouteInput; position: number; actor: string },
): Promise<void> {
  const now = new Date();
  await ops.insertOne<IntakeRouteRow>(INTAKE_ROUTES, {
    id: route.id,
    ...scopeWhere(scope),
    name: route.input.name,
    enabled: route.input.enabled ?? true,
    position: route.position,
    when_condition: route.input.when ?? null,
    board_key: route.input.target.boardKey,
    phase_key: route.input.target.phaseKey ?? null,
    on_events: route.input.on ?? null,
    join_closed_issue: route.input.target.joinClosedIssue ?? false,
    revision: 1,
    created_by: route.actor,
    created_at: now,
    updated_by: route.actor,
    updated_at: now,
  });
}

/**
 * Takes the project's route lock and reads the routes. Writes that add, delete or move routes
 * call this first, so they run one after another and each reads what the one before committed.
 */
async function lockIntakeRoutes(ops: FactoryStorageOps, scope: StoredBoardScope): Promise<IntakeRouteRow[]> {
  if ((await ops.updateMany(INTAKE_ROUTE_LOCKS, scopeWhere(scope), { locked_at: new Date() })) !== 1) {
    throw new ConcurrentBoardWrite();
  }
  return readIntakeRoutes(ops, scope);
}

/** Moves routes, read under the project's route lock, to the positions of their order in `rows`. */
async function placeIntakeRoutes(ops: FactoryStorageOps, rows: IntakeRouteRow[], actor?: string): Promise<void> {
  const moving = rows.flatMap((row, position) => (row.position === position ? [] : [{ row, position }]));
  const parked = [];
  for (const [index, { row, position }] of moving.entries()) {
    const revision = await updateIntakeRouteRow(ops, row, {
      position: -(index + 1),
      ...(actor !== undefined && { updated_by: actor }),
    });
    parked.push({ id: row.id, revision, position });
  }
  for (const { id, revision, position } of parked) {
    if ((await ops.updateMany(INTAKE_ROUTES, { id, revision }, { position })) !== 1) throw new ConcurrentBoardWrite();
  }
}
