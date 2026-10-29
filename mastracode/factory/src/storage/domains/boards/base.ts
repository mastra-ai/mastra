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

export type StoredBoardSeedSource = 'builtin' | 'app';

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
  /** Set when the board is seeded from code; null for boards created through the API. */
  seedSource: StoredBoardSeedSource | null;
  /** Hash of the code definition last written to this board. */
  seedHash: string | null;
  /** Hash of a newer code definition that was not applied because the board was edited. */
  driftHash: string | null;
  customized: boolean;
  deletedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedBy: string;
  updatedAt: Date;
  phases: StoredPhaseRecord[];
}

/** One code board to seed into a project. */
export interface StoredBoardSeed {
  key: string;
  source: StoredBoardSeedSource;
  hash: string;
  input: StoredBoardInput;
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

/** Updated-by for writes Factory makes while seeding code boards. */
export const BOARD_SEED_ACTOR = 'factory:seed';

interface BoardRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  factory_project_id: string;
  board_key: string;
  name: string;
  description: string | null;
  position: number;
  revision: number;
  seed_source: StoredBoardSeedSource | null;
  seed_hash: string | null;
  drift_hash: string | null;
  customized: boolean;
  deleted_at: Date | null;
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
    seedSource: row.seed_source,
    seedHash: row.seed_hash,
    driftHash: row.drift_hash,
    customized: row.customized,
    deletedAt: row.deleted_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    phases: phases.sort((left, right) => left.position - right.position).map(toPhaseRecord),
  };
}

type SeedAction =
  | { type: 'insert'; seed: StoredBoardSeed }
  | { type: 'overwrite'; seed: StoredBoardSeed; row: BoardRow }
  | {
      type: 'mark';
      row: BoardRow;
      set: Pick<BoardRow, 'seed_source' | 'customized' | 'drift_hash'>;
      drifted: boolean;
    };

/**
 * What seeding these code boards into a project must write, given its current rows.
 *
 * - No row: insert the code board.
 * - Unedited row: overwrite it when the code definition changed.
 * - Edited row (or a board created through the API under the same key): keep it, and record the
 *   newer code definition in `drift_hash` so it can be reported and adopted with a reset.
 * - Deleted (tombstoned) row: leave it deleted.
 * - Seeded row whose board left the code: it becomes an ordinary board (`seed_source` cleared).
 */
function planSeed(rows: BoardRow[], seeds: readonly StoredBoardSeed[]): SeedAction[] {
  const byKey = new Map(rows.map(row => [row.board_key, row]));
  const actions: SeedAction[] = [];
  for (const seed of seeds) {
    const row = byKey.get(seed.key);
    if (!row) {
      actions.push({ type: 'insert', seed });
      continue;
    }
    if (row.deleted_at) continue;
    const edited = row.customized || row.seed_hash === null;
    if (!edited) {
      if (row.seed_hash !== seed.hash) actions.push({ type: 'overwrite', seed, row });
      else if (row.seed_source !== seed.source) {
        actions.push({
          type: 'mark',
          row,
          set: { seed_source: seed.source, customized: false, drift_hash: null },
          drifted: false,
        });
      }
      continue;
    }
    const driftHash = row.seed_hash === seed.hash ? null : seed.hash;
    if (row.customized && row.seed_source === seed.source && row.drift_hash === driftHash) continue;
    actions.push({
      type: 'mark',
      row,
      set: { seed_source: seed.source, customized: true, drift_hash: driftHash },
      drifted: driftHash !== null && row.drift_hash !== driftHash,
    });
  }
  const seeded = new Set(seeds.map(seed => seed.key));
  for (const row of rows) {
    if (row.deleted_at || row.seed_source === null || seeded.has(row.board_key)) continue;
    actions.push({
      type: 'mark',
      row,
      set: { seed_source: null, customized: row.customized, drift_hash: null },
      drifted: false,
    });
  }
  return actions;
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

  /** The project's boards in order, without deleted ones unless asked. */
  async list(scope: StoredBoardScope, options: { includeDeleted?: boolean } = {}): Promise<StoredBoardRecord[]> {
    const boards = await readBoards(this.ops, scope);
    return options.includeDeleted ? boards : boards.filter(board => !board.deletedAt);
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

  async get(scope: StoredBoardScope, key: string, options: { includeDeleted?: boolean } = {}) {
    const row = await this.ops.findOne<BoardRow>(BOARDS, { ...scopeWhere(scope), board_key: key });
    if (!row || (row.deleted_at && !options.includeDeleted)) return null;
    const phases = await this.ops.findMany<PhaseRow>(PHASES, { ...scopeWhere(scope), board_key: key });
    return toRecord(row, phases);
  }

  /** Creates a board through the API. */
  async create(scope: StoredBoardScope, input: StoredBoardInput, actor: string): Promise<StoredBoardRecord> {
    try {
      return await this.#write(scope, async ops => {
        const rows = await ops.findMany<BoardRow>(BOARDS, scopeWhere(scope));
        if (rows.some(row => row.board_key === input.key)) {
          throw new StoredBoardError('board_exists', `Board "${input.key}" already exists in this project.`);
        }
        await insertBoard(ops, scope, input, {
          position: nextPosition(rows),
          actor,
          seed: null,
        });
        return { result: undefined, changed: true };
      }).then(async () => (await this.get(scope, input.key))!);
    } catch (error) {
      if (error instanceof UniqueViolationError) {
        throw new StoredBoardError('board_exists', `Board "${input.key}" already exists in this project.`);
      }
      throw error;
    }
  }

  /**
   * Replaces a board's name, description and phases. The board key never changes. `customized`
   * marks a seeded board as edited, so seeding keeps the edit.
   */
  async replace(
    scope: StoredBoardScope,
    key: string,
    input: Omit<StoredBoardInput, 'key'>,
    options: { expectedRevision: number; actor: string; customized?: boolean },
  ): Promise<StoredBoardRecord> {
    await this.#write(scope, async ops => {
      const row = await findLive(ops, scope, key);
      checkRevision(row, key, options.expectedRevision);
      await writeBoard(ops, scope, row, { key, ...input }, options.actor, {
        customized: options.customized ?? row.customized,
      });
      return { result: undefined, changed: true };
    });
    return (await this.get(scope, key))!;
  }

  /** Deletes a seeded board, keeping a tombstone so seeding does not recreate it. */
  async softDelete(
    scope: StoredBoardScope,
    key: string,
    options: { expectedRevision: number; actor: string },
  ): Promise<void> {
    await this.#write(scope, async ops => {
      const row = await findLive(ops, scope, key);
      checkRevision(row, key, options.expectedRevision);
      await updateRow(ops, row, {
        deleted_at: new Date(),
        updated_by: options.actor,
      });
      return { result: undefined, changed: true };
    });
  }

  /** Deletes a board and its phases. */
  async delete(scope: StoredBoardScope, key: string, options: { expectedRevision: number }): Promise<void> {
    await this.#write(scope, async ops => {
      const row = await findLive(ops, scope, key);
      checkRevision(row, key, options.expectedRevision);
      if ((await ops.deleteMany(BOARDS, { id: row.id, revision: row.revision })) === 0)
        throw new ConcurrentBoardWrite();
      await ops.deleteMany(PHASES, { ...scopeWhere(scope), board_key: key });
      return { result: undefined, changed: true };
    });
  }

  /**
   * Writes the code boards into the project per the seeding rules (see `planSeed`). A pass with
   * nothing to change writes nothing, not even the version.
   */
  async applySeed(
    scope: StoredBoardScope,
    seeds: readonly StoredBoardSeed[],
  ): Promise<{ written: string[]; drifted: string[] }> {
    const current = await this.ops.findMany<BoardRow>(BOARDS, scopeWhere(scope));
    if (planSeed(current, seeds).length === 0) return { written: [], drifted: [] };
    return this.#write(
      scope,
      async ops => {
        const rows = await ops.findMany<BoardRow>(BOARDS, scopeWhere(scope));
        const actions = planSeed(rows, seeds);
        let position = nextPosition(rows);
        for (const action of actions) {
          if (action.type === 'insert') {
            await insertBoard(ops, scope, action.seed.input, {
              position: position++,
              actor: BOARD_SEED_ACTOR,
              seed: action.seed,
            });
          } else if (action.type === 'overwrite') {
            await writeBoard(ops, scope, action.row, action.seed.input, BOARD_SEED_ACTOR, {
              customized: false,
              seed: action.seed,
            });
          } else {
            await updateRow(ops, action.row, { ...action.set, updated_by: BOARD_SEED_ACTOR });
          }
        }
        return {
          result: {
            written: actions.map(action => (action.type === 'insert' ? action.seed.key : action.row.board_key)),
            drifted: actions.flatMap(action =>
              action.type === 'mark' && action.drifted ? [action.row.board_key] : [],
            ),
          },
          changed: actions.length > 0,
        };
      },
      { retryInsertRace: true },
    );
  }

  /** Writes the current code definition over a seeded board, restoring it if deleted. */
  async reset(
    scope: StoredBoardScope,
    key: string,
    seed: StoredBoardSeed,
    options: { expectedRevision: number; actor: string },
  ): Promise<StoredBoardRecord> {
    await this.#write(scope, async ops => {
      const row = await ops.findOne<BoardRow>(BOARDS, { ...scopeWhere(scope), board_key: key });
      if (!row) throw new StoredBoardError('board_not_found', `Board "${key}" does not exist in this project.`);
      checkRevision(row, key, options.expectedRevision);
      await writeBoard(ops, scope, row, seed.input, options.actor, { customized: false, seed, restore: true });
      return { result: undefined, changed: true };
    });
    return (await this.get(scope, key))!;
  }

  /**
   * Runs `fn` in a transaction and replaces the project's version when it changed anything.
   * Lost races (a concurrent insert of the same key, a compare-and-set miss) retry from fresh reads.
   */
  async #write<T>(
    scope: StoredBoardScope,
    fn: (ops: FactoryStorageOps) => Promise<{ result: T; changed: boolean }>,
    options: { retryInsertRace?: boolean } = {},
  ): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        // Read committed is enough: every row change is a compare-and-set on `revision` and every
        // insert meets the unique index, both retried below. Serializable isolation would also
        // fail seeding of unrelated projects that replicas run side by side.
        return await this.storage.withTransaction(async ops => {
          const { result, changed } = await fn(ops);
          if (changed) await bumpVersion(ops, scope);
          return result;
        });
      } catch (error) {
        const retryable =
          error instanceof ConcurrentBoardWrite || (options.retryInsertRace && error instanceof UniqueViolationError);
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

async function bumpVersion(ops: FactoryStorageOps, scope: StoredBoardScope): Promise<void> {
  await ops.upsertOne(VERSIONS, ['org_id', 'factory_project_id'], {
    ...scopeWhere(scope),
    version: randomUUID(),
    updated_at: new Date(),
  });
}

async function findLive(ops: FactoryStorageOps, scope: StoredBoardScope, key: string): Promise<BoardRow> {
  const row = await ops.findOne<BoardRow>(BOARDS, { ...scopeWhere(scope), board_key: key });
  if (!row || row.deleted_at) {
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
  options: { position: number; actor: string; seed: StoredBoardSeed | null },
): Promise<void> {
  const now = new Date();
  await ops.insertOne<BoardRow>(BOARDS, {
    ...scopeWhere(scope),
    board_key: input.key,
    name: input.name,
    description: input.description ?? null,
    position: options.position,
    revision: 1,
    seed_source: options.seed?.source ?? null,
    seed_hash: options.seed?.hash ?? null,
    drift_hash: null,
    customized: false,
    deleted_at: null,
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
  options: { customized: boolean; seed?: StoredBoardSeed; restore?: boolean },
): Promise<void> {
  await updateRow(ops, row, {
    name: input.name,
    description: input.description ?? null,
    customized: options.customized,
    updated_by: actor,
    ...(options.seed ? { seed_source: options.seed.source, seed_hash: options.seed.hash, drift_hash: null } : {}),
    ...(options.restore ? { deleted_at: null } : {}),
  });
  await ops.deleteMany(PHASES, { ...scopeWhere(scope), board_key: row.board_key });
  await insertPhases(ops, scope, { ...input, key: row.board_key });
}
