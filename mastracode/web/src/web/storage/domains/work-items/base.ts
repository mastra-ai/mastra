/**
 * Factory work items domain — the unified record behind the Factory kanban
 * board.
 *
 * One `work_items` row represents a unit of work (a GitHub issue/PR, a Linear
 * issue, or a manually filed card) as it moves across board stages. Stages are
 * plain strings inside json (`intake` → `execute` → `review` → `done` today),
 * so evolving the board's columns never needs a schema change. A single item
 * can sit in several stages at once (e.g. `['execute','review']`).
 *
 * Tenancy is **org-first**, like `source_control_projects`: the board is shared
 * by the whole org, scoped to one project. `created_by` and the per-entry `by` /
 * `startedBy` fields record who did what, but never scope reads.
 *
 * Stage history is appended exclusively here (server-side) on every stage
 * transition so it can never drift from `stages`. Concurrent read-modify-
 * writes of `stageHistory`/`sessions`/`metadata` ride the backend's
 * `updateAtomic` (pg: `FOR UPDATE` transaction; libsql: serialized writer) so
 * merges never silently drop each other.
 */

import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

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
  title: string;
  url: string | null;
  stages: string[];
  sessions: Record<string, WorkItemSessionInput>;
  metadata: Record<string, unknown>;
}

export interface UpdateWorkItemInput {
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
  { created: true; item: WorkItemRow } | { created: false; item: WorkItemRow; previous: WorkItemPriorState };

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
 * stamped. Centralized so patch semantics can never diverge between the
 * upsert-reuse and PATCH paths.
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

export const WORK_ITEMS_SCHEMA: CollectionSchema = {
  name: 'work_items',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    created_by: { type: 'text' },
    github_project_id: { type: 'text' },
    source: { type: 'text' },
    source_key: { type: 'text', nullable: true },
    title: { type: 'text' },
    url: { type: 'text', nullable: true },
    stages: { type: 'json' },
    stage_history: { type: 'json' },
    sessions: { type: 'json' },
    metadata: { type: 'json' },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [
    // Acting twice on the same issue must not duplicate the card; manual
    // cards (NULL source_key) may repeat freely.
    {
      name: 'work_items_org_project_source_key_unique',
      columns: ['org_id', 'github_project_id', 'source_key'],
      whereNotNull: 'source_key',
    },
  ],
};

/** Column shape of one `work_items` row as returned by ops. */
interface WorkItemDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  created_by: string;
  github_project_id: string;
  source: WorkItemRow['source'];
  source_key: string | null;
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

/** Map a computed camelCase patch onto `work_items` column names. */
function patchColumns(changes: Partial<WorkItemRow>): Partial<WorkItemDbRow> {
  const set: Partial<WorkItemDbRow> = {};
  if (changes.updatedAt !== undefined) set.updated_at = changes.updatedAt;
  if (changes.title !== undefined) set.title = changes.title;
  if (changes.url !== undefined) set.url = changes.url;
  if (changes.stages !== undefined) set.stages = changes.stages;
  if (changes.stageHistory !== undefined) set.stage_history = changes.stageHistory;
  if (changes.sessions !== undefined) set.sessions = changes.sessions;
  if (changes.metadata !== undefined) set.metadata = changes.metadata;
  return set;
}

/**
 * Work item storage, written once against the generic `FactoryStorageOps`
 * surface. Query methods are the typed surface the factory routes consume.
 */
export class WorkItemsStorage extends FactoryStorageDomain {
  constructor() {
    super('work-items');
  }

  async init(): Promise<void> {
    await this.ensureCollections([WORK_ITEMS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('work_items', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  /** List the org's work items for a project, newest first. */
  async list(orgId: string, githubProjectId: string): Promise<WorkItemRow[]> {
    const rows = await this.#db.findMany<WorkItemDbRow>(
      'work_items',
      { org_id: orgId, github_project_id: githubProjectId },
      { orderBy: [['updated_at', 'desc']] },
    );
    return rows.map(toRow);
  }

  /**
   * Atomically patch the row matching `where` via `computeWorkItemPatch`.
   * Returns `null` when no row matches.
   */
  async #applyUpdateAtomic(
    where: Record<string, string>,
    patch: UpdateWorkItemInput,
    userId: string,
  ): Promise<{ item: WorkItemRow; previous: WorkItemPriorState } | null> {
    let previous: WorkItemPriorState | undefined;
    const updated = await this.#db.updateAtomic<WorkItemDbRow>('work_items', where, row => {
      const computed = computeWorkItemPatch(toRow(row), patch, userId, new Date());
      previous = computed.previous;
      return patchColumns(computed.changes);
    });
    return updated && previous ? { item: toRow(updated), previous } : null;
  }

  /**
   * Create a work item, reusing the existing record when `sourceKey` already
   * has one for the project (acting twice on the same issue must not duplicate
   * the card). On reuse the provided stages replace the current ones (with the
   * transition recorded in history) and sessions/metadata are merged in. The
   * result discriminates insert from reuse so callers can audit the actual
   * outcome.
   */
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
      const updated = await this.#applyUpdateAtomic(
        { org_id: orgId, github_project_id: githubProjectId, source_key: input.sourceKey },
        input,
        userId,
      );
      return updated ? { created: false, item: updated.item, previous: updated.previous } : null;
    };

    const reused = await reuseExisting();
    if (reused) return reused;

    try {
      const inserted = await this.#db.insertOne<WorkItemDbRow>('work_items', {
        org_id: orgId,
        created_by: userId,
        github_project_id: githubProjectId,
        source: input.source,
        source_key: input.sourceKey,
        title: input.title,
        url: input.url,
        stages: input.stages,
        stage_history: applyStageTransition([], [], input.stages, userId, now),
        sessions: stampSessions(input.sessions, userId),
        metadata: input.metadata,
        created_at: now,
        updated_at: now,
      });
      return { created: true, item: toRow(inserted) };
    } catch (err) {
      if (!(err instanceof UniqueViolationError)) throw err;
      // Concurrent create for the same sourceKey: the unique index won the
      // race — fall back to updating the row it protected.
      const fallback = await reuseExisting();
      if (fallback) return fallback;
      throw err;
    }
  }

  /**
   * Patch an org's work item: stage changes are diffed into history, sessions
   * and metadata are merged. Returns the updated row plus the pre-patch stages
   * and session roles (for audit diffing), or `null` when the item doesn't
   * exist in the caller's org.
   */
  async update(
    orgId: string,
    id: string,
    userId: string,
    patch: UpdateWorkItemInput,
  ): Promise<{ item: WorkItemRow; previous: WorkItemPriorState } | null> {
    return this.#applyUpdateAtomic({ id, org_id: orgId }, patch, userId);
  }

  /** Delete an org's work item. Returns the row actually deleted, or `null` when it doesn't exist in the org. */
  async delete(orgId: string, id: string): Promise<WorkItemRow | null> {
    const row = await this.#db.findOne<WorkItemDbRow>('work_items', { id, org_id: orgId });
    if (!row) return null;
    const deleted = await this.#db.deleteMany('work_items', { id, org_id: orgId });
    return deleted > 0 ? toRow(row) : null;
  }
}
