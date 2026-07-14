/**
 * Drizzle schema for Factory work items — the unified record behind the
 * Factory kanban board.
 *
 * One `work_items` row represents a unit of work (a GitHub issue/PR, a Linear
 * issue, or a manually filed card) as it moves across board stages. Stages are
 * plain strings inside jsonb (`intake` → `execute` → `review` → `done` today),
 * so evolving the board's columns never needs a schema change. A single item
 * can sit in several stages at once (e.g. `['execute','review']`).
 *
 * Tenancy is **org-first**, like `github_projects`: the board is shared by the
 * whole org, scoped to one project. `created_by` and the per-entry `by` /
 * `startedBy` fields record who did what, but never scope reads.
 */

import { sql } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/** Where a work item was materialized from. */
export type WorkItemSource = 'github-issue' | 'github-pr' | 'linear-issue' | 'manual';

/** A session/thread attached to a work item, keyed by role (`work`, `review`, ...). */
export interface WorkItemSessionRef {
  /** Worktree path the scoped agent-controller session is keyed by. */
  projectPath: string;
  /** Feature branch the worktree checks out. */
  branch: string;
  /** Agent-controller thread id for the role's conversation. */
  threadId: string;
  /** WorkOS user id whose sandbox/worktree the session runs in. */
  startedBy: string;
}

/** One stage-transition record, appended server-side (never client-supplied). */
export interface WorkItemStageEntry {
  stage: string;
  /** ISO timestamp the item entered the stage. */
  enteredAt: string;
  /** ISO timestamp the item left the stage; absent while still in it. */
  exitedAt?: string;
  /** WorkOS user id who performed the transition. */
  by: string;
}

export const workItems = pgTable(
  'work_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Owning WorkOS organization id — the board is org-wide. */
    orgId: text('org_id').notNull(),
    /** WorkOS user id of whoever materialized the record (audit only). */
    createdBy: text('created_by').notNull(),
    /** Project (org-owned) the board belongs to. */
    githubProjectId: uuid('github_project_id').notNull(),
    /** 'github-issue' | 'github-pr' | 'linear-issue' | 'manual'. */
    source: text('source').notNull(),
    /** Dedupe key (e.g. 'github-issue:123', 'linear:ENG-42'); null for manual cards. */
    sourceKey: text('source_key'),
    title: text('title').notNull(),
    /** External link (issue/PR); null for manual cards. */
    url: text('url'),
    /** Current stages, e.g. ['execute','review']. */
    stages: jsonb('stages').$type<string[]>().notNull(),
    /** Server-appended stage transition log. */
    stageHistory: jsonb('stage_history').$type<WorkItemStageEntry[]>().notNull(),
    /** Sessions keyed by role ('work' | 'review' | ...). */
    sessions: jsonb('sessions').$type<Record<string, WorkItemSessionRef>>().notNull(),
    /** Flexible source payload (issue number, labels, headBranch, ...). */
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    // One card per issue/PR per org project. Partial: manual cards (null
    // source_key) are never deduped.
    uniqueIndex('work_items_project_source_key_unique')
      .on(table.githubProjectId, table.sourceKey)
      .where(sql`source_key IS NOT NULL`),
  ],
);

export type WorkItemRow = typeof workItems.$inferSelect;
export type NewWorkItemRow = typeof workItems.$inferInsert;

/**
 * Idempotent DDL run on boot when the Factory feature is ready, mirroring the
 * inline-migration pattern of `../github/schema` (`CREATE ... IF NOT EXISTS`
 * keeps re-runs safe; the schema only grows additively).
 */
export const FACTORY_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id text NOT NULL,
  created_by text NOT NULL,
  github_project_id uuid NOT NULL,
  source text NOT NULL,
  source_key text,
  title text NOT NULL,
  url text,
  stages jsonb NOT NULL,
  stage_history jsonb NOT NULL,
  sessions jsonb NOT NULL,
  metadata jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS work_items_project_source_key_unique
  ON work_items (github_project_id, source_key)
  WHERE source_key IS NOT NULL;
`;
