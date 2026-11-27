/**
 * Browser-side helpers for Factory work items (the kanban board records).
 *
 * Talks to the server's `/web/factory/*` routes, which sit behind the WorkOS
 * auth gate and scope everything to the caller's organization — the board is
 * org-wide, so every member of the org reads and moves the same cards.
 */

import { fromWireWorkItem, toWireCreateInput } from '@internal/factory-contract';
import type {
  BoardSnapshot,
  CreateWorkItemInput,
  FactoryBoard,
  FactoryRuleStage,
  FactoryTransitionResult,
  SubmittedTransition,
  UpdateWorkItemInput,
  WireWorkItem,
  WorkItem,
} from '@internal/factory-contract';

import type {
  WorkItemActivity,
  BoardPhasesRequest,
  BoardPhasesResponse,
  WorkItemFilterOptions,
  WorkItemListResponse,
  WorkItemSessionRepository,
  WorkItemStarters,
} from '../../../../api/types';
import { requestJson } from './request';

/**
 * List a part of the org's work items for a Factory project: never the whole of them.
 * `sessionId` and `scope: 'sessions'` ask for the cards holding that session or any session, with
 * the cards related to them; `started: 'false'` for the most recently updated cards holding no
 * session whose text has every word of `q`; `source` for the cards filed from those source ids or
 * URLs; `workItemId` for the cards with those ids.
 */
export async function listWorkItems(
  baseUrl: string,
  factoryProjectId: string,
  signal: AbortSignal | undefined,
  only:
    | { sessionId: string }
    | { scope: 'sessions' }
    | { started: 'false'; q: string }
    | { source: string[] }
    | { workItemId: string[] },
): Promise<BoardSnapshot> {
  const params = new URLSearchParams(
    'source' in only
      ? only.source.map(source => ['source', source])
      : 'workItemId' in only
        ? only.workItemId.map(id => ['workItemId', id])
        : only,
  );
  // No id and no source asked for: no card. Sent bare, the request would read the whole project.
  if (params.size === 0) return { workItems: [] };
  const { workItems, total } = await requestJson<
    Partial<Omit<WorkItemListResponse, 'workItems'>> & { workItems: WireWorkItem[] }
  >(`${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/work-items?${params}`, { signal });
  return { workItems: workItems.map(fromWireWorkItem), ...(total === undefined ? {} : { total }) };
}

/** The board read's answer. It holds the cards' bodies only when they were asked for. */
export interface BoardPhasesAnswer extends Omit<BoardPhasesResponse, 'workItems'> {
  workItems?: WorkItem[];
}

/**
 * Which cards each phase of a board view lists, in the view's order, and how many match.
 * `cards` also asks for the body of every card the answer names.
 */
export async function fetchBoardPhases(
  baseUrl: string,
  factoryProjectId: string,
  request: BoardPhasesRequest,
  cards: boolean,
  signal?: AbortSignal,
): Promise<BoardPhasesAnswer> {
  // One order of parameters per view: the browser revalidates an address it has already read.
  const params = new URLSearchParams({ sort: request.sort });
  if (request.q) params.set('q', request.q);
  for (const [filter, picked] of Object.entries(request.filters).sort(([left], [right]) => left.localeCompare(right))) {
    for (const value of picked) params.append(filter, value);
  }
  for (const [phase, count] of Object.entries(request.windows).sort(([left], [right]) => left.localeCompare(right))) {
    params.append('window', `${phase}:${count}`);
  }
  if (request.item) params.set('item', request.item);
  if (cards) params.set('cards', 'true');
  const { workItems, ...answer } = await requestJson<
    Omit<BoardPhasesResponse, 'workItems'> & { workItems?: WireWorkItem[] }
  >(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/boards/${encodeURIComponent(request.board)}/phases?${params}`,
    { signal },
  );
  return workItems ? { ...answer, workItems: workItems.map(fromWireWorkItem) } : answer;
}

/** The labels and people the project's cards can be filtered by. */
export function fetchWorkItemFilterOptions(
  baseUrl: string,
  factoryProjectId: string,
  signal?: AbortSignal,
): Promise<WorkItemFilterOptions> {
  return requestJson(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/work-items/filter-options`,
    { signal },
  );
}

/** What the draft page's starter buttons count on the project's default board. */
export function fetchWorkItemStarters(
  baseUrl: string,
  factoryProjectId: string,
  signal?: AbortSignal,
): Promise<WorkItemStarters> {
  return requestJson(`${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/work-items/starters`, {
    signal,
  });
}

export function getWorkItemSessionRepository(
  baseUrl: string,
  factoryProjectId: string,
  workItemId: string,
  signal?: AbortSignal,
): Promise<WorkItemSessionRepository> {
  return requestJson(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/work-items/${encodeURIComponent(workItemId)}/session-repository`,
    { signal },
  );
}

/** When the project's cards were created and completed since `since`, and how many cards it has in all. */
export function fetchWorkItemActivity(
  baseUrl: string,
  factoryProjectId: string,
  since: number,
  signal?: AbortSignal,
): Promise<WorkItemActivity> {
  const query = new URLSearchParams({ since: new Date(since).toISOString() });
  return requestJson(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/work-items/activity?${query}`,
    { signal },
  );
}

/** Create a work item; the server upserts on its external source identity so repeats reuse the card. */
export async function createWorkItem(
  baseUrl: string,
  factoryProjectId: string,
  input: CreateWorkItemInput,
): Promise<WorkItem> {
  const data = await requestJson<{ workItem: WireWorkItem }>(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/work-items`,
    { method: 'POST', body: JSON.stringify(toWireCreateInput(input)) },
  );
  return fromWireWorkItem(data.workItem);
}

export async function transitionWorkItem(
  baseUrl: string,
  githubProjectId: string,
  id: string,
  input: {
    board: FactoryBoard;
    stage: FactoryRuleStage;
    expectedRevision: number;
    requestId: string;
    cause: string;
    /** Re-enter the lane the card is already in, so its rule runs again. */
    reenter?: boolean;
  },
): Promise<FactoryTransitionResult | SubmittedTransition> {
  const res = await fetch(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(githubProjectId)}/work-items/${encodeURIComponent(id)}/transition`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    },
  );
  const body = (await res.json()) as { result?: FactoryTransitionResult; inputId?: string; error?: string };
  if (body.result) return body.result;
  if (res.status === 202 && typeof body.inputId === 'string') return { status: 'submitted', inputId: body.inputId };
  throw new Error(body.error ?? `Request failed (${res.status})`);
}

/** Patch a work item's non-stage metadata, session refs, title, or description. */
export async function updateWorkItem(baseUrl: string, id: string, patch: UpdateWorkItemInput): Promise<WorkItem> {
  const data = await requestJson<{ workItem: WireWorkItem }>(
    `${baseUrl}/web/factory/work-items/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  );
  return fromWireWorkItem(data.workItem);
}

export interface StartFactoryRunRequest {
  sessionId: string;
  threadTitle: string;
  kickoffKey: string;
  workItem: {
    id: string;
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
  factoryProjectId: string,
  input: StartFactoryRunRequest,
): Promise<StartFactoryRunPrepared> {
  const request = {
    ...input,
    workItem: {
      ...input.workItem,
      input: toWireCreateInput(input.workItem.input),
    },
  };
  const data = await requestJson<{ prepared: StartFactoryRunPrepared }>(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/runs/start`,
    { method: 'POST', body: JSON.stringify(request) },
  );
  return data.prepared;
}

/** Remove a work item from the board. */
export async function deleteWorkItem(baseUrl: string, id: string): Promise<void> {
  await requestJson<{ ok: boolean }>(`${baseUrl}/web/factory/work-items/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
