/**
 * Validation + persistence wrappers for Factory work items (the kanban board
 * records).
 *
 * Validation mirrors `../intake/store` — untrusted route bodies are parsed
 * into bounded, sanitized shapes or rejected wholesale. Persistence is
 * delegated to the `work-items` domain registered on the seeded
 * `FactoryStorage` (see `../storage/domains/work-items`); stage
 * history is appended exclusively there (server-side) on every stage
 * transition so it can never drift from `stages`.
 */

import { getFactoryStorage } from '../runtime-config';
import { getWorkItemsStorage } from '../storage/domains';
import type {
  CreateWorkItemInput,
  UpdateWorkItemInput,
  UpsertWorkItemResult,
  WorkItemPriorState,
  WorkItemRow,
  WorkItemSessionInput,
  WorkItemSource,
} from '../storage/domains/work-items/base';

export type {
  CreateWorkItemInput,
  UpdateWorkItemInput,
  UpsertWorkItemResult,
  WorkItemPriorState,
  WorkItemRow,
  WorkItemSessionInput,
  WorkItemSource,
};

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

async function workItemsDomain() {
  const storage = getFactoryStorage();
  await storage.ensureDomainReady('work-items');
  return getWorkItemsStorage();
}

/** List the org's work items for a project, newest first. */
export async function listWorkItems(orgId: string, githubProjectId: string): Promise<WorkItemRow[]> {
  return (await workItemsDomain()).list(orgId, githubProjectId);
}

/**
 * Create a work item, reusing the existing record when `sourceKey` already has
 * one for the project (acting twice on the same issue must not duplicate the
 * card). See {@link WorkItemsStorage.upsert} for the reuse semantics.
 */
export async function upsertWorkItem(params: {
  orgId: string;
  userId: string;
  githubProjectId: string;
  input: CreateWorkItemInput;
}): Promise<UpsertWorkItemResult> {
  return (await workItemsDomain()).upsert(params);
}

/**
 * Patch an org's work item: stage changes are diffed into history, sessions
 * and metadata are merged. Returns the updated row plus the pre-patch stages
 * and session roles (for audit diffing), or `null` when the item doesn't
 * exist in the caller's org.
 */
export async function updateWorkItem(
  orgId: string,
  id: string,
  userId: string,
  patch: UpdateWorkItemInput,
): Promise<{ item: WorkItemRow; previous: WorkItemPriorState } | null> {
  return (await workItemsDomain()).update(orgId, id, userId, patch);
}

/** Delete an org's work item. Returns the row actually deleted, or `null` when it doesn't exist in the org. */
export async function deleteWorkItem(orgId: string, id: string): Promise<WorkItemRow | null> {
  return (await workItemsDomain()).delete(orgId, id);
}
