/**
 * Browser-side helpers for Factory work items (the kanban board records).
 *
 * Talks to the server's `/web/factory/*` routes, which sit behind the WorkOS
 * auth gate and scope everything to the caller's organization — the board is
 * org-wide, so every member of the org reads and moves the same cards.
 */

export type WorkItemSource = 'github-issue' | 'github-pr' | 'linear-issue' | 'manual';

export interface WorkItemSessionRef {
  projectPath: string;
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
  createdAt: string;
  updatedAt: string;
}

/** Session ref as sent by the client — `startedBy` is stamped server-side. */
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
  url?: string | null;
  stages: string[];
  sessions?: Record<string, WorkItemSessionInput>;
  metadata?: Record<string, unknown>;
}

export interface UpdateWorkItemInput {
  parentWorkItemId?: string | null;
  title?: string;
  url?: string | null;
  stages?: string[];
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

/** Patch a work item (stage moves, session/metadata merges, title). */
export async function updateWorkItem(baseUrl: string, id: string, patch: UpdateWorkItemInput): Promise<WorkItem> {
  const data = await requestJson<{ workItem: WorkItem }>(
    `${baseUrl}/web/factory/work-items/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  );
  return data.workItem;
}

/** Remove a work item from the board. */
export async function deleteWorkItem(baseUrl: string, id: string): Promise<void> {
  await requestJson<{ ok: boolean }>(`${baseUrl}/web/factory/work-items/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
