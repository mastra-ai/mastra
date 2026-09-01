import type { FactoryDispatchFailureCode } from '@mastra/factory/storage/domains/work-items/base';

import { requestJson } from './request';

export type FactoryAttentionView = 'open' | 'unread' | 'archived';
export type FactoryAttentionReceiptAction = 'read' | 'archive' | 'restore';
export type FactoryAttentionTarget =
  | { kind: 'thread'; sessionId: string; threadId: string }
  | { kind: 'work-item'; workItemId: string; board: 'work' | 'review'; commentId?: string }
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

export interface FactoryMentionAttentionItem extends FactoryAttentionItemBase {
  kind: 'mention';
  commentId: string;
  authorId: string;
  authorName?: string;
}

/** The lower tier: the discussion on an item someone took part in moved on. */
export interface FactoryActivityAttentionItem extends FactoryAttentionItemBase {
  kind: 'activity';
  workItemId: string;
  commentId: string;
  authorId: string;
  authorName?: string;
}

export type FactoryAttentionItem =
  | FactoryAutomationFailedAttentionItem
  | FactoryMentionAttentionItem
  | FactoryActivityAttentionItem;

/** A failed automation has no author; the other two tiers carry the person who wrote the comment. */
export function attentionAuthorName(item: FactoryAttentionItem): string | undefined {
  return item.kind === 'automation-failed' ? undefined : item.authorName;
}

export function attentionItemSourceId(item: FactoryAttentionItem): string {
  switch (item.kind) {
    case 'mention':
      return item.commentId;
    case 'activity':
      return item.workItemId;
    case 'automation-failed':
      return item.decisionId;
  }
}

export interface FactoryAttentionResponse {
  items: FactoryAttentionItem[];
  openCount: number;
  approvalCount: number;
  badgeCount: number;
  unreadCount: number;
  /** Counted apart: the activity tier never reaches the sidebar badge. */
  activityUnreadCount: number;
  hasMore: boolean;
  latestOccurrenceKey: string | null;
  latestOccurrenceAt: string | null;
  latestOccurrenceUnread: boolean;
  nextCursor?: string;
}

export function factoryAttentionTargetPath(factoryId: string, target: FactoryAttentionTarget): string {
  if (target.kind === 'thread') {
    return `/factories/${factoryId}/workspaces/${encodeURIComponent(target.sessionId)}/threads/${encodeURIComponent(target.threadId)}`;
  }
  if (target.kind === 'work-item') {
    const comment = target.commentId ? `&comment=${encodeURIComponent(target.commentId)}` : '';
    return `/factories/${factoryId}/${target.board}?item=${encodeURIComponent(target.workItemId)}${comment}`;
  }
  return `/factories/${factoryId}/rules`;
}

export type FactoryAttentionTier = 'badge' | 'activity';

export function fetchFactoryAttention(
  baseUrl: string,
  factoryProjectId: string,
  options: {
    view: FactoryAttentionView;
    tier?: FactoryAttentionTier;
    before?: string;
    limit?: number;
    search?: string;
    signal?: AbortSignal;
  },
): Promise<FactoryAttentionResponse> {
  const query = new URLSearchParams({ view: options.view });
  if (options.tier) query.set('tier', options.tier);
  if (options.before) query.set('before', options.before);
  if (options.limit) query.set('limit', String(options.limit));
  if (options.search) query.set('search', options.search);
  return requestJson<FactoryAttentionResponse>(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/attention?${query}`,
    { signal: options.signal },
  );
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
