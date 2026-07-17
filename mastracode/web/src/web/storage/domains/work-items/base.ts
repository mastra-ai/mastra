/**
 * Factory work items domain — the unified record behind the Factory kanban
 * board.
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
 *
 * Stage history is appended exclusively here (server-side) on every stage
 * transition so it can never drift from `stages`.
 */

import type { FactoryStorageContext, FactoryStorageDomain } from '../../domain';

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

/** One persisted work item. */
export interface WorkItemRow {
  id: string;
  /** Owning WorkOS organization id — the board is org-wide. */
  orgId: string;
  /** WorkOS user id of whoever materialized the record (audit only). */
  createdBy: string;
  /** Project (org-owned) the board belongs to. */
  githubProjectId: string;
  source: WorkItemSource;
  /** Dedupe key (e.g. 'github-issue:123', 'linear:ENG-42'); null for manual cards. */
  sourceKey: string | null;
  /** Optional originating issue item for a separate PR review item. */
  parentWorkItemId: string | null;
  title: string;
  /** External link (issue/PR); null for manual cards. */
  url: string | null;
  /** Current stages, e.g. ['execute','review']. */
  stages: string[];
  /** Server-appended stage transition log. */
  stageHistory: WorkItemStageEntry[];
  /** Sessions keyed by role ('work' | 'review' | ...). */
  sessions: Record<string, WorkItemSessionRef>;
  /** Flexible source payload (issue number, labels, headBranch, ...). */
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/** Session ref as accepted from clients — `startedBy` is stamped server-side. */
export interface WorkItemSessionInput {
  projectPath: string;
  branch: string;
  threadId: string;
}

export interface CreateWorkItemInput {
  source: WorkItemSource;
  sourceKey: string | null;
  parentWorkItemId?: string | null;
  title: string;
  url: string | null;
  stages: string[];
  sessions: Record<string, WorkItemSessionInput>;
  metadata: Record<string, unknown>;
}

export interface UpdateWorkItemInput {
  parentWorkItemId?: string | null;
  title?: string;
  url?: string | null;
  stages?: string[];
  sessions?: Record<string, WorkItemSessionInput>;
  metadata?: Record<string, unknown>;
}

/** Pre-patch state returned alongside an update so callers can diff for auditing. */
export interface WorkItemPriorState {
  stages: string[];
  sessionRoles: string[];
}

/** Discriminated result of `upsert`: fresh insert vs source-key reuse. */
export type UpsertWorkItemResult =
  | { created: true; item: WorkItemRow }
  | { created: false; item: WorkItemRow; previous: WorkItemPriorState };

export class WorkItemRelationError extends Error {
  readonly code = 'invalid_work_item_relation';
}

export function validateParentRelation(
  projectItems: WorkItemRow[],
  itemId: string | undefined,
  parentWorkItemId: string | null,
): void {
  if (parentWorkItemId === null) return;
  const byId = new Map(projectItems.map(item => [item.id, item]));
  const parent = byId.get(parentWorkItemId);
  if (!parent) throw new WorkItemRelationError('Related work item not found in this project.');
  if (itemId === parentWorkItemId) throw new WorkItemRelationError('A work item cannot relate to itself.');

  const visited = new Set<string>();
  let cursor: WorkItemRow | undefined = parent;
  while (cursor?.parentWorkItemId) {
    if (cursor.parentWorkItemId === itemId) {
      throw new WorkItemRelationError('This relationship would create a cycle.');
    }
    if (visited.has(cursor.id)) throw new WorkItemRelationError('The related work item chain contains a cycle.');
    visited.add(cursor.id);
    cursor = byId.get(cursor.parentWorkItemId);
  }
}

/**
 * Diff `oldStages` → `newStages` and return the updated history: exited stages
 * get `exitedAt` stamped on their open entry, entered stages get a new entry.
 */
export function applyStageTransition(
  history: WorkItemStageEntry[],
  oldStages: string[],
  newStages: string[],
  by: string,
  now: Date,
): WorkItemStageEntry[] {
  const timestamp = now.toISOString();
  const next = history.map(entry => ({ ...entry }));
  for (const stage of oldStages) {
    if (newStages.includes(stage)) continue;
    // Close the most recent open entry for the exited stage.
    for (let i = next.length - 1; i >= 0; i--) {
      const entry = next[i]!;
      if (entry.stage === stage && entry.exitedAt === undefined) {
        entry.exitedAt = timestamp;
        break;
      }
    }
  }
  for (const stage of newStages) {
    if (oldStages.includes(stage)) continue;
    next.push({ stage, enteredAt: timestamp, by });
  }
  return next;
}

/** Stamp `startedBy` onto client-supplied session refs. */
export function stampSessions(
  sessions: Record<string, WorkItemSessionInput>,
  by: string,
): Record<string, WorkItemSessionRef> {
  const stamped: Record<string, WorkItemSessionRef> = {};
  for (const [role, ref] of Object.entries(sessions)) {
    stamped[role] = { ...ref, startedBy: by };
  }
  return stamped;
}

/**
 * Compute the fields an update patch changes on `existing`: stage changes are
 * diffed into history, sessions and metadata are merged, `updatedAt` is always
 * stamped. Shared by backends so patch semantics can never diverge; each
 * backend is responsible for serializing concurrent read-modify-writes (e.g.
 * `FOR UPDATE` in Postgres).
 */
export function computeWorkItemPatch(
  existing: WorkItemRow,
  patch: UpdateWorkItemInput,
  userId: string,
  now: Date,
): { changes: Partial<WorkItemRow>; previous: WorkItemPriorState } {
  const previous: WorkItemPriorState = {
    stages: [...existing.stages],
    sessionRoles: Object.keys(existing.sessions),
  };
  const changes: Partial<WorkItemRow> = { updatedAt: now };
  if (patch.parentWorkItemId !== undefined) changes.parentWorkItemId = patch.parentWorkItemId;
  if (patch.title !== undefined) changes.title = patch.title;
  if (patch.url !== undefined) changes.url = patch.url;
  if (patch.stages !== undefined) {
    changes.stages = patch.stages;
    changes.stageHistory = applyStageTransition(existing.stageHistory, existing.stages, patch.stages, userId, now);
  }
  if (patch.sessions !== undefined && Object.keys(patch.sessions).length > 0) {
    changes.sessions = { ...existing.sessions, ...stampSessions(patch.sessions, userId) };
  }
  if (patch.metadata !== undefined && Object.keys(patch.metadata).length > 0) {
    changes.metadata = { ...existing.metadata, ...patch.metadata };
  }
  return { changes, previous };
}

/**
 * Abstract work item storage. Backends own their DDL in `init()`; query
 * methods are the typed surface the factory routes consume.
 */
export abstract class WorkItemsStorage implements FactoryStorageDomain {
  readonly name = 'work-items';

  abstract init(ctx: FactoryStorageContext): Promise<void>;

  /** List the org's work items for a project, newest first. */
  abstract list(orgId: string, githubProjectId: string): Promise<WorkItemRow[]>;

  /**
   * Create a work item, reusing the existing record when `sourceKey` already
   * has one for the project (acting twice on the same issue must not duplicate
   * the card). On reuse the provided stages replace the current ones (with the
   * transition recorded in history) and sessions/metadata are merged in. The
   * result discriminates insert from reuse so callers can audit the actual
   * outcome.
   */
  abstract upsert(params: {
    orgId: string;
    userId: string;
    githubProjectId: string;
    input: CreateWorkItemInput;
  }): Promise<UpsertWorkItemResult>;

  /**
   * Patch an org's work item: stage changes are diffed into history, sessions
   * and metadata are merged. Returns the updated row plus the pre-patch stages
   * and session roles (for audit diffing), or `null` when the item doesn't
   * exist in the caller's org.
   */
  abstract update(
    orgId: string,
    id: string,
    userId: string,
    patch: UpdateWorkItemInput,
  ): Promise<{ item: WorkItemRow; previous: WorkItemPriorState } | null>;

  /** Delete an org's work item. Returns the row actually deleted, or `null` when it doesn't exist in the org. */
  abstract delete(orgId: string, id: string): Promise<WorkItemRow | null>;
}
