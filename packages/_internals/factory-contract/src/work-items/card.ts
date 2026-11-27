// Browser-safe: part of @internal/factory-contract, which Factory's server and UIs share.
/** The card as Factory's UIs hold it, and how it is read from and written to the wire. */

import type { FactoryRuleStage, FactoryTransitionResult, FactoryTriageType } from '../rules/types.js';
import { externalSourceForWorkItem } from '../rules/types.js';
import { workItemBoardSource } from '../work-item-branch.js';
import type { WorkItemBranchSource } from '../work-item-branch.js';
import type { ExternalWorkItemSource } from './external-source.js';
import type { WorkItemRow } from './work-item-rows.js';

/**
 * Where a card came from, in the server's own vocabulary and read with the server's own
 * `workItemBoardSource`, so the board can't fall behind an integration the server adds.
 */
export type WorkItemBoardSource = WorkItemBranchSource;

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
  source: WorkItemBoardSource;
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
  source: WorkItemBoardSource;
  sourceKey: string | null;
  parentWorkItemId?: string | null;
  title: string;
  description?: string | null;
  url?: string | null;
  stages?: string[];
  sessions?: Record<string, WorkItemSessionInput>;
  metadata?: Record<string, unknown>;
}

export interface WireWorkItem extends Omit<
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

export interface WireCreateWorkItemInput extends Omit<CreateWorkItemInput, 'source' | 'sourceKey' | 'url'> {
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

export function toWireCreateInput(input: CreateWorkItemInput): WireCreateWorkItemInput {
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
}): { source: WorkItemBoardSource; url: string | null } {
  const source = workItemBoardSource(externalSource);
  return {
    source,
    url:
      source === 'slack-thread'
        ? externalSourceUrl(externalSource)
        : (workItemUrl ?? externalSourceUrl(externalSource)),
  };
}

export function fromWireWorkItem(item: WireWorkItem): WorkItem {
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

/** The server took the move on and answers it later, on the feed stream, under this input id. */
export interface SubmittedTransition {
  status: 'submitted';
  inputId: string;
}

/**
 * How a move ended for the board: answered at once, or submitted and then told to have landed,
 * been refused, or never answered (the board's next read shows where the card is).
 */
export type TransitionOutcome =
  | FactoryTransitionResult
  | { status: 'landed'; inputId: string }
  | { status: 'rejected'; inputId: string; code: string; reason: string }
  | { status: 'unanswered'; inputId: string };

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
