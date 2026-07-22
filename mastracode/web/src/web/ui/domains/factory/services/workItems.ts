/**
 * Browser-side helpers for Factory work items (the kanban board records).
 *
 * Talks to the server's `/web/factory/*` routes, which sit behind the WorkOS
 * auth gate and scope everything to the caller's organization — the board is
 * org-wide, so every member of the org reads and moves the same cards.
 */

import type { FactoryThreadTaskContext } from '../../../../../shared/api/types';

export type WorkItemSource = 'github-issue' | 'github-pr' | 'linear-issue' | 'manual';

export interface WorkItemSessionRef {
  sessionId: string;
  branch: string;
  threadId: string;
  /** WorkOS user id whose sandbox the session runs in (stamped server-side). */
  startedBy: string;
}

export interface WorkItemStageEntry {
  stage: string;
  enteredAt: string;
  exitedAt?: string;
  by: string;
}

export interface WorkItem {
  id: string;
  orgId: string;
  createdBy: string;
  githubProjectId: string;
  source: WorkItemSource;
  sourceKey: string | null;
  parentWorkItemId: string | null;
  title: string;
  url: string | null;
  stages: string[];
  stageHistory: WorkItemStageEntry[];
  sessions: Record<string, WorkItemSessionRef>;
  metadata: Record<string, unknown>;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

/** Session ref as sent by the client — `startedBy` is stamped server-side. */
export interface WorkItemSessionInput {
  sessionId: string;
  branch: string;
  threadId: string;
}

export interface CreateWorkItemInput {
  source: WorkItemSource;
  sourceKey: string | null;
  parentWorkItemId?: string | null;
  title: string;
  url?: string | null;
  stages: string[];
  sessions?: Record<string, WorkItemSessionInput>;
  metadata?: Record<string, unknown>;
}

export type FactoryBoard = 'work' | 'review';
export type FactoryStage = 'intake' | 'triage' | 'planning' | 'execute' | 'review' | 'done';

export type FactoryTransitionResult =
  | {
      status: 'accepted';
      transitionId: string;
      itemId: string;
      revision: number;
      stage: FactoryStage;
      decisions: unknown[];
    }
  | { status: 'rejected'; transitionId: string; itemId: string; code: string; reason: string };

export interface UpdateWorkItemInput {
  parentWorkItemId?: string | null;
  title?: string;
  url?: string | null;
  sessions?: Record<string, WorkItemSessionInput>;
  metadata?: Record<string, unknown>;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', ...(init?.body ? { 'content-type': 'application/json' } : {}) },
    credentials: 'include',
    ...init,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      if (body.message) message = body.message;
      else if (body.error) message = body.error;
    } catch {
      /* ignore non-JSON */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

/** Load task context for one exact Factory session binding. */
export async function fetchFactoryThreadTaskContext(
  baseUrl: string,
  factoryProjectId: string,
  threadId: string,
  resourceId: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<FactoryThreadTaskContext | null> {
  const query = new URLSearchParams({ resourceId, sessionId });
  const data = await requestJson<{ context: FactoryThreadTaskContext | null }>(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/threads/${encodeURIComponent(threadId)}/context?${query}`,
    { signal },
  );
  return data.context;
}

/** List the org's work items for a Factory project. */
export async function listWorkItems(baseUrl: string, factoryProjectId: string): Promise<WorkItem[]> {
  const data = await requestJson<{ workItems: WorkItem[] }>(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/work-items`,
  );
  return data.workItems;
}

/** Create a work item; the server upserts on `sourceKey` so repeats reuse the card. */
export async function createWorkItem(
  baseUrl: string,
  factoryProjectId: string,
  input: CreateWorkItemInput,
): Promise<WorkItem> {
  const data = await requestJson<{ workItem: WorkItem }>(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/work-items`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return data.workItem;
}

export async function transitionWorkItem(
  baseUrl: string,
  githubProjectId: string,
  id: string,
  input: { board: FactoryBoard; stage: FactoryStage; expectedRevision: number; requestId: string; cause: string },
): Promise<FactoryTransitionResult> {
  const res = await fetch(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(githubProjectId)}/work-items/${encodeURIComponent(id)}/transition`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    },
  );
  const body = (await res.json()) as { result?: FactoryTransitionResult; error?: string };
  if (body.result) return body.result;
  throw new Error(body.error ?? `Request failed (${res.status})`);
}

/** Patch a work item's non-stage metadata, session refs, or title. */
export async function updateWorkItem(baseUrl: string, id: string, patch: UpdateWorkItemInput): Promise<WorkItem> {
  const data = await requestJson<{ workItem: WorkItem }>(
    `${baseUrl}/web/factory/work-items/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  );
  return data.workItem;
}

export interface StartFactoryRunRequest {
  sessionId: string;
  threadTitle: string;
  threadTags?: Record<string, string>;
  kickoffKey: string;
  invocation?: { type: 'prompt'; prompt: string } | { type: 'skill'; skillName: string; arguments: string };
  destinationStage: FactoryStage;
  workItem: {
    id?: string;
    role: string;
    input: CreateWorkItemInput;
  };
}

export interface StartFactoryRunPrepared {
  workItemId: string;
  bindingId: string;
  threadId: string;
  resourceId: string;
  sessionId: string;
  branch: string;
  revision: number;
  kickoffStatus: 'pending' | 'leased' | 'retry' | 'sent' | 'failed';
  replayed: boolean;
}

export async function startFactoryRun(
  baseUrl: string,
  githubProjectId: string,
  input: StartFactoryRunRequest,
): Promise<StartFactoryRunPrepared> {
  const data = await requestJson<{ prepared: StartFactoryRunPrepared }>(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(githubProjectId)}/runs/start`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return data.prepared;
}

/** Remove a work item from the board. */
export async function deleteWorkItem(baseUrl: string, id: string): Promise<void> {
  await requestJson<{ ok: boolean }>(`${baseUrl}/web/factory/work-items/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
