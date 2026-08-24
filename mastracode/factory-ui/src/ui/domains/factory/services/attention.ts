import type { FactoryDispatchFailureCode } from '@mastra/factory/storage/domains/work-items/base';

import { requestJson } from './request';

export type FactoryAttentionView = 'open' | 'unread' | 'archived';
export type FactoryAttentionReceiptAction = 'read' | 'archive' | 'restore';
export type FactoryAttentionTarget =
  | { kind: 'thread'; sessionId: string; threadId: string }
  | { kind: 'work-item'; workItemId: string; board: 'work' | 'review' }
  | { kind: 'rules' };

export interface FactoryAttentionItem {
  key: string;
  kind: 'automation-failed';
  decisionId: string;
  occurrence: number;
  workItemId: string | null;
  title: string;
  detail: string;
  decisionType: string;
  failureCode: FactoryDispatchFailureCode | null;
  canRetry: boolean;
  occurredAt: string;
  read: boolean;
  archived: boolean;
  target: FactoryAttentionTarget;
}

export interface FactoryAttentionResponse {
  items: FactoryAttentionItem[];
  openCount: number;
  approvalCount: number;
  badgeCount: number;
  unreadCount: number;
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
    return `/factories/${factoryId}/${target.board}?item=${encodeURIComponent(target.workItemId)}`;
  }
  return `/factories/${factoryId}/rules`;
}

export function fetchFactoryAttention(
  baseUrl: string,
  factoryProjectId: string,
  options: {
    view: FactoryAttentionView;
    before?: string;
    limit?: number;
    search?: string;
    signal?: AbortSignal;
  },
): Promise<FactoryAttentionResponse> {
  const query = new URLSearchParams({ view: options.view });
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
  item: Pick<FactoryAttentionItem, 'decisionId' | 'occurrence'>,
  action: FactoryAttentionReceiptAction,
): Promise<{ receipt: { key: string; state: 'read' | 'archived'; readAt: string; archivedAt: string | null } }> {
  return requestJson(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/attention/automation-failed/${encodeURIComponent(item.decisionId)}/${item.occurrence}/${action}`,
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
