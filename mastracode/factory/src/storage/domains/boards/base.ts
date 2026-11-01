import { randomUUID } from 'node:crypto';

import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { FactoryStorageOps } from '@mastra/core/storage';

import type { RuleGroup } from '../../../rules/rule-group.js';
import {
  FACTORY_BOARD_DEFINITION_VERSIONS_SCHEMA,
  FACTORY_BOARD_PHASES_SCHEMA,
  FACTORY_BOARDS_SCHEMA,
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

export type StoredBoardErrorCode = 'board_exists' | 'board_not_found' | 'revision_mismatch';

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

const BOARDS = 'factory_boards';
const PHASES = 'factory_board_phases';
const VERSIONS = 'factory_board_definition_versions';
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
    ]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany(PHASES, {});
    await this.ops.deleteMany(BOARDS, {});
    await this.ops.deleteMany(VERSIONS, {});
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

  /**
   * Runs `fn` in a transaction and replaces the project's version when it changed anything.
   * Lost races (a compare-and-set miss, or a concurrent write that inserted the same board or the
   * project's first version row) retry from fresh reads.
   */
  async #write<T>(
    scope: StoredBoardScope,
    fn: (ops: FactoryStorageOps) => Promise<{ result: T; changed: boolean }>,
  ): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        // Read committed is enough: every row change is a compare-and-set on `revision` and every
        // insert meets the unique index. Serializable isolation would also fail writes to
        // unrelated projects that replicas run side by side.
        return await this.storage.withTransaction(async ops => {
          const { result, changed } = await fn(ops);
          if (changed) await bumpVersion(ops, scope);
          return result;
        });
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
