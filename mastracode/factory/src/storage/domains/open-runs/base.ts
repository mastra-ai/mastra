/**
 * The open-run ledger: one row per Factory run, shared by every replica. Each write touches only its
 * own run's row, so no writer can erase an entry another writer added; ownership checks ride on the
 * write itself instead of a read before it.
 *
 * A row lives through three states: open; ended (how and when the run ended, set once, readable by
 * a waiter in another process that never saw the run's `agent_end`); and closed (its end is on the
 * audit log, so it is off the ledger). Closed rows are kept for {@link FACTORY_RUN_END_RETENTION_MS}
 * so a late waiter still reads the end, then pruned.
 */

import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';
import { z } from 'zod';

export const factoryOpenRunSchema = z.object({
  kickoffId: z.string(),
  bindingId: z.string(),
  role: z.string(),
  startedBy: z.string(),
  orgId: z.string(),
  factoryProjectId: z.string(),
  workItemId: z.string(),
  workItemName: z.string().optional(),
  sessionId: z.string(),
  threadId: z.string(),
  branch: z.string(),
  /**
   * Which dispatcher process is watching this run, and when it last said so (epoch ms). The ledger
   * is shared by every replica, so a remote reader needs these to tell a run that is live elsewhere
   * from one that died with its process. Absent on entries written before ownership was recorded;
   * those read as stale.
   */
  ownerId: z.string().optional(),
  heartbeatAt: z.number().optional(),
  /** When the kickoff was accepted (epoch ms), so the run's end record spans the whole run. Absent on older entries. */
  startedAt: z.number().optional(),
});

export type FactoryOpenRun = z.infer<typeof factoryOpenRunSchema>;

export type FactoryRunEndReason = 'complete' | 'aborted' | 'error';

/** How a run ended. */
export interface FactoryRunEnd {
  reason: FactoryRunEndReason;
  endedAt: number;
}

/** How long a closed run's row, and so its end, stays readable. */
export const FACTORY_RUN_END_RETENTION_MS = 24 * 60 * 60 * 1000;

export const FACTORY_OPEN_RUNS_SCHEMA: CollectionSchema = {
  name: 'factory_open_runs',
  columns: {
    kickoff_id: { type: 'text', primaryKey: true },
    binding_id: { type: 'text' },
    role: { type: 'text' },
    started_by: { type: 'text' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    work_item_id: { type: 'text' },
    work_item_name: { type: 'text', nullable: true },
    session_id: { type: 'text' },
    thread_id: { type: 'text' },
    branch: { type: 'text' },
    owner_id: { type: 'text', nullable: true },
    heartbeat_at: { type: 'bigint', nullable: true },
    started_at: { type: 'bigint', nullable: true },
    end_reason: { type: 'text', nullable: true },
    ended_at: { type: 'bigint', nullable: true },
    closed_at: { type: 'bigint', nullable: true },
    created_at: { type: 'timestamp' },
  },
  indexes: [{ name: 'factory_open_runs_thread', columns: ['thread_id'] }],
};

/**
 * Open runs copied from the `factoryOpenRuns` thread setting, by kickoff. Each is copied at most
 * once, so a copied run that has since ended never comes back from a setting not yet cleared.
 */
export const FACTORY_OPEN_RUN_IMPORTS_SCHEMA: CollectionSchema = {
  name: 'factory_open_run_imports',
  columns: {
    kickoff_id: { type: 'text', primaryKey: true },
    imported_at: { type: 'timestamp' },
  },
};

interface OpenRunDbRow extends Record<string, unknown> {
  kickoff_id: string;
  binding_id: string;
  role: string;
  started_by: string;
  org_id: string;
  factory_project_id: string;
  work_item_id: string;
  work_item_name: string | null;
  session_id: string;
  thread_id: string;
  branch: string;
  owner_id: string | null;
  heartbeat_at: number | null;
  started_at: number | null;
  end_reason: FactoryRunEndReason | null;
  ended_at: number | null;
  closed_at: number | null;
  created_at: Date;
}

function toRow(run: FactoryOpenRun, createdAt: Date): OpenRunDbRow {
  return {
    kickoff_id: run.kickoffId,
    binding_id: run.bindingId,
    role: run.role,
    started_by: run.startedBy,
    org_id: run.orgId,
    factory_project_id: run.factoryProjectId,
    work_item_id: run.workItemId,
    work_item_name: run.workItemName ?? null,
    session_id: run.sessionId,
    thread_id: run.threadId,
    branch: run.branch,
    owner_id: run.ownerId ?? null,
    heartbeat_at: run.heartbeatAt ?? null,
    started_at: run.startedAt ?? null,
    end_reason: null,
    ended_at: null,
    closed_at: null,
    created_at: createdAt,
  };
}

function toRun(row: OpenRunDbRow): FactoryOpenRun {
  return {
    kickoffId: row.kickoff_id,
    bindingId: row.binding_id,
    role: row.role,
    startedBy: row.started_by,
    orgId: row.org_id,
    factoryProjectId: row.factory_project_id,
    workItemId: row.work_item_id,
    ...(row.work_item_name !== null ? { workItemName: row.work_item_name } : {}),
    sessionId: row.session_id,
    threadId: row.thread_id,
    branch: row.branch,
    ...(row.owner_id !== null ? { ownerId: row.owner_id } : {}),
    ...(row.heartbeat_at !== null ? { heartbeatAt: row.heartbeat_at } : {}),
    ...(row.started_at !== null ? { startedAt: row.started_at } : {}),
  };
}

/** The row still carries the owner and heartbeat it was read with; anything else is a newer write. */
function asRead(run: FactoryOpenRun) {
  return { kickoff_id: run.kickoffId, owner_id: run.ownerId ?? null, heartbeat_at: run.heartbeatAt ?? null };
}

class OpenRunTakeoverConflict extends Error {}

export class OpenRunsStorage extends FactoryStorageDomain {
  constructor() {
    super('open-runs');
  }

  async init(): Promise<void> {
    await this.ensureCollections([FACTORY_OPEN_RUNS_SCHEMA, FACTORY_OPEN_RUN_IMPORTS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('factory_open_runs', {});
    await this.ops.deleteMany('factory_open_run_imports', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  /** The runs of `threadId` still on the ledger, oldest first; an ended run stays on it until closed. */
  async listByThread(threadId: string): Promise<FactoryOpenRun[]> {
    const rows = await this.#db.findMany<OpenRunDbRow>(
      'factory_open_runs',
      { thread_id: threadId, closed_at: null },
      {
        orderBy: [
          ['created_at', 'asc'],
          ['kickoff_id', 'asc'],
        ],
      },
    );
    return rows.map(toRun);
  }

  /** Opens `run`. Resolves `false` when its kickoff is already open, leaving that entry as it is. */
  async open(run: FactoryOpenRun): Promise<boolean> {
    try {
      await this.#db.insertOne('factory_open_runs', toRow(run, new Date()));
      return true;
    } catch (error) {
      if (error instanceof UniqueViolationError) return false;
      throw error;
    }
  }

  /** Renews `ownerId`'s claim on a run. Resolves `false` when the run ended or another worker owns it now. */
  async heartbeat(kickoffId: string, ownerId: string, at: number): Promise<boolean> {
    return (
      (await this.#db.updateMany(
        'factory_open_runs',
        { kickoff_id: kickoffId, owner_id: ownerId, ended_at: null },
        { heartbeat_at: at },
      )) > 0
    );
  }

  /** A run and, once it ended, how; closed runs included until pruned. */
  async get(kickoffId: string): Promise<{ run: FactoryOpenRun; end?: FactoryRunEnd } | undefined> {
    const row = await this.#db.findOne<OpenRunDbRow>('factory_open_runs', { kickoff_id: kickoffId });
    if (!row) return undefined;
    return {
      run: toRun(row),
      ...(row.end_reason !== null && row.ended_at !== null
        ? { end: { reason: row.end_reason, endedAt: row.ended_at } }
        : {}),
    };
  }

  /**
   * Records how a run ended, in one write to its row. The first end wins; resolves `false` when
   * the run already ended or is not on the ledger.
   */
  async end(kickoffId: string, { reason, endedAt }: FactoryRunEnd): Promise<boolean> {
    return (
      (await this.#db.updateMany(
        'factory_open_runs',
        { kickoff_id: kickoffId, ended_at: null, closed_at: null },
        { end_reason: reason, ended_at: endedAt },
      )) > 0
    );
  }

  /**
   * Takes an ended run off the ledger once its end is on the audit log. Its row, and so its end,
   * stays readable for {@link FACTORY_RUN_END_RETENTION_MS}; closing a run prunes its thread's
   * closed runs older than that.
   */
  async close(run: Pick<FactoryOpenRun, 'kickoffId' | 'threadId'>, at: number): Promise<void> {
    await this.#db.updateMany('factory_open_runs', { kickoff_id: run.kickoffId, closed_at: null }, { closed_at: at });
    const closed = await this.#db.findMany<OpenRunDbRow>('factory_open_runs', { thread_id: run.threadId });
    for (const row of closed) {
      if (row.closed_at === null || at - row.closed_at < FACTORY_RUN_END_RETENTION_MS) continue;
      await this.#db.deleteMany('factory_open_runs', { kickoff_id: row.kickoff_id, closed_at: row.closed_at });
    }
  }

  /**
   * Ends the `lost` runs, as they were read, as aborted and opens `resume`, in one transaction.
   * Resolves `false`, changing nothing, when any lost run ended, left the ledger, or carries another
   * owner or heartbeat than was read: another worker took it over, or its run came back. A waiter
   * on a lost run reads its aborted end from its row; each lost run stays on the ledger until its
   * end is on the audit log, like any other ended run.
   */
  async takeOver(lost: readonly FactoryOpenRun[], resume: FactoryOpenRun): Promise<boolean> {
    const at = Date.now();
    try {
      await this.storage.withTransaction(async ops => {
        for (const run of lost) {
          const ended = await ops.updateMany(
            'factory_open_runs',
            { ...asRead(run), ended_at: null, closed_at: null },
            { end_reason: 'aborted', ended_at: at },
          );
          if (ended !== 1) throw new OpenRunTakeoverConflict();
        }
        await ops.insertOne('factory_open_runs', toRow(resume, new Date(at)));
      });
      return true;
    } catch (error) {
      if (error instanceof OpenRunTakeoverConflict || error instanceof UniqueViolationError) return false;
      throw error;
    }
  }

  /**
   * Copies runs read from `threadId`'s legacy `factoryOpenRuns` setting onto the ledger, each at
   * most once, so a copied run that has since ended never comes back from the setting. The setting
   * is client-writable, so only entries naming `threadId` are copied, and none with a heartbeat
   * later than `now`.
   */
  /** Of `kickoffIds`, those the ledger has held: a run row in any state, or a legacy import. */
  async known(kickoffIds: readonly string[]): Promise<Set<string>> {
    if (kickoffIds.length === 0) return new Set();
    const filter = { kickoff_id: { in: [...kickoffIds] } };
    const [runs, imports] = await Promise.all([
      this.#db.findMany<{ kickoff_id: string }>('factory_open_runs', filter),
      this.#db.findMany<{ kickoff_id: string }>('factory_open_run_imports', filter),
    ]);
    return new Set([...runs, ...imports].map(row => row.kickoff_id));
  }

  async importLegacy(threadId: string, runs: readonly FactoryOpenRun[], now = Date.now()): Promise<void> {
    const candidates = runs.filter(
      run => run.threadId === threadId && (run.heartbeatAt === undefined || run.heartbeatAt <= now),
    );
    if (candidates.length === 0) return;
    const copied = new Set(
      (
        await this.#db.findMany<{ kickoff_id: string }>('factory_open_run_imports', {
          kickoff_id: { in: candidates.map(run => run.kickoffId) },
        })
      ).map(row => row.kickoff_id),
    );
    for (const run of candidates) {
      if (copied.has(run.kickoffId)) continue;
      try {
        await this.storage.withTransaction(async ops => {
          if (await ops.findOne('factory_open_run_imports', { kickoff_id: run.kickoffId })) return;
          const at = new Date(now);
          await ops.insertOne('factory_open_run_imports', { kickoff_id: run.kickoffId, imported_at: at });
          if (!(await ops.findOne('factory_open_runs', { kickoff_id: run.kickoffId }))) {
            await ops.insertOne('factory_open_runs', toRow(run, at));
          }
        });
      } catch (error) {
        // Another reader copied it, or a run with its kickoff opened, at the same moment; the next
        // read settles it.
        if (!(error instanceof UniqueViolationError)) throw error;
      }
    }
  }
}
