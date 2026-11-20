/**
 * Browser-side helpers for Factory work items (the kanban board records).
 *
 * Talks to the server's `/web/factory/*` routes, which sit behind the WorkOS
 * auth gate and scope everything to the caller's organization — the board is
 * org-wide, so every member of the org reads and moves the same cards.
 */

import { externalSourceForWorkItem } from '@mastra/factory/rules/types';
import type { FactoryRuleStage, FactoryTriageType } from '@mastra/factory/rules/types';
import type { ExternalWorkItemSource } from '@mastra/factory/storage/domains/work-items/base';
import type { WorkItemRow } from '@mastra/factory/storage/domains/work-items/work-item-schema';
import { workItemBoardSource } from '@mastra/factory/work-item-branch';
import type { WorkItemBranchSource } from '@mastra/factory/work-item-branch';

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
 * Where a card came from, in the server's own vocabulary and read with the server's own
 * `workItemBoardSource`, so the board can't fall behind an integration the server adds.
 */
export type WorkItemSource = WorkItemBranchSource;

/** Takes any source string so callers holding a wider union (a user session's `'user'`) need no guard. */
export function isPullRequestSource(source: string): source is 'github-pr' | 'gitlab-pr' {
  return source === 'github-pr' || source === 'gitlab-pr';
}

/** The pull and merge requests a card carries, oldest first: its own, or those attached to its issue. */
function cardPullRequestSources(item: Pick<WorkItem, 'workItem'>): NonNullable<WorkItemRow['sources']> {
  return (item.workItem?.sources ?? []).filter(source => source.sourceType === 'pull-request');
}

/** Whether the card carries a pull or merge request, as its own source or one attached to its issue. */
export function cardHasPullRequest(item: Pick<WorkItem, 'source' | 'workItem'>): boolean {
  return isPullRequestSource(item.source) || cardPullRequestSources(item).length > 0;
}

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
  exitedBy?: string;
}

export interface WorkItem {
  /** Optional during the one-release legacy wire migration. */
  workItem?: Pick<WorkItemRow, 'provider' | 'key' | 'url' | 'title' | 'state' | 'labels' | 'author' | 'metadata'> &
    Partial<Pick<WorkItemRow, 'sources'>>;
  id: string;
  orgId: string;
  createdBy: string;
  githubProjectId: string;
  board?: string | null;
  source: WorkItemSource;
  sourceKey: string | null;
  parentWorkItemId: string | null;
  title: string;
  /** What the card is about, handed to its runs at kickoff. */
  description: string | null;
  url: string | null;
  stages: string[];
  stageHistory: WorkItemStageEntry[];
  sessions: Record<string, WorkItemSessionRef>;
  metadata: Record<string, unknown>;
  /** Classification the triage run recorded; non-bug kinds wait for a person before agents advance them. */
  triageType: FactoryTriageType | null;
  /** When a person first moved the card into Planning/Build, which is the approval agents then honor. */
  acceptedAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  /**
   * What the server names this body by: the board read names each card with the version of the
   * body it would send. A card a write answered, or one changed here, has none until it is read again.
   */
  version?: string;
}

/** Session ref as sent by the client — `startedBy` is stamped server-side. */
export interface WorkItemSessionInput {
  sessionId: string;
  branch: string;
  threadId: string;
}

export interface CreateWorkItemInput {
  board?: string;
  source: WorkItemSource;
  sourceKey: string | null;
  parentWorkItemId?: string | null;
  title: string;
  description?: string | null;
  url?: string | null;
  stages?: string[];
  sessions?: Record<string, WorkItemSessionInput>;
  metadata?: Record<string, unknown>;
}

interface WireWorkItem extends Omit<
  WorkItem,
  'githubProjectId' | 'source' | 'sourceKey' | 'url' | 'metadata' | 'description' | 'triageType' | 'acceptedAt'
> {
  factoryProjectId: string;
  externalSource: ExternalWorkItemSource | null;
  metadata: Record<string, unknown> | null;
  description?: string | null;
  triageType?: WorkItem['triageType'];
  acceptedAt?: string | null;
}

interface WireCreateWorkItemInput extends Omit<CreateWorkItemInput, 'source' | 'sourceKey' | 'url'> {
  externalSource?: ExternalWorkItemSource;
}

/** The provenance the server stores for a new card: none for one filed by hand. */
function toExternalSource({ source, sourceKey, url }: CreateWorkItemInput): ExternalWorkItemSource | undefined {
  if (source === 'manual' || !sourceKey) return undefined;
  // The server's rule vocabulary has no Slack threads: Slack files its own cards.
  if (source === 'slack-thread') {
    return { integrationId: 'slack', type: 'slack-thread', externalId: sourceKey, ...(url ? { url } : {}) };
  }
  return externalSourceForWorkItem(source, sourceKey, url ?? undefined);
}

function toWireCreateInput(input: CreateWorkItemInput): WireCreateWorkItemInput {
  const { source: _source, sourceKey: _sourceKey, url: _url, ...rest } = input;
  const externalSource = toExternalSource(input);
  return { ...rest, ...(externalSource ? { externalSource } : {}) };
}

function slackThreadUrl({ workspaceId, externalId }: ExternalWorkItemSource): string | null {
  if (!workspaceId) return null;
  const [, channelId, threadTs] = /^slack:([^:]+):(\d+\.\d+)?$/.exec(externalId) ?? [];
  if (!channelId) return null;
  const channelUrl = `https://app.slack.com/client/${encodeURIComponent(workspaceId)}/${encodeURIComponent(channelId)}`;
  return threadTs ? `${channelUrl}/thread/${encodeURIComponent(`${channelId}-${threadTs}`)}` : channelUrl;
}

function externalSourceUrl(source: ExternalWorkItemSource | null): string | null {
  if (!source) return null;
  // A Slack card's saved `url` is the Factory session it started, never the Slack thread.
  if (workItemBoardSource(source) === 'slack-thread') return slackThreadUrl(source);
  return source.url ?? null;
}

export function cardLink({
  externalSource,
  workItemUrl,
}: {
  externalSource: ExternalWorkItemSource | null;
  workItemUrl: string | null | undefined;
}): { source: WorkItemSource; url: string | null } {
  const source = workItemBoardSource(externalSource);
  return {
    source,
    url:
      source === 'slack-thread'
        ? externalSourceUrl(externalSource)
        : (workItemUrl ?? externalSourceUrl(externalSource)),
  };
}

function fromWireWorkItem(item: WireWorkItem): WorkItem {
  const { factoryProjectId, externalSource, metadata, description, triageType, acceptedAt, ...rest } = item;
  const { source, url } = cardLink({ externalSource, workItemUrl: item.workItem?.url });
  return {
    ...rest,
    githubProjectId: factoryProjectId,
    source,
    sourceKey: externalSource?.externalId ?? null,
    title: item.workItem?.title ?? item.title,
    url,
    metadata: metadata ?? {},
    description: description ?? null,
    triageType: triageType ?? null,
    acceptedAt: acceptedAt ?? null,
  };
}

export type FactoryBoard = string;

export type FactoryTransitionResult =
  | {
      status: 'accepted';
      transitionId: string;
      itemId: string;
      revision: number;
      stage: FactoryRuleStage;
      decisions: unknown[];
    }
  | { status: 'rejected'; transitionId: string; itemId: string; code: string; reason: string };

export interface UpdateWorkItemInput {
  parentWorkItemId?: string | null;
  title?: string;
  /** Blank clears it. */
  description?: string | null;
  sessions?: Record<string, WorkItemSessionInput>;
  metadata?: Record<string, unknown>;
}

/** The cards of one read. */
export interface BoardSnapshot {
  workItems: WorkItem[];
  /** How many cards matched a `started: 'false'` read, of which `workItems` holds the first. */
  total?: number;
}

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
