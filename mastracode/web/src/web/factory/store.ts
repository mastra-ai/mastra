/**
 * Factory work-item input validation and persistence helpers.
 */

import { getFactoryStorage } from '../runtime-config';
import { getWorkItemsStorage } from '../storage/domains';
import { WorkItemRelationError } from '../storage/domains/work-items/base';
import type {
  CommitFactoryTransitionInput,
  CommitFactoryTransitionResult,
  CreateWorkItemInput,
  ExternalWorkItemSource,
  FactoryPendingStartRecord,
  PrepareFactoryRunStartInput,
  PrepareFactoryRunStartResult,
  UpsertWorkItemResult,
  UpdateWorkItemInput,
  WorkItemPriorState,
  WorkItemRow,
  WorkItemSessionInput,
  WorkItemSessionRef,
  WorkItemStage,
} from '../storage/domains/work-items/base';

export { WorkItemRelationError };
export type {
  CreateWorkItemInput,
  ExternalWorkItemSource,
  UpdateWorkItemInput,
  WorkItemPriorState,
  WorkItemRow,
  WorkItemSessionInput,
  WorkItemSessionRef,
  WorkItemStage,
};

const MAX_STAGES = 16;
const MAX_STAGE_LENGTH = 64;
const MAX_METADATA_BYTES = 16 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validStages(value: unknown): value is WorkItemStage[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_STAGES &&
    value.every(
      stage => typeof stage === 'string' && stage.length <= MAX_STAGE_LENGTH && /^[a-z0-9][a-z0-9_-]*$/i.test(stage),
    ) &&
    new Set(value).size === value.length
  );
}

function validMetadata(value: unknown): value is Record<string, unknown> | null {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  try {
    return JSON.stringify(value).length <= MAX_METADATA_BYTES;
  } catch {
    return false;
  }
}

function parseExternalSource(value: unknown): ExternalWorkItemSource | null | undefined {
  if (value === undefined || value === null) return value;
  if (!isRecord(value)) return undefined;
  const { integrationId, type, externalId, url } = value;
  if (typeof integrationId !== 'string' || integrationId.length === 0 || integrationId.length > 128) return undefined;
  if (typeof type !== 'string' || type.length === 0 || type.length > 128) return undefined;
  if (typeof externalId !== 'string' || externalId.length === 0 || externalId.length > 512) return undefined;
  if (url !== undefined && (typeof url !== 'string' || url.length > 2048)) return undefined;
  return { integrationId, type, externalId, ...(url !== undefined ? { url } : {}) };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseParentWorkItemId(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string' || !UUID_RE.test(value)) return undefined;
  return value;
}

function parseSessions(value: unknown): Record<string, WorkItemSessionInput> | undefined {
  if (!isRecord(value)) return undefined;
  const out: Record<string, WorkItemSessionInput> = {};
  for (const [role, session] of Object.entries(value)) {
    if (!role || role.length > 64 || !isRecord(session)) return undefined;
    const { sessionId, branch, threadId } = session;
    if (typeof sessionId !== 'string' || sessionId.length === 0 || sessionId.length > 512) return undefined;
    if (typeof branch !== 'string' || branch.length === 0 || branch.length > 512) return undefined;
    if (typeof threadId !== 'string' || threadId.length === 0 || threadId.length > 512) return undefined;
    out[role] = { sessionId, branch, threadId };
  }
  return out;
}

/** Validate an untrusted create body. Unknown keys are dropped. */
export function parseCreateWorkItem(body: unknown): CreateWorkItemInput | null {
  if (!isRecord(body)) return null;
  const { externalSource, title, stages, sessions, metadata } = body;
  if (typeof title !== 'string' || title.trim().length === 0 || title.length > 500) return null;

  const hasParentWorkItemId = 'parentWorkItemId' in body;
  const parentWorkItemId = hasParentWorkItemId ? parseParentWorkItemId(body.parentWorkItemId) : undefined;
  if (hasParentWorkItemId && parentWorkItemId === undefined) return null;
  const parsedSource = parseExternalSource(externalSource);
  if (externalSource !== undefined && parsedSource === undefined) return null;
  if (stages !== undefined && !validStages(stages)) return null;
  const parsedSessions = sessions === undefined ? undefined : parseSessions(sessions);
  if (sessions !== undefined && parsedSessions === undefined) return null;
  if (metadata !== undefined && !validMetadata(metadata)) return null;

  return {
    title: title.trim(),
    ...(parsedSource !== undefined ? { externalSource: parsedSource } : {}),
    ...(hasParentWorkItemId ? { parentWorkItemId: parentWorkItemId ?? null } : {}),
    ...(stages !== undefined ? { stages } : {}),
    ...(parsedSessions !== undefined ? { sessions: parsedSessions } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  };
}

/** Validate an untrusted patch body. Unknown keys are dropped. */
export function parseUpdateWorkItem(body: unknown): UpdateWorkItemInput | null {
  if (!isRecord(body)) return null;
  const { title, stages, sessions, metadata } = body;
  const hasParentWorkItemId = 'parentWorkItemId' in body;
  if (
    title === undefined &&
    stages === undefined &&
    sessions === undefined &&
    metadata === undefined &&
    !hasParentWorkItemId
  )
    return null;
  const parentWorkItemId = hasParentWorkItemId ? parseParentWorkItemId(body.parentWorkItemId) : undefined;
  if (hasParentWorkItemId && parentWorkItemId === undefined) return null;
  if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0 || title.length > 500))
    return null;
  if (stages !== undefined && !validStages(stages)) return null;
  const parsedSessions = sessions === undefined ? undefined : parseSessions(sessions);
  if (sessions !== undefined && parsedSessions === undefined) return null;
  if (metadata !== undefined && !validMetadata(metadata)) return null;

  return {
    ...(hasParentWorkItemId ? { parentWorkItemId: parentWorkItemId ?? null } : {}),
    ...(title !== undefined ? { title: title.trim() } : {}),
    ...(stages !== undefined ? { stages } : {}),
    ...(parsedSessions !== undefined ? { sessions: parsedSessions } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  };
}

async function workItemsDomain() {
  const storage = getFactoryStorage();
  await storage.ensureDomainReady('work-items');
  return getWorkItemsStorage();
}

export async function listWorkItems({
  orgId,
  factoryProjectId,
}: {
  orgId: string;
  factoryProjectId: string;
}): Promise<WorkItemRow[]> {
  return (await workItemsDomain()).list({ orgId, factoryProjectId });
}

export async function upsertWorkItem(params: {
  orgId: string;
  userId: string;
  factoryProjectId: string;
  input: CreateWorkItemInput;
  reuseMode?: 'update' | 'preserve' | 'non-stage';
}): Promise<UpsertWorkItemResult> {
  return (await workItemsDomain()).upsert(params);
}

export async function updateWorkItem(params: {
  orgId: string;
  id: string;
  userId: string;
  patch: UpdateWorkItemInput;
}): Promise<{ item: WorkItemRow; previous: WorkItemPriorState } | null> {
  return (await workItemsDomain()).update(params);
}

export async function getWorkItem({
  orgId,
  factoryProjectId,
  id,
}: {
  orgId: string;
  factoryProjectId: string;
  id: string;
}): Promise<WorkItemRow | null> {
  return (await workItemsDomain()).getForProject(orgId, factoryProjectId, id);
}

export async function commitFactoryTransition(
  input: CommitFactoryTransitionInput,
): Promise<CommitFactoryTransitionResult> {
  return (await workItemsDomain()).commitTransition(input);
}

export async function prepareFactoryRunStart(
  input: PrepareFactoryRunStartInput,
): Promise<PrepareFactoryRunStartResult> {
  return (await workItemsDomain()).prepareRunStart(input);
}

export async function markFactoryPendingStart(
  bindingId: string,
  status: 'sent' | 'failed',
  lastError?: string,
): Promise<FactoryPendingStartRecord | null> {
  return (await workItemsDomain()).markPendingStart(bindingId, status, lastError);
}

export async function deleteWorkItem({ orgId, id }: { orgId: string; id: string }): Promise<WorkItemRow | null> {
  return (await workItemsDomain()).delete({ orgId, id });
}
