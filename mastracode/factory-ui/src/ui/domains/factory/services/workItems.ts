/**
 * Browser-side helpers for Factory work items (the kanban board records).
 *
 * Talks to the server's `/web/factory/*` routes, which sit behind the WorkOS
 * auth gate and scope everything to the caller's organization — the board is
 * org-wide, so every member of the org reads and moves the same cards.
 */

import type { FactoryRuleStage, FactoryTriageType } from '@mastra/factory/rules/types';

import { requestJson } from './request';

export type WorkItemSource =
  | 'github-issue'
  | 'github-pr'
  | 'gitlab-issue'
  | 'gitlab-pr'
  | 'linear-issue'
  | 'jira-issue'
  | 'incidentio-follow-up'
  | 'slack-thread'
  | 'manual';

export function isPullRequestSource(source: WorkItemSource): boolean {
  return source === 'github-pr' || source === 'gitlab-pr';
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
  id: string;
  orgId: string;
  createdBy: string;
  githubProjectId: string;
  board?: string | null;
  source: WorkItemSource;
  sourceKey: string | null;
  parentWorkItemId: string | null;
  title: string;
  url: string | null;
  stages: string[];
  stageHistory: WorkItemStageEntry[];
  sessions: Record<string, WorkItemSessionRef>;
  metadata: Record<string, unknown>;
  /** Classification the triage run recorded; non-bug kinds wait for a person before agents advance them. */
  triageType: FactoryTriageType | null;
  /** When a person first moved the card into Planning/Build, which is the approval agents then honor. */
  acceptedAt: string | null;
  commentCount: number;
  /** Bumped server-side on every feed mutation; clients refetch comments when it moves. */
  feedActivityAt: string | null;
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
  board?: string;
  source: WorkItemSource;
  sourceKey: string | null;
  parentWorkItemId?: string | null;
  title: string;
  url?: string | null;
  stages?: string[];
  sessions?: Record<string, WorkItemSessionInput>;
  metadata?: Record<string, unknown>;
}

interface ExternalWorkItemSource {
  integrationId: string;
  type: string;
  externalId: string;
  workspaceId?: string;
  url?: string;
}

interface WireWorkItem extends Omit<
  WorkItem,
  | 'githubProjectId'
  | 'source'
  | 'sourceKey'
  | 'url'
  | 'metadata'
  | 'commentCount'
  | 'feedActivityAt'
  | 'triageType'
  | 'acceptedAt'
> {
  factoryProjectId: string;
  externalSource: ExternalWorkItemSource | null;
  metadata: Record<string, unknown> | null;
  commentCount?: number;
  feedActivityAt?: string | null;
  triageType?: WorkItem['triageType'];
  acceptedAt?: string | null;
}

interface WireCreateWorkItemInput extends Omit<CreateWorkItemInput, 'source' | 'sourceKey' | 'url'> {
  externalSource?: ExternalWorkItemSource;
}

function sourceFromExternalSource(source: ExternalWorkItemSource | null): WorkItemSource {
  if (!source) return 'manual';
  if (source.integrationId === 'github' && source.type === 'issue') return 'github-issue';
  if (source.integrationId === 'github' && source.type === 'pull-request') return 'github-pr';
  if (source.integrationId === 'gitlab' && source.type === 'issue') return 'gitlab-issue';
  if (source.integrationId === 'gitlab' && source.type === 'pull-request') return 'gitlab-pr';
  if (source.integrationId === 'linear' && source.type === 'issue') return 'linear-issue';
  if (source.integrationId === 'jira' && source.type === 'issue') return 'jira-issue';
  if (source.integrationId === 'incidentio' && source.type === 'issue') return 'incidentio-follow-up';
  if (source.integrationId === 'slack' && source.type === 'slack-thread') return 'slack-thread';
  return 'manual';
}

function externalSourceTarget(
  source: Exclude<WorkItemSource, 'manual'>,
): Pick<ExternalWorkItemSource, 'integrationId' | 'type'> {
  switch (source) {
    case 'github-issue':
      return { integrationId: 'github', type: 'issue' };
    case 'github-pr':
      return { integrationId: 'github', type: 'pull-request' };
    case 'gitlab-issue':
      return { integrationId: 'gitlab', type: 'issue' };
    case 'gitlab-pr':
      return { integrationId: 'gitlab', type: 'pull-request' };
    case 'linear-issue':
      return { integrationId: 'linear', type: 'issue' };
    case 'jira-issue':
      return { integrationId: 'jira', type: 'issue' };
    case 'incidentio-follow-up':
      return { integrationId: 'incidentio', type: 'issue' };
    case 'slack-thread':
      return { integrationId: 'slack', type: 'slack-thread' };
  }
}

function toExternalSource(input: CreateWorkItemInput): ExternalWorkItemSource | undefined {
  const source = input.source;
  if (source === 'manual' || !input.sourceKey) return undefined;
  return {
    ...externalSourceTarget(source),
    externalId: input.sourceKey,
    ...(input.url ? { url: input.url } : {}),
  };
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
  if (sourceFromExternalSource(source) === 'slack-thread') return slackThreadUrl(source);
  return source.url ?? null;
}

function fromWireWorkItem(item: WireWorkItem): WorkItem {
  const { factoryProjectId, externalSource, metadata, commentCount, feedActivityAt, triageType, acceptedAt, ...rest } =
    item;
  return {
    ...rest,
    githubProjectId: factoryProjectId,
    source: sourceFromExternalSource(externalSource),
    sourceKey: externalSource?.externalId ?? null,
    url: externalSourceUrl(externalSource),
    metadata: metadata ?? {},
    commentCount: commentCount ?? 0,
    feedActivityAt: feedActivityAt ?? null,
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
  sessions?: Record<string, WorkItemSessionInput>;
  metadata?: Record<string, unknown>;
  /** Hands-off: every plan this card parks is approved from here on. Stamped once. */
  plansPreapproved?: true;
}

/**
 * The board as of one read: its cards, plus the sessions running on them right
 * then. Both come from the same response so a card and its run marker can
 * never disagree.
 */
export interface BoardSnapshot {
  workItems: WorkItem[];
  runningSessionIds: string[];
  /** Sessions parked on a tool until someone answers, read live with the cards. */
  parkedSessionIds: string[];
  /** Set when the board came from a sync: what the next sync passes back to get only the changes. */
  cursor?: string;
  /** When the last full (non-delta) sync landed; the board resyncs from scratch once it is old. */
  resetAt?: number;
  /** Server-side cards per board and phase, counting the Done and Canceled cards the board never loaded. */
  counts?: WorkItemCounts;
}

/** List the org's work items for a Factory project. */
export async function listWorkItems(
  baseUrl: string,
  factoryProjectId: string,
  signal?: AbortSignal,
): Promise<BoardSnapshot> {
  const data = await requestJson<{
    workItems: WireWorkItem[];
    runningSessionIds?: string[];
    parkedSessionIds?: string[];
  }>(`${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/work-items`, { signal });
  return {
    workItems: data.workItems.map(fromWireWorkItem),
    runningSessionIds: data.runningSessionIds ?? [],
    parkedSessionIds: data.parkedSessionIds ?? [],
  };
}

/** Cards per board and phase, counted by the server over every card including the ones never loaded. */
export interface WorkItemCounts {
  total: number;
  boards: Record<string, Record<string, number>>;
}

export interface WorkItemSync {
  /** Opaque; the next sync passes it back to get only what changed after it. */
  cursor: string;
  /** True when the server sent the whole open board rather than a delta, so the client replaces its cards. */
  reset: boolean;
  workItems: WorkItem[];
  deletedIds: string[];
  counts: WorkItemCounts;
  runningSessionIds: string[];
  parkedSessionIds: string[];
}

const projectWorkItemsUrl = (baseUrl: string, factoryProjectId: string, suffix = '') =>
  `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/work-items${suffix}`;

/**
 * Sync the board: without a cursor the server sends every open card, with one only the cards written or
 * deleted since. Done and Canceled cards come from {@link listWorkItemPage} instead.
 */
export async function syncWorkItems(
  baseUrl: string,
  factoryProjectId: string,
  cursor: string | undefined,
  signal?: AbortSignal,
): Promise<WorkItemSync> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const data = await requestJson<{
    cursor: string;
    reset: boolean;
    workItems: WireWorkItem[];
    deletedIds: string[];
    counts: WorkItemCounts;
    runningSessionIds: string[];
    parkedSessionIds: string[];
  }>(projectWorkItemsUrl(baseUrl, factoryProjectId, `/sync${query}`), { signal });
  return { ...data, workItems: data.workItems.map(fromWireWorkItem) };
}

export type WorkItemPageSort = 'recent' | 'recent-mine' | 'created-newest' | 'created-oldest' | 'relevance';

/** Server-side filters, named after the query parameters of the paged list. */
export interface WorkItemPageQuery {
  board?: string;
  stage?: string;
  q?: string;
  sort?: WorkItemPageSort;
  limit?: number;
  cursor?: string;
  /** Board filters as query parameters (`source`, `label`, `teammate`, ...), each a comma list. */
  filters?: Readonly<Record<string, string>>;
}

export interface WorkItemPage {
  workItems: WorkItem[];
  nextCursor?: string;
}

/** One page of cards matching a filter, in the given sort; `nextCursor` reads the page after it. */
export async function listWorkItemPage(
  baseUrl: string,
  factoryProjectId: string,
  query: WorkItemPageQuery,
  signal?: AbortSignal,
): Promise<WorkItemPage> {
  const { filters, ...rest } = query;
  const params = new URLSearchParams(filters);
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const data = await requestJson<{ workItems: WireWorkItem[]; nextCursor?: string }>(
    projectWorkItemsUrl(baseUrl, factoryProjectId, `?${params.toString()}`),
    { signal },
  );
  return {
    workItems: data.workItems.map(fromWireWorkItem),
    ...(data.nextCursor ? { nextCursor: data.nextCursor } : {}),
  };
}

/** Cards per board and column among those matching `filters` (query parameters, as on a page read). */
export async function countWorkItems(
  baseUrl: string,
  factoryProjectId: string,
  filters: Readonly<Record<string, string>>,
  signal?: AbortSignal,
): Promise<WorkItemCounts> {
  const params = new URLSearchParams(filters);
  return requestJson<WorkItemCounts>(projectWorkItemsUrl(baseUrl, factoryProjectId, `/counts?${params.toString()}`), {
    signal,
  });
}

/** One card by id, Done and Canceled included: what a deep link to a card the board never loaded reads. */
export async function getWorkItem(
  baseUrl: string,
  factoryProjectId: string,
  workItemId: string,
  signal?: AbortSignal,
): Promise<WorkItem> {
  const data = await requestJson<{ workItem: WireWorkItem }>(
    projectWorkItemsUrl(baseUrl, factoryProjectId, `/${encodeURIComponent(workItemId)}`),
    { signal },
  );
  return fromWireWorkItem(data.workItem);
}

/** Every card a session ran on, cut to what names it, so session lists never read every card. */
export async function listSessionWorkItems(
  baseUrl: string,
  factoryProjectId: string,
  signal?: AbortSignal,
): Promise<WorkItem[]> {
  const data = await requestJson<{ workItems: WireWorkItem[] }>(
    projectWorkItemsUrl(baseUrl, factoryProjectId, '/session-cards'),
    { signal },
  );
  return data.workItems.map(fromWireWorkItem);
}

/** Every card that came in or shipped since `since`, cut to what names it, for the activity chart. */
export async function listActivityTimes(
  baseUrl: string,
  factoryProjectId: string,
  since: Date,
  signal?: AbortSignal,
): Promise<{ cameIn: number[]; shipped: number[] }> {
  const data = await requestJson<{ cameIn: string[]; shipped: string[] }>(
    projectWorkItemsUrl(baseUrl, factoryProjectId, `/activity?since=${encodeURIComponent(since.toISOString())}`),
    { signal },
  );
  return { cameIn: data.cameIn.map(Date.parse), shipped: data.shipped.map(Date.parse) };
}

/** What Intake needs to recognise an issue that already has a card: the card's source, never the card. */
export type WorkItemSourceRef = Pick<WorkItem, 'board' | 'source' | 'sourceKey' | 'url' | 'metadata'>;

/** The source of every card on the project, Done and Canceled included, for Intake's dedupe. */
export async function listWorkItemSources(
  baseUrl: string,
  factoryProjectId: string,
  signal?: AbortSignal,
): Promise<WorkItemSourceRef[]> {
  const data = await requestJson<{
    sources: { board: string; externalSource: ExternalWorkItemSource; metadata: Record<string, unknown> }[];
  }>(projectWorkItemsUrl(baseUrl, factoryProjectId, '/sources'), { signal });
  return data.sources.map(({ board, externalSource, metadata }) => ({
    board,
    source: sourceFromExternalSource(externalSource),
    sourceKey: externalSource.externalId,
    url: externalSourceUrl(externalSource),
    metadata,
  }));
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

/** Patch a work item's non-stage metadata, session refs, or title. */
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
