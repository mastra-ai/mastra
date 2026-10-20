import type { FactoryDispatchFailureCode } from '@mastra/factory/storage/domains/work-items/base';

import { boardPath } from '../boardCatalog';
import { requestJson } from './request';

export type FactoryAttentionView = 'open' | 'unread' | 'archived';
export type FactoryAttentionReceiptAction = 'read' | 'archive' | 'restore';
export type FactoryAttentionTarget =
  | { kind: 'thread'; sessionId: string; threadId: string }
  | { kind: 'work-item'; workItemId: string; board: string; commentId?: string }
  | { kind: 'rules' };

interface FactoryAttentionItemBase {
  key: string;
  occurrence: number;
  workItemId: string | null;
  title: string;
  detail: string;
  occurredAt: string;
  read: boolean;
  archived: boolean;
  target: FactoryAttentionTarget;
}

export interface FactoryAutomationFailedAttentionItem extends FactoryAttentionItemBase {
  kind: 'automation-failed';
  decisionId: string;
  decisionType: string;
  failureCode: FactoryDispatchFailureCode | null;
  canRetry: boolean;
}

/** A run parked for approval: the lane composed it, nobody has released it yet. */
export interface FactoryAutomationProposedAttentionItem extends FactoryAttentionItemBase {
  kind: 'automation-proposed';
  decisionId: string;
  decisionType: string;
}

export interface FactoryMentionAttentionItem extends FactoryAttentionItemBase {
  kind: 'mention';
  commentId: string;
  authorId: string;
  authorName?: string;
}

/** The discussion on an item someone took part in moved on. */
export interface FactoryActivityAttentionItem extends FactoryAttentionItemBase {
  kind: 'activity';
  workItemId: string;
  commentId: string;
  authorId: string;
  authorName?: string;
}

/** A run parked on a plan or a question: the item lives exactly as long as the answer is owed. */
export interface FactoryAgentWaitingAttentionItem extends FactoryAttentionItemBase {
  kind: 'agent-waiting';
  workItemId: string;
  sessionId: string;
  threadId: string;
  role: string;
  toolName: string;
}

export type FactoryAttentionItem =
  | FactoryAgentWaitingAttentionItem
  | FactoryAutomationFailedAttentionItem
  | FactoryAutomationProposedAttentionItem
  | FactoryMentionAttentionItem
  | FactoryActivityAttentionItem;

/** Automated attention items have no author; comment-driven kinds carry the person who wrote the comment. */
export function attentionAuthorName(item: FactoryAttentionItem): string | undefined {
  return item.kind === 'mention' || item.kind === 'activity' ? item.authorName : undefined;
}

const ISO_INSTANT = /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z\b/g;

const detailDate = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Supervisor evidence stamps raw ISO instants for the agent that reads it; people get their own clock. */
export function readableAttentionDetail(detail: string): string {
  return detail.replace(ISO_INSTANT, instant => {
    const at = Date.parse(instant);
    return Number.isNaN(at) ? instant : detailDate.format(at);
  });
}

export function attentionItemSourceId(item: FactoryAttentionItem): string {
  switch (item.kind) {
    case 'mention':
      return item.commentId;
    case 'activity':
      return item.workItemId;
    case 'automation-failed':
    case 'automation-proposed':
      return item.decisionId;
    case 'agent-waiting':
      return item.sessionId;
  }
}

export type FactoryAttentionKind = FactoryAttentionItem['kind'];

/** Who an item is for: a person it interrupts, a queue a person releases, or a discussion they follow. */
export type FactoryAttentionGroup = 'attention' | 'queue' | 'activity';

const ATTENTION_GROUP_OF_KIND: Record<FactoryAttentionKind, FactoryAttentionGroup> = {
  'automation-failed': 'attention',
  'agent-waiting': 'attention',
  mention: 'attention',
  'automation-proposed': 'queue',
  activity: 'activity',
};

function isAttentionKind(key: string): key is FactoryAttentionKind {
  return Object.hasOwn(ATTENTION_GROUP_OF_KIND, key);
}

export const ATTENTION_KINDS = Object.keys(ATTENTION_GROUP_OF_KIND).filter(isAttentionKind);

export const INTERRUPTING_KINDS = ATTENTION_KINDS.filter(kind => ATTENTION_GROUP_OF_KIND[kind] === 'attention');

export const NEEDS_YOU_KINDS = ATTENTION_KINDS.filter(kind => ATTENTION_GROUP_OF_KIND[kind] !== 'activity');

export const FOLLOWED_KINDS = ATTENTION_KINDS.filter(kind => ATTENTION_GROUP_OF_KIND[kind] === 'activity');

export interface FactoryAttentionLatest {
  key: string;
  at: string;
  unread: boolean;
}

export interface FactoryAttentionKindSummary {
  open: number;
  unread: number;
  latest: FactoryAttentionLatest | null;
}

export type FactoryAttentionKindSummaries = Record<FactoryAttentionKind, FactoryAttentionKindSummary>;

export interface FactoryAttentionResponse {
  items: FactoryAttentionItem[];
  kinds: FactoryAttentionKindSummaries;
  hasMore: boolean;
  nextCursor?: string;
}

export function attentionCounts(
  summaries: FactoryAttentionKindSummaries,
  kinds: readonly FactoryAttentionKind[],
): { open: number; unread: number } {
  let open = 0;
  let unread = 0;
  for (const kind of kinds) {
    open += summaries[kind].open;
    unread += summaries[kind].unread;
  }
  return { open, unread };
}

export function latestUnreadOrNewestIn(
  summaries: FactoryAttentionKindSummaries,
  kinds: readonly FactoryAttentionKind[],
): FactoryAttentionLatest | null {
  const latests = kinds.flatMap(kind => summaries[kind].latest ?? []);
  const unread = latests.filter(latest => latest.unread);
  return newestOf(unread.length > 0 ? unread : latests);
}

function newestOf(latests: FactoryAttentionLatest[]): FactoryAttentionLatest | null {
  let newest: FactoryAttentionLatest | null = null;
  for (const latest of latests) {
    if (!newest || Date.parse(latest.at) > Date.parse(newest.at)) newest = latest;
  }
  return newest;
}

export function factoryAttentionTargetPath(factoryId: string, target: FactoryAttentionTarget): string {
  if (target.kind === 'thread') {
    return `/factories/${factoryId}/workspaces/${encodeURIComponent(target.sessionId)}/threads/${encodeURIComponent(target.threadId)}`;
  }
  if (target.kind === 'work-item') {
    const comment = target.commentId ? `&comment=${encodeURIComponent(target.commentId)}` : '';
    return `${boardPath(factoryId, target.board)}?item=${encodeURIComponent(target.workItemId)}${comment}`;
  }
  return `/factories/${factoryId}/rules`;
}

export function fetchFactoryAttention(
  baseUrl: string,
  factoryProjectId: string,
  options: {
    view: FactoryAttentionView;
    kinds?: readonly FactoryAttentionKind[];
    before?: string;
    limit?: number;
    signal?: AbortSignal;
  },
): Promise<FactoryAttentionResponse> {
  const query = new URLSearchParams({ view: options.view });
  // Ask only for kinds this client renders, so pages and cursors never carry a kind it would drop.
  for (const kind of options.kinds ?? ATTENTION_KINDS) query.append('kind', kind);
  if (options.before) query.set('before', options.before);
  if (options.limit) query.set('limit', String(options.limit));
  return requestJson<FactoryAttentionResponse>(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/attention?${query}`,
    { signal: options.signal },
  ).then(page => ({
    ...page,
    // A server can still report kinds this client no longer renders; drop them so views never see them.
    items: page.items.filter(item => Object.hasOwn(ATTENTION_GROUP_OF_KIND, item.kind)),
  }));
}

export function updateFactoryAttentionReceipt(
  baseUrl: string,
  factoryProjectId: string,
  item: FactoryAttentionItem,
  action: FactoryAttentionReceiptAction,
): Promise<{ receipt: { key: string; state: 'read' | 'archived'; readAt: string; archivedAt: string | null } }> {
  return requestJson(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/attention/${item.kind}/${encodeURIComponent(attentionItemSourceId(item))}/${item.occurrence}/${action}`,
    { method: 'POST' },
  );
}

export async function markAllFactoryAttentionRead(baseUrl: string, factoryProjectId: string): Promise<{ ok: true }> {
  let before: string | undefined;
  while (true) {
    const query = before ? `?before=${encodeURIComponent(before)}` : '';
    const page = await requestJson<{ ok: true; hasMore: boolean; nextCursor?: string }>(
      `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/attention/read-all${query}`,
      { method: 'POST' },
    );
    if (!page.hasMore) return { ok: true };
    if (!page.nextCursor) throw new Error('Attention read-all response is missing its continuation cursor.');
    before = page.nextCursor;
  }
}
