/**
 * Drizzle schema for Factory audit events — the append-only "who did what,
 * when" trail behind the software factory.
 *
 * One `audit_events` row records a single audited mutation (work-item change,
 * stage move, run start, worktree create/delete, git action, intake config
 * change). Rows are append-only: there is no update/delete API, and the table
 * is the local source of truth even when the WorkOS Audit Logs mirror is
 * unavailable.
 *
 * Tenancy is **org-first**, like `work_items`: events are scoped by `org_id`
 * and (usually) `github_project_id`; `actor_id` records who acted but never
 * scopes reads.
 *
 * v1 action taxonomy (register these in the WorkOS dashboard under
 * Audit Logs → Events for the export mirror to accept them):
 *   - factory.work_item.created
 *   - factory.work_item.updated
 *   - factory.work_item.stage_moved
 *   - factory.work_item.deleted
 *   - factory.run.started
 *   - factory.worktree.created
 *   - factory.worktree.deleted
 *   - factory.triage.started
 *   - factory.git.commit
 *   - factory.git.push
 *   - factory.git.pr_opened
 *   - factory.intake.config_updated
 */

import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** What an audit event acted on (WorkOS Audit Logs target shape). */
export interface AuditTarget {
  /** Target kind, e.g. 'work_item', 'worktree', 'issue', 'pull_request'. */
  type: string;
  /** Stable identifier of the target (row id, branch name, issue number...). */
  id: string;
  /** Human-readable label (work-item title, branch name...). */
  name?: string;
}

/** Request context captured alongside the event. */
export interface AuditContext {
  /** Client IP (first hop of `x-forwarded-for`) when available. */
  location?: string;
  /** Request `user-agent` header when available. */
  userAgent?: string;
}

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Owning WorkOS organization id — the trail is org-wide. */
    orgId: text('org_id').notNull(),
    /** WorkOS user id of whoever performed the action. */
    actorId: text('actor_id').notNull(),
    /** Dot-namespaced action, e.g. 'factory.work_item.stage_moved'. */
    action: text('action').notNull(),
    /** What was acted on. */
    targets: jsonb('targets').$type<AuditTarget[]>().notNull(),
    /** Bounded event summary — never full payloads, never secrets. */
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull(),
    /** Project the event is scoped to; null for org-level events. */
    githubProjectId: uuid('github_project_id'),
    /** Request context (`x-forwarded-for` / `user-agent`). */
    context: jsonb('context').$type<AuditContext>().notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('audit_events_org_occurred_idx').on(table.orgId, table.occurredAt),
    index('audit_events_org_project_occurred_idx').on(table.orgId, table.githubProjectId, table.occurredAt),
  ],
);

export type AuditEventRow = typeof auditEvents.$inferSelect;
export type NewAuditEventRow = typeof auditEvents.$inferInsert;

/**
 * Idempotent DDL run on boot, mirroring the inline-migration pattern of
 * `../factory/schema` (`CREATE ... IF NOT EXISTS` keeps re-runs safe; the
 * schema only grows additively).
 */
export const AUDIT_MIGRATION_SQL = `
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
`;
