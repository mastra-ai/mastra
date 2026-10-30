import { randomUUID } from 'node:crypto';

import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { FactoryStorageOps } from '@mastra/core/storage';

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

/**
 * Whether an agent may start a card the route matches without a person: `untrusted` holds cards
 * from outside the write-access circle, `always` holds every card, `never` holds none.
 */
export type IntakeRouteHold = 'untrusted' | 'always' | 'never';

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
  /** Null leaves placement unchanged, so the route only decides `hold`. */
  target?: IntakeRouteTarget | null;
  hold?: IntakeRouteHold;
}

export interface StoredIntakeRouteRecord {
  id: string;
  orgId: string;
  factoryProjectId: string;
  name: string;
  enabled: boolean;
  position: number;
  when: RuleGroup | null;
  target: { boardKey: string; phaseKey: string | null } | null;
  hold: IntakeRouteHold;
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
  | 'intake_route_set_mismatch';

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
  board_key: string | null;
  phase_key: string | null;
  hold: IntakeRouteHold;
  revision: number;
  created_by: string;
  created_at: Date;
  updated_by: string;
  updated_at: Date;
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

  /** The project's intake routes in the order they are tried. */
  async listIntakeRoutes(scope: StoredBoardScope): Promise<StoredIntakeRouteRecord[]> {
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
    await ensureIntakeRouteLockRow(this.ops, scope);
    await this.#transact(async ops => {
      const rows = await lockIntakeRoutes(ops, scope);
      const now = new Date();
      await ops.insertOne<IntakeRouteRow>(INTAKE_ROUTES, {
        id,
        ...scopeWhere(scope),
        name: input.name,
        enabled: input.enabled ?? true,
        position: rows.reduce((max, row) => Math.max(max, row.position), -1) + 1,
        when_condition: input.when ?? null,
        board_key: input.target?.boardKey ?? null,
        phase_key: input.target?.phaseKey ?? null,
        hold: input.hold ?? 'untrusted',
        revision: 1,
        created_by: actor,
        created_at: now,
        updated_by: actor,
        updated_at: now,
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
      await updateIntakeRouteRow(ops, row, {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.enabled !== undefined && { enabled: patch.enabled }),
        ...(patch.when !== undefined && { when_condition: patch.when }),
        ...(patch.target !== undefined && {
          board_key: patch.target?.boardKey ?? null,
          phase_key: patch.target?.phaseKey ?? null,
        }),
        ...(patch.hold !== undefined && { hold: patch.hold }),
        updated_by: options.actor,
      });
    });
    return (await this.getIntakeRoute(scope, id))!;
  }

  /** Deletes a route; the routes after it move up one place. */
  async deleteIntakeRoute(scope: StoredBoardScope, id: string, options: { expectedRevision: number }): Promise<void> {
    await ensureIntakeRouteLockRow(this.ops, scope);
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
    await ensureIntakeRouteLockRow(this.ops, scope);
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

function toIntakeRouteRecord(row: IntakeRouteRow): StoredIntakeRouteRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    factoryProjectId: row.factory_project_id,
    name: row.name,
    enabled: row.enabled,
    position: row.position,
    when: row.when_condition,
    target: row.board_key ? { boardKey: row.board_key, phaseKey: row.phase_key } : null,
    hold: row.hold,
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

/**
 * Gives `rows` the positions 0..n-1 in the order given. Rows that move park at a negative
 * position first, so no two rows share a position mid-way and the unique index stays satisfied.
 */
/**
 * Creates the project's route lock row (see `FACTORY_INTAKE_ROUTE_LOCKS_SCHEMA`). Runs outside the
 * write's transaction: a racing insert would abort a Postgres transaction, and the lock taken
 * inside it must always be an update.
 */
async function ensureIntakeRouteLockRow(ops: FactoryStorageOps, scope: StoredBoardScope): Promise<void> {
  if (await ops.findOne(INTAKE_ROUTE_LOCKS, scopeWhere(scope))) return;
  try {
    await ops.insertOne(INTAKE_ROUTE_LOCKS, { ...scopeWhere(scope), locked_at: new Date() });
  } catch (error) {
    if (!(error instanceof UniqueViolationError)) throw error;
  }
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
