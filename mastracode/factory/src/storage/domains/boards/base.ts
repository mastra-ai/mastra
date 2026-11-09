import { randomUUID } from 'node:crypto';

import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { FactoryStorageOps } from '@mastra/core/storage';

import { DEFAULT_ROUTE_EVENTS, routeEventsProblem } from '../../../boards/board-events.js';
import type { StatusEvent } from '../../../boards/board-events.js';
import type { RuleGroup } from '../../../rules/rule-group.js';
import {
  FACTORY_BOARD_DEFINITION_VERSIONS_SCHEMA,
  FACTORY_BOARD_PHASES_SCHEMA,
  FACTORY_BOARDS_SCHEMA,
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

export interface StoredBoardSnapshot {
  version: string | null;
  boards: StoredBoardRecord[];
}

export interface IntakeRouteTarget {
  boardKey: string;
  /** Unset lands the card in the board's first phase. */
  phaseKey?: string | null;
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
  /** Lets an event move an existing card into a working phase, such as Triage. Off by default. */
  allowWorkingPhase?: boolean;
}

export interface StoredIntakeRouteRecord {
  id: string;
  orgId: string;
  factoryProjectId: string;
  name: string;
  enabled: boolean;
  position: number;
  when: RuleGroup | null;
  target: { boardKey: string; phaseKey: string | null };
  on: StatusEvent[];
  allowWorkingPhase: boolean;
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
  | 'invalid_intake_route';

/** A project's most intake routes; a reorder names every one of them. */
export const MAX_INTAKE_ROUTES = 100;

/**
 * The route every project starts with: a GitHub or GitLab card whose author is outside the
 * write-access circle lands in Work › Intake, where nothing starts until a person moves it.
 * It is a stored route like any other, so admins can see, edit, disable or delete it.
 */
export const DEFAULT_INTAKE_ROUTE: StoredIntakeRouteInput = {
  name: 'Outside authors wait in Intake',
  when: {
    operator: 'AND',
    conditions: [
      { field: 'source.integration', operator: 'in', value: ['github', 'gitlab'] },
      { field: 'author.trusted', operator: 'equals', value: false },
    ],
  },
  target: { boardKey: 'work', phaseKey: 'intake' },
};

/**
 * Pull requests are reviewed in Work › PR review. It comes after `DEFAULT_INTAKE_ROUTE`, so a
 * pull request from outside the write-access circle still waits in Intake for a person.
 */
export const PULL_REQUEST_INTAKE_ROUTE: StoredIntakeRouteInput = {
  name: 'Pull requests go to PR review',
  when: { operator: 'AND', conditions: [{ field: 'source.kind', operator: 'equals', value: 'pull_request' }] },
  target: { boardKey: 'work', phaseKey: 'pr-review' },
};

/** A Work card whose issue was closed as done goes to Done. */
export const CLOSED_COMPLETED_ROUTE: StoredIntakeRouteInput = {
  name: 'Closed issues go to Done',
  on: ['work_item.closed'],
  when: { operator: 'AND', conditions: [{ field: 'event.reason', operator: 'equals', value: 'completed' }] },
  target: { boardKey: 'work', phaseKey: 'done' },
};

/** A Work card whose issue was closed as not planned, or as a duplicate, goes to Canceled. */
export const CLOSED_CANCELED_ROUTE: StoredIntakeRouteInput = {
  name: 'Issues closed as not planned go to Canceled',
  on: ['work_item.closed'],
  when: { operator: 'AND', conditions: [{ field: 'event.reason', operator: 'equals', value: 'canceled' }] },
  target: { boardKey: 'work', phaseKey: 'canceled' },
};

/** A finished Work card whose issue was reopened goes back to Intake, where a person picks it up again. */
export const REOPENED_ROUTE: StoredIntakeRouteInput = {
  name: 'Reopened issues go back to Intake',
  on: ['work_item.reopened'],
  target: { boardKey: 'work', phaseKey: 'intake' },
};

/**
 * The routes Factory adds to a project, in order, each under a key that never changes. A project
 * gets each one once: a new project gets them all, a project set up earlier gets a route added
 * since at the end of its list, and a route an admin deleted stays deleted.
 */
export const DEFAULT_INTAKE_ROUTES: readonly { key: string; route: StoredIntakeRouteInput }[] = [
  { key: 'outside-authors', route: DEFAULT_INTAKE_ROUTE },
  { key: 'pull-requests', route: PULL_REQUEST_INTAKE_ROUTE },
  { key: 'closed-completed', route: CLOSED_COMPLETED_ROUTE },
  { key: 'closed-canceled', route: CLOSED_CANCELED_ROUTE },
  { key: 'reopened', route: REOPENED_ROUTE },
];

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
  allow_working_phase: boolean | null;
  revision: number;
  created_by: string;
  created_at: Date;
  updated_by: string;
  updated_at: Date;
}

interface IntakeRouteLockRow extends Record<string, unknown> {
  /** Keys of the `DEFAULT_INTAKE_ROUTES` added to the project; null on rows written before the list. */
  seeded_defaults: string[] | null;
}

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
const MAX_WRITE_ATTEMPTS = 3;

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
    ]);
  }

  async dangerouslyClearAll(): Promise<void> {
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

  async get(scope: StoredBoardScope, key: string): Promise<StoredBoardRecord | null> {
    const row = await this.ops.findOne<BoardRow>(BOARDS, { ...scopeWhere(scope), board_key: key });
    if (!row) return null;
    const phases = await this.ops.findMany<PhaseRow>(PHASES, { ...scopeWhere(scope), board_key: key });
    return toRecord(row, phases);
  }

  /** Creates a board through the API. */
  async create(scope: StoredBoardScope, input: StoredBoardInput, actor: string): Promise<StoredBoardRecord> {
    await ensureVersionRow(this.ops, scope);
    try {
      return await this.#write(scope, async ops => {
        const rows = await ops.findMany<BoardRow>(BOARDS, scopeWhere(scope));
        if (rows.some(row => row.board_key === input.key)) {
          throw new StoredBoardError('board_exists', `Board "${input.key}" already exists in this project.`);
        }
        await insertBoard(ops, scope, input, { position: nextPosition(rows), actor });
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
    options: { expectedRevision: number; actor: string },
  ): Promise<StoredBoardRecord> {
    await this.#write(scope, async ops => {
      const row = await findBoard(ops, scope, key);
      checkRevision(row, key, options.expectedRevision);
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
   */
  async seedBoards(scope: StoredBoardScope, boards: readonly StoredBoardInput[]): Promise<string[]> {
    const marker = await this.ops.findOne<VersionRow>(VERSIONS, scopeWhere(scope));
    if (marker?.seeded_boards && boards.every(board => marker.seeded_boards!.includes(board.key))) return [];
    return this.#insertOnce(scope, boards, { actor: DEFAULT_INTAKE_ROUTE_ACTOR, skipSeeded: true });
  }

  /**
   * Inserts a board into the project unless one is stored under its key, and records the key as
   * stored, so seeding never adds it again. Unlike seeding, it inserts a key the project deleted.
   * Returns whether it inserted the board.
   */
  async insertIfMissing(scope: StoredBoardScope, board: StoredBoardInput, actor: string): Promise<boolean> {
    return (await this.#insertOnce(scope, [board], { actor, skipSeeded: false })).length > 0;
  }

  async #insertOnce(
    scope: StoredBoardScope,
    boards: readonly StoredBoardInput[],
    options: { actor: string; skipSeeded: boolean },
  ): Promise<string[]> {
    await ensureVersionRow(this.ops, scope);
    return this.#transact(async ops => {
      const marker = (await ops.findOne<VersionRow>(VERSIONS, scopeWhere(scope)))!;
      const rows = await ops.findMany<BoardRow>(BOARDS, scopeWhere(scope));
      const present = new Set(rows.map(row => row.board_key));
      const seeded = new Set(marker.seeded_boards ?? present);
      let position = nextPosition(rows);
      const inserted: string[] = [];
      for (const board of boards) {
        if (present.has(board.key) || (options.skipSeeded && seeded.has(board.key))) continue;
        await insertBoard(ops, scope, board, { position: position++, actor: options.actor });
        present.add(board.key);
        inserted.push(board.key);
      }
      const next = [...new Set([...seeded, ...boards.map(board => board.key)])];
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

  /** Deletes a board and its phases. */
  async delete(scope: StoredBoardScope, key: string, options: { expectedRevision: number }): Promise<void> {
    await this.#write(scope, async ops => {
      const row = await findBoard(ops, scope, key);
      checkRevision(row, key, options.expectedRevision);
      if ((await ops.deleteMany(BOARDS, { id: row.id, revision: row.revision })) === 0)
        throw new ConcurrentBoardWrite();
      await ops.deleteMany(PHASES, { ...scopeWhere(scope), board_key: key });
      return { result: undefined, changed: true };
    });
  }

  /** The project's intake routes in the order they are tried; Factory's `DEFAULT_INTAKE_ROUTES` are added once each. */
  async listIntakeRoutes(scope: StoredBoardScope): Promise<StoredIntakeRouteRecord[]> {
    await this.#ensureIntakeRoutes(scope);
    return (await readIntakeRoutes(this.ops, scope)).map(toIntakeRouteRecord);
  }

  async getIntakeRoute(scope: StoredBoardScope, id: string): Promise<StoredIntakeRouteRecord | null> {
    const row = await this.ops.findOne<IntakeRouteRow>(INTAKE_ROUTES, { ...scopeWhere(scope), id });
    return row ? toIntakeRouteRecord(row) : null;
  }

  /** Adds a route after the project's last one. */
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
      if (rows.length >= MAX_INTAKE_ROUTES) {
        throw new StoredBoardError(
          'intake_route_limit',
          `A project can have at most ${MAX_INTAKE_ROUTES} intake routes; delete one first.`,
        );
      }
      await insertIntakeRoute(ops, scope, {
        id,
        input,
        position: rows.reduce((max, row) => Math.max(max, row.position), -1) + 1,
        actor,
      });
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
      const row = await findIntakeRoute(ops, scope, id);
      checkIntakeRouteRevision(row, options.expectedRevision);
      checkRouteEvents(patch.on ?? routeEvents(row), patch.when !== undefined ? patch.when : row.when_condition);
      await updateIntakeRouteRow(ops, row, {
        ...(patch.on !== undefined && { on_events: patch.on }),
        ...(patch.allowWorkingPhase !== undefined && { allow_working_phase: patch.allowWorkingPhase }),
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.enabled !== undefined && { enabled: patch.enabled }),
        ...(patch.when !== undefined && { when_condition: patch.when }),
        ...(patch.target !== undefined && {
          board_key: patch.target.boardKey,
          phase_key: patch.target.phaseKey ?? null,
        }),
        updated_by: options.actor,
      });
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
    });
  }

  /** Puts the project's routes in the order of `ids`, which must name every route exactly once. */
  async reorderIntakeRoutes(scope: StoredBoardScope, ids: string[], actor: string): Promise<StoredIntakeRouteRecord[]> {
    await this.#ensureIntakeRoutes(scope);
    await this.#transact(async ops => {
      const rows = await lockIntakeRoutes(ops, scope);
      const byId = new Map(rows.map(row => [row.id, row]));
      if (ids.length !== rows.length || new Set(ids).size !== ids.length || ids.some(id => !byId.has(id))) {
        throw new StoredBoardError(
          'intake_route_set_mismatch',
          'The order must list every intake route of the project exactly once; reload the routes and try again.',
        );
      }
      await placeIntakeRoutes(
        ops,
        ids.map(id => byId.get(id)!),
        actor,
      );
    });
    return this.listIntakeRoutes(scope);
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
      for (const { route } of missing) {
        // A project at the limit keeps its own routes; the default counts as added all the same.
        if (position >= MAX_INTAKE_ROUTES) break;
        await insertIntakeRoute(ops, scope, {
          id: randomUUID(),
          input: route,
          position: position++,
          actor: DEFAULT_INTAKE_ROUTE_ACTOR,
        });
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
    target: { boardKey: row.board_key, phaseKey: row.phase_key },
    on: routeEvents(row),
    allowWorkingPhase: row.allow_working_phase ?? false,
    revision: row.revision,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

async function readIntakeRoutes(ops: FactoryStorageOps, scope: StoredBoardScope): Promise<IntakeRouteRow[]> {
  const rows = await ops.findMany<IntakeRouteRow>(INTAKE_ROUTES, scopeWhere(scope));
  return rows.sort((left, right) => left.position - right.position);
}

async function findIntakeRoute(ops: FactoryStorageOps, scope: StoredBoardScope, id: string): Promise<IntakeRouteRow> {
  const row = await ops.findOne<IntakeRouteRow>(INTAKE_ROUTES, { ...scopeWhere(scope), id });
  if (!row) throw intakeRouteNotFound(id);
  return row;
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
    allow_working_phase: route.input.allowWorkingPhase ?? false,
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
