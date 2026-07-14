/**
 * Validation + persistence for Factory work items (the kanban board records).
 *
 * Validation mirrors `../intake/store` — untrusted route bodies are parsed
 * into bounded, sanitized shapes or rejected wholesale. Stage history is
 * appended exclusively here (server-side) on every stage transition so it can
 * never drift from `stages`.
 */

import { and, eq } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import { getAppDb } from '../github/db';
import type { AppDb } from '../github/db';
import { workItems } from './schema';
import type { WorkItemRow, WorkItemSessionRef, WorkItemSource, WorkItemStageEntry } from './schema';

const WORK_ITEM_SOURCES: readonly WorkItemSource[] = ['github-issue', 'github-pr', 'linear-issue', 'manual'];

const MAX_STAGES = 8;
const MAX_STAGE_LENGTH = 64;
const MAX_TITLE_LENGTH = 512;
const MAX_URL_LENGTH = 2048;
const MAX_SOURCE_KEY_LENGTH = 256;
const MAX_SESSION_ROLES = 8;
const MAX_ROLE_LENGTH = 32;
const MAX_SESSION_FIELD_LENGTH = 1024;
const MAX_METADATA_JSON_LENGTH = 16_384;

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Bounded, deduplicated stage list (e.g. `['execute','review']`), or `undefined` when invalid. */
function sanitizeStages(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_STAGES) return undefined;
  const stages = value.filter(
    (v): v is string => typeof v === 'string' && /^[a-z0-9][a-z0-9_-]*$/i.test(v) && v.length <= MAX_STAGE_LENGTH,
  );
  if (stages.length !== value.length) return undefined;
  if (new Set(stages).size !== stages.length) return undefined;
  return stages;
}

/** Non-empty trimmed title within bounds, or `undefined` when invalid. */
function sanitizeTitle(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const title = value.trim();
  if (title.length === 0 || title.length > MAX_TITLE_LENGTH) return undefined;
  return title;
}

/** `http(s)` URL within bounds, `null` for absent, or `undefined` when invalid. */
function sanitizeUrl(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length > MAX_URL_LENGTH) return undefined;
  if (!/^https?:\/\//.test(value)) return undefined;
  return value;
}

/** Dedupe key within bounds, `null` for manual cards, or `undefined` when invalid. */
function sanitizeSourceKey(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_SOURCE_KEY_LENGTH) return undefined;
  return value;
}

/** Role-keyed session refs with bounded string fields, or `undefined` when invalid. */
function sanitizeSessions(value: unknown): Record<string, WorkItemSessionInput> | undefined {
  if (value === undefined) return {};
  if (!isPlainObject(value)) return undefined;
  const entries = Object.entries(value);
  if (entries.length > MAX_SESSION_ROLES) return undefined;
  const sessions: Record<string, WorkItemSessionInput> = {};
  for (const [role, ref] of entries) {
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(role) || role.length > MAX_ROLE_LENGTH) return undefined;
    if (!isPlainObject(ref)) return undefined;
    const { projectPath, branch, threadId } = ref as Record<string, unknown>;
    for (const field of [projectPath, branch, threadId]) {
      if (typeof field !== 'string' || field.length === 0 || field.length > MAX_SESSION_FIELD_LENGTH) return undefined;
    }
    sessions[role] = { projectPath: projectPath as string, branch: branch as string, threadId: threadId as string };
  }
  return sessions;
}

/** Plain metadata object bounded by serialized size, or `undefined` when invalid. */
function sanitizeMetadata(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) return {};
  if (!isPlainObject(value)) return undefined;
  try {
    if (JSON.stringify(value).length > MAX_METADATA_JSON_LENGTH) return undefined;
  } catch {
    return undefined;
  }
  return value;
}

/** Validate an untrusted POST body into a {@link CreateWorkItemInput}, or `null`. */
export function parseCreateWorkItem(body: unknown): CreateWorkItemInput | null {
  if (!isPlainObject(body)) return null;
  const source = body.source;
  if (typeof source !== 'string' || !WORK_ITEM_SOURCES.includes(source as WorkItemSource)) return null;

  const sourceKey = sanitizeSourceKey(body.sourceKey);
  const title = sanitizeTitle(body.title);
  const url = sanitizeUrl(body.url);
  const stages = sanitizeStages(body.stages);
  const sessions = sanitizeSessions(body.sessions);
  const metadata = sanitizeMetadata(body.metadata);
  if (sourceKey === undefined || !title || url === undefined || !stages || !sessions || !metadata) return null;

  return { source: source as WorkItemSource, sourceKey, title, url, stages, sessions, metadata };
}

/** Validate an untrusted PATCH body into an {@link UpdateWorkItemInput}, or `null`. */
export function parseUpdateWorkItem(body: unknown): UpdateWorkItemInput | null {
  if (!isPlainObject(body)) return null;
  const patch: UpdateWorkItemInput = {};

  if ('title' in body) {
    const title = sanitizeTitle(body.title);
    if (!title) return null;
    patch.title = title;
  }
  if ('url' in body) {
    const url = sanitizeUrl(body.url);
    if (url === undefined) return null;
    patch.url = url;
  }
  if ('stages' in body) {
    const stages = sanitizeStages(body.stages);
    if (!stages) return null;
    patch.stages = stages;
  }
  if ('sessions' in body) {
    const sessions = sanitizeSessions(body.sessions);
    if (!sessions) return null;
    patch.sessions = sessions;
  }
  if ('metadata' in body) {
    const metadata = sanitizeMetadata(body.metadata);
    if (!metadata) return null;
    patch.metadata = metadata;
  }

  if (Object.keys(patch).length === 0) return null;
  return patch;
}

/**
 * Diff `oldStages` → `newStages` and return the updated history: exited stages
 * get `exitedAt` stamped on their open entry, entered stages get a new entry.
 */
function applyStageTransition(
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
function stampSessions(sessions: Record<string, WorkItemSessionInput>, by: string): Record<string, WorkItemSessionRef> {
  const stamped: Record<string, WorkItemSessionRef> = {};
  for (const [role, ref] of Object.entries(sessions)) {
    stamped[role] = { ...ref, startedBy: by };
  }
  return stamped;
}

/** List the org's work items for a project, newest first. */
export async function listWorkItems(orgId: string, githubProjectId: string): Promise<WorkItemRow[]> {
  const rows = await getAppDb()
    .select()
    .from(workItems)
    .where(and(eq(workItems.orgId, orgId), eq(workItems.githubProjectId, githubProjectId)));
  return rows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

/**
 * Create a work item, reusing the existing record when `sourceKey` already has
 * one for the project (acting twice on the same issue must not duplicate the
 * card). On reuse the provided stages replace the current ones (with the
 * transition recorded in history) and sessions/metadata are merged in.
 */
export async function upsertWorkItem(params: {
  orgId: string;
  userId: string;
  githubProjectId: string;
  input: CreateWorkItemInput;
}): Promise<WorkItemRow> {
  const { orgId, userId, githubProjectId, input } = params;
  const now = new Date();

  const reuseExisting = (): Promise<WorkItemRow | null> => {
    if (input.sourceKey === null) return Promise.resolve(null);
    return getAppDb().transaction(tx =>
      applyUpdateLocked(
        tx,
        and(eq(workItems.githubProjectId, githubProjectId), eq(workItems.sourceKey, input.sourceKey!)),
        input,
        userId,
        now,
      ),
    );
  };

  const reused = await reuseExisting();
  if (reused) return reused;

  const row = {
    orgId,
    createdBy: userId,
    githubProjectId,
    source: input.source,
    sourceKey: input.sourceKey,
    title: input.title,
    url: input.url,
    stages: input.stages,
    stageHistory: applyStageTransition([], [], input.stages, userId, now),
    sessions: stampSessions(input.sessions, userId),
    metadata: input.metadata,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const [inserted] = await getAppDb().insert(workItems).values(row).returning();
    return inserted!;
  } catch (err) {
    // Concurrent create for the same sourceKey: the partial unique index won
    // the race — fall back to updating the row it protected.
    const fallback = await reuseExisting();
    if (fallback) return fallback;
    throw err;
  }
}

/** The transaction client drizzle hands to `db.transaction` callbacks. */
type DbTx = Parameters<Parameters<AppDb['transaction']>[0]>[0];

/**
 * Shared update path for upsert-reuse and PATCH: stage diff + merges. Must run
 * inside a transaction — the row is read with `FOR UPDATE` so concurrent
 * read-modify-writes of `stageHistory`/`sessions`/`metadata` serialize instead
 * of silently dropping each other's merges. Returns `null` when no row
 * matches `where`.
 */
async function applyUpdateLocked(
  tx: DbTx,
  where: SQL | undefined,
  patch: UpdateWorkItemInput,
  userId: string,
  now: Date,
): Promise<WorkItemRow | null> {
  const [existing] = await tx.select().from(workItems).where(where).for('update');
  if (!existing) return null;
  const set: Partial<WorkItemRow> = { updatedAt: now };
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.url !== undefined) set.url = patch.url;
  if (patch.stages !== undefined) {
    set.stages = patch.stages;
    set.stageHistory = applyStageTransition(existing.stageHistory, existing.stages, patch.stages, userId, now);
  }
  if (patch.sessions !== undefined && Object.keys(patch.sessions).length > 0) {
    set.sessions = { ...existing.sessions, ...stampSessions(patch.sessions, userId) };
  }
  if (patch.metadata !== undefined && Object.keys(patch.metadata).length > 0) {
    set.metadata = { ...existing.metadata, ...patch.metadata };
  }
  const [updated] = await tx.update(workItems).set(set).where(eq(workItems.id, existing.id)).returning();
  return updated ?? { ...existing, ...set };
}

/**
 * Patch an org's work item: stage changes are diffed into history, sessions
 * and metadata are merged. Returns `null` when the item doesn't exist in the
 * caller's org.
 */
export async function updateWorkItem(
  orgId: string,
  id: string,
  userId: string,
  patch: UpdateWorkItemInput,
): Promise<WorkItemRow | null> {
  return getAppDb().transaction(tx =>
    applyUpdateLocked(tx, and(eq(workItems.id, id), eq(workItems.orgId, orgId)), patch, userId, new Date()),
  );
}

/** Delete an org's work item. Returns `false` when it doesn't exist in the org. */
export async function deleteWorkItem(orgId: string, id: string): Promise<boolean> {
  const [existing] = await getAppDb()
    .select()
    .from(workItems)
    .where(and(eq(workItems.id, id), eq(workItems.orgId, orgId)));
  if (!existing) return false;
  await getAppDb().delete(workItems).where(eq(workItems.id, id));
  return true;
}
