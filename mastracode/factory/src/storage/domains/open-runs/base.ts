/**
 * The open-run ledger: one row per Factory run that started and has not ended yet, shared by every
 * replica. Each write touches only its own run's row, so no writer can erase an entry another
 * writer added; ownership checks ride on the write itself instead of a read before it.
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

  /** The open runs of `threadId`, oldest first. */
  async listByThread(threadId: string): Promise<FactoryOpenRun[]> {
    const rows = await this.#db.findMany<OpenRunDbRow>(
      'factory_open_runs',
      { thread_id: threadId },
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
        { kickoff_id: kickoffId, owner_id: ownerId },
        { heartbeat_at: at },
      )) > 0
    );
  }

  /** Takes a run off the ledger. */
  async close(kickoffId: string): Promise<void> {
    await this.#db.deleteMany('factory_open_runs', { kickoff_id: kickoffId });
  }

  /**
   * Copies runs read from the legacy `factoryOpenRuns` thread setting onto the ledger, each at
   * most once. Resolves the kickoffs now copied, including ones an earlier call copied, so the
   * caller can drop them from the setting.
   */
  async importLegacy(runs: readonly FactoryOpenRun[]): Promise<string[]> {
    const copied: string[] = [];
    for (const run of runs) {
      try {
        await this.storage.withTransaction(async ops => {
          if (await ops.findOne('factory_open_run_imports', { kickoff_id: run.kickoffId })) return;
          const now = new Date();
          await ops.insertOne('factory_open_run_imports', { kickoff_id: run.kickoffId, imported_at: now });
          if (!(await ops.findOne('factory_open_runs', { kickoff_id: run.kickoffId }))) {
            await ops.insertOne('factory_open_runs', toRow(run, now));
          }
        });
      } catch (error) {
        // Another reader copied it at the same moment.
        if (!(error instanceof UniqueViolationError)) throw error;
      }
      copied.push(run.kickoffId);
    }
    return copied;
  }
}
