/**
 * Postgres audit event storage, bound to the shared pool from the
 * `PostgresStore` injected into `MastraFactory`. `init()` owns the idempotent
 * DDL (formerly `AUDIT_MIGRATION_SQL` + `ensureAuditDbReady()`); the schema
 * only grows additively, so `CREATE ... IF NOT EXISTS` keeps re-runs safe.
 */

import type pg from 'pg';

import type { FactoryStorageContext } from '../../domain';
import { AuditStorage, clampAuditLimit, decodeAuditCursor, encodeAuditCursor } from './base';
import type { AuditEventInsert, AuditEventPage, AuditEventRow, ListAuditEventsInput } from './base';

export const AUDIT_DDL = `
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  actor_id text NOT NULL,
  action text NOT NULL,
  targets jsonb NOT NULL,
  metadata jsonb NOT NULL,
  github_project_id uuid,
  context jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_org_occurred_idx
  ON audit_events (org_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_org_project_occurred_idx
  ON audit_events (org_id, github_project_id, occurred_at DESC);

ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS actor_type text NOT NULL DEFAULT 'human';
`;

interface AuditEventDbRow {
  id: string;
  org_id: string;
  actor_id: string;
  actor_type: AuditEventRow['actorType'];
  action: string;
  targets: AuditEventRow['targets'];
  metadata: Record<string, unknown>;
  github_project_id: string | null;
  context: AuditEventRow['context'];
  occurred_at: Date;
}

function toRow(db: AuditEventDbRow): AuditEventRow {
  return {
    id: db.id,
    orgId: db.org_id,
    actorId: db.actor_id,
    actorType: db.actor_type,
    action: db.action,
    targets: db.targets,
    metadata: db.metadata,
    githubProjectId: db.github_project_id,
    context: db.context,
    occurredAt: db.occurred_at,
  };
}

export class AuditStoragePG extends AuditStorage {
  #pool?: pg.Pool;

  async init(ctx: FactoryStorageContext): Promise<void> {
    await ctx.pool.query(AUDIT_DDL);
    this.#pool = ctx.pool;
  }

  get #db(): pg.Pool {
    if (!this.#pool) throw new Error('[AuditStoragePG] Not initialized — init() has not succeeded.');
    return this.#pool;
  }

  protected async insert(row: AuditEventInsert): Promise<AuditEventRow> {
    const { rows } = await this.#db.query<AuditEventDbRow>(
      `INSERT INTO audit_events
         (org_id, actor_id, actor_type, action, targets, metadata, github_project_id, context, occurred_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8::jsonb, $9)
       RETURNING *`,
      [
        row.orgId,
        row.actorId,
        row.actorType,
        row.action,
        JSON.stringify(row.targets),
        JSON.stringify(row.metadata),
        row.githubProjectId,
        JSON.stringify(row.context),
        row.occurredAt,
      ],
    );
    return toRow(rows[0]!);
  }

  async list(input: ListAuditEventsInput): Promise<AuditEventPage> {
    const limit = clampAuditLimit(input.limit);

    const conditions: string[] = ['org_id = $1'];
    const params: unknown[] = [input.orgId];
    const next = (value: unknown): number => {
      params.push(value);
      return params.length;
    };

    if (input.githubProjectId) conditions.push(`github_project_id = $${next(input.githubProjectId)}`);
    if (input.actions && input.actions.length > 0) conditions.push(`action = ANY($${next(input.actions)})`);
    if (input.actorId) conditions.push(`actor_id = $${next(input.actorId)}`);

    if (input.before) {
      const cursor = decodeAuditCursor(input.before);
      if (cursor) {
        const at = next(cursor.occurredAt);
        const id = next(cursor.id);
        conditions.push(`(occurred_at < $${at} OR (occurred_at = $${at} AND id < $${id}))`);
      }
    }

    const { rows } = await this.#db.query<AuditEventDbRow>(
      `SELECT * FROM audit_events
       WHERE ${conditions.join(' AND ')}
       ORDER BY occurred_at DESC, id DESC
       LIMIT $${next(limit + 1)}`,
      params,
    );

    const events = rows.slice(0, limit).map(toRow);
    const hasMore = rows.length > limit;
    const last = events[events.length - 1];
    return {
      events,
      ...(hasMore && last ? { nextCursor: encodeAuditCursor(last) } : {}),
    };
  }
}
