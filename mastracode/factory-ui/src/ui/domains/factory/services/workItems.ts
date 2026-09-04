/**
 * Browser-side helpers for Factory work items (the kanban board records).
 *
 * Talks to the server's `/web/factory/*` routes, which sit behind the WorkOS
 * auth gate and scope everything to the caller's organization — the board is
 * org-wide, so every member of the org reads and moves the same cards.
 */

import type { FactoryRuleStage, FactoryTriageType } from '@mastra/factory/rules/types';

import { requestJson } from './request';

export type WorkItemSource = 'github-issue' | 'github-pr' | 'linear-issue' | 'slack-thread' | 'manual';

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
  source: WorkItemSource;
  sourceKey: string | null;
  parentWorkItemId?: string | null;
  title: string;
  url?: string | null;
  stages: string[];
  sessions?: Record<string, WorkItemSessionInput>;
  metadata?: Record<string, unknown>;
}

interface ExternalWorkItemSource {
  integrationId: string;
  type: string;
  externalId: string;
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
  if (source.integrationId === 'linear' && source.type === 'issue') return 'linear-issue';
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
    case 'linear-issue':
      return { integrationId: 'linear', type: 'issue' };
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

function fromWireWorkItem(item: WireWorkItem): WorkItem {
  const { factoryProjectId, externalSource, metadata, commentCount, feedActivityAt, triageType, acceptedAt, ...rest } =
    item;
  return {
    ...rest,
    githubProjectId: factoryProjectId,
    source: sourceFromExternalSource(externalSource),
    sourceKey: externalSource?.externalId ?? null,
    url: externalSource?.url ?? null,
    metadata: metadata ?? {},
    commentCount: commentCount ?? 0,
    feedActivityAt: feedActivityAt ?? null,
    triageType: triageType ?? null,
    acceptedAt: acceptedAt ?? null,
  };
}

export type FactoryBoard = 'work' | 'review';

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
}

/**
 * The board as of one read: its cards, plus the sessions running on them right
 * then. Both come from the same response so a card and its run marker can
 * never disagree.
 */
export interface BoardSnapshot {
  workItems: WorkItem[];
  runningSessionIds: string[];
}

/** List the org's work items for a Factory project. */
export async function listWorkItems(
  baseUrl: string,
  factoryProjectId: string,
  signal?: AbortSignal,
): Promise<BoardSnapshot> {
  const data = await requestJson<{ workItems: WireWorkItem[]; runningSessionIds?: string[] }>(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/work-items`,
    { signal },
  );
  return { workItems: data.workItems.map(fromWireWorkItem), runningSessionIds: data.runningSessionIds ?? [] };
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
  input: { board: FactoryBoard; stage: FactoryRuleStage; expectedRevision: number; requestId: string; cause: string },
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
  threadTags?: Record<string, string>;
  kickoffKey: string;
  invocation?: { type: 'prompt'; prompt: string } | { type: 'skill'; skillName: string; arguments: string };
  /** Hands-off run: the dispatcher approves this item's parked plans on the starter's behalf. */
  preapprovePlans?: boolean;
  destinationStage: FactoryRuleStage;
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
