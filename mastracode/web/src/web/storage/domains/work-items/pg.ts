/**
 * Postgres work item storage, bound to the shared pool from the
 * `PostgresStore` injected into `MastraFactory`. `init()` owns the idempotent
 * DDL (formerly `FACTORY_MIGRATION_SQL` + `ensureFactoryDbReady()`).
 *
 * Updates run inside a transaction with the row read `FOR UPDATE` so
 * concurrent read-modify-writes of `stageHistory`/`sessions`/`metadata`
 * serialize instead of silently dropping each other's merges.
 */

import type pg from 'pg';

import type { FactoryStorageContext } from '../../domain';
import {
  WorkItemsStorage,
  applyStageTransition,
  computeWorkItemPatch,
  stampSessions,
  validateParentRelation,
} from './base';
import type {
  CreateWorkItemInput,
  UpdateWorkItemInput,
  UpsertWorkItemResult,
  WorkItemPriorState,
  WorkItemRow,
} from './base';

export const WORK_ITEMS_DDL = `
CREATE TABLE IF NOT EXISTS work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  created_by text NOT NULL,
  github_project_id uuid NOT NULL,
  source text NOT NULL,
  source_key text,
  parent_work_item_id uuid,
  title text NOT NULL,
  url text,
  stages jsonb NOT NULL,
  stage_history jsonb NOT NULL,
  sessions jsonb NOT NULL,
  metadata jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS parent_work_item_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'work_items_parent_work_item_id_fkey'
      AND conrelid = 'work_items'::regclass
  ) THEN
    ALTER TABLE work_items
      ADD CONSTRAINT work_items_parent_work_item_id_fkey
      FOREIGN KEY (parent_work_item_id) REFERENCES work_items(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS work_items_project_source_key_unique
  ON work_items (github_project_id, source_key)
  WHERE source_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS work_items_project_parent_idx
  ON work_items (org_id, github_project_id, parent_work_item_id);
`;

interface WorkItemDbRow {
  id: string;
  org_id: string;
  created_by: string;
  github_project_id: string;
  source: WorkItemRow['source'];
  source_key: string | null;
  parent_work_item_id: string | null;
  title: string;
  url: string | null;
  stages: WorkItemRow['stages'];
  stage_history: WorkItemRow['stageHistory'];
  sessions: WorkItemRow['sessions'];
  metadata: WorkItemRow['metadata'];
  created_at: Date;
  updated_at: Date;
}

function toRow(db: WorkItemDbRow): WorkItemRow {
  return {
    id: db.id,
    orgId: db.org_id,
    createdBy: db.created_by,
    githubProjectId: db.github_project_id,
    source: db.source,
    sourceKey: db.source_key,
    parentWorkItemId: db.parent_work_item_id,
    title: db.title,
    url: db.url,
    stages: db.stages,
    stageHistory: db.stage_history,
    sessions: db.sessions,
    metadata: db.metadata,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

/** Serializer per patchable column: jsonb columns are stringified + cast. */
const PATCH_COLUMNS: Record<string, { column: string; jsonb?: boolean }> = {
  updatedAt: { column: 'updated_at' },
  parentWorkItemId: { column: 'parent_work_item_id' },
  title: { column: 'title' },
  url: { column: 'url' },
  stages: { column: 'stages', jsonb: true },
  stageHistory: { column: 'stage_history', jsonb: true },
  sessions: { column: 'sessions', jsonb: true },
  metadata: { column: 'metadata', jsonb: true },
};

export class WorkItemsStoragePG extends WorkItemsStorage {
  #pool?: pg.Pool;

  async init(ctx: FactoryStorageContext): Promise<void> {
    await ctx.pool.query(WORK_ITEMS_DDL);
    this.#pool = ctx.pool;
  }

  get #db(): pg.Pool {
    if (!this.#pool) throw new Error('[WorkItemsStoragePG] Not initialized — init() has not succeeded.');
    return this.#pool;
  }

  async #withTx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.#db.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async #lockProjectRelations(client: pg.PoolClient, orgId: string, githubProjectId: string): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${orgId}:${githubProjectId}`]);
  }

  async #projectItems(client: pg.PoolClient, orgId: string, githubProjectId: string): Promise<WorkItemRow[]> {
    const { rows } = await client.query<WorkItemDbRow>(
      'SELECT * FROM work_items WHERE org_id = $1 AND github_project_id = $2',
      [orgId, githubProjectId],
    );
    return rows.map(toRow);
  }

  async list(orgId: string, githubProjectId: string): Promise<WorkItemRow[]> {
    const { rows } = await this.#db.query<WorkItemDbRow>(
      'SELECT * FROM work_items WHERE org_id = $1 AND github_project_id = $2',
      [orgId, githubProjectId],
    );
    return rows.map(toRow).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async upsert(params: {
    orgId: string;
    userId: string;
    githubProjectId: string;
    input: CreateWorkItemInput;
  }): Promise<UpsertWorkItemResult> {
    const { orgId, userId, githubProjectId, input } = params;
    const now = new Date();

    const reuseExisting = async (): Promise<UpsertWorkItemResult | null> => {
      if (input.sourceKey === null) return null;
      const patch = input.parentWorkItemId === null ? { ...input, parentWorkItemId: undefined } : input;
      const updated = await this.#withTx(client =>
        this.#applyUpdateLocked(
          client,
          'org_id = $1 AND github_project_id = $2 AND source_key = $3',
          [orgId, githubProjectId, input.sourceKey],
          patch,
          userId,
          now,
        ),
      );
      return updated ? { created: false, item: updated.item, previous: updated.previous } : null;
    };

    const reused = await reuseExisting();
    if (reused) return reused;

    const insert = async (db: pg.Pool | pg.PoolClient): Promise<UpsertWorkItemResult> => {
      const { rows } = await db.query<WorkItemDbRow>(
        `INSERT INTO work_items
           (org_id, created_by, github_project_id, source, source_key, parent_work_item_id, title, url,
            stages, stage_history, sessions, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13, $14)
         RETURNING *`,
        [
          orgId,
          userId,
          githubProjectId,
          input.source,
          input.sourceKey,
          input.parentWorkItemId ?? null,
          input.title,
          input.url,
          JSON.stringify(input.stages),
          JSON.stringify(applyStageTransition([], [], input.stages, userId, now)),
          JSON.stringify(stampSessions(input.sessions, userId)),
          JSON.stringify(input.metadata),
          now,
          now,
        ],
      );
      return { created: true, item: toRow(rows[0]!) };
    };

    try {
      if (input.parentWorkItemId == null) return await insert(this.#db);
      return await this.#withTx(async client => {
        await this.#lockProjectRelations(client, orgId, githubProjectId);
        validateParentRelation(await this.#projectItems(client, orgId, githubProjectId), undefined, input.parentWorkItemId!);
        return insert(client);
      });
    } catch (err) {
      // Concurrent create for the same sourceKey: the partial unique index won
      // the race — fall back to updating the row it protected.
      const fallback = await reuseExisting();
      if (fallback) return fallback;
      throw err;
    }
  }

  /**
   * Shared update path for upsert-reuse and PATCH. Must run inside a
   * transaction — the row is read with `FOR UPDATE`. Returns `null` when no
   * row matches `whereSql`.
   */
  async #applyUpdateLocked(
    client: pg.PoolClient,
    whereSql: string,
    whereParams: unknown[],
    patch: UpdateWorkItemInput,
    userId: string,
    now: Date,
  ): Promise<{ item: WorkItemRow; previous: WorkItemPriorState } | null> {
    let dbRow: WorkItemDbRow | undefined;
    if (patch.parentWorkItemId === undefined) {
      const { rows } = await client.query<WorkItemDbRow>(
        `SELECT * FROM work_items WHERE ${whereSql} FOR UPDATE`,
        whereParams,
      );
      dbRow = rows[0];
    } else {
      const candidate = await client.query<WorkItemDbRow>(`SELECT * FROM work_items WHERE ${whereSql}`, whereParams);
      if (!candidate.rows[0]) return null;
      await this.#lockProjectRelations(client, candidate.rows[0].org_id, candidate.rows[0].github_project_id);
      const locked = await client.query<WorkItemDbRow>('SELECT * FROM work_items WHERE id = $1 FOR UPDATE', [
        candidate.rows[0].id,
      ]);
      dbRow = locked.rows[0];
    }
    if (!dbRow) return null;
    const existing = toRow(dbRow);
    if (patch.parentWorkItemId !== undefined) {
      validateParentRelation(
        await this.#projectItems(client, existing.orgId, existing.githubProjectId),
        existing.id,
        patch.parentWorkItemId,
      );
    }
    const { changes, previous } = computeWorkItemPatch(existing, patch, userId, now);

    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [field, value] of Object.entries(changes)) {
      const spec = PATCH_COLUMNS[field]!;
      params.push(spec.jsonb ? JSON.stringify(value) : value);
      sets.push(`${spec.column} = $${params.length}${spec.jsonb ? '::jsonb' : ''}`);
    }
    params.push(existing.id);
    const { rows: updatedRows } = await client.query<WorkItemDbRow>(
      `UPDATE work_items SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    return { item: updatedRows[0] ? toRow(updatedRows[0]) : { ...existing, ...changes }, previous };
  }

  async update(
    orgId: string,
    id: string,
    userId: string,
    patch: UpdateWorkItemInput,
  ): Promise<{ item: WorkItemRow; previous: WorkItemPriorState } | null> {
    return this.#withTx(client =>
      this.#applyUpdateLocked(client, 'id = $1 AND org_id = $2', [id, orgId], patch, userId, new Date()),
    );
  }

  async delete(orgId: string, id: string): Promise<WorkItemRow | null> {
    const { rows } = await this.#db.query<WorkItemDbRow>(
      'DELETE FROM work_items WHERE id = $1 AND org_id = $2 RETURNING *',
      [id, orgId],
    );
    return rows[0] ? toRow(rows[0]) : null;
  }
}
