/**
 * Per-kind attention providers. Each kind owns its counts, its bounded page
 * scan, and its wire item shape; the route layer k-way merges provider pages
 * on `occurredAt desc` with one resumable cursor per kind.
 */

import { factoryDispatchFailureMetadata } from '../rules/dispatch-errors.js';
import type { WorkItemCommentsStorage } from '../storage/domains/comments/base.js';
import type {
  FactoryAttentionKind,
  FactoryAttentionReceiptRecord,
  FactoryDeferredDecisionRecord,
  WorkItemRow,
  WorkItemsStorage,
} from '../storage/domains/work-items/base.js';
import {
  factoryAttentionKey,
  factoryDecisionAttentionIdentity,
  factoryMentionAttentionIdentity,
} from '../storage/domains/work-items/base.js';

export type FactoryAttentionView = 'open' | 'unread' | 'archived';

export interface AttentionScope {
  orgId: string;
  userId: string;
  factoryProjectId: string;
}

export interface AttentionStreamPosition {
  occurredAt: Date;
  id: string;
}

export interface AttentionEntry {
  occurredAt: Date;
  /** Position resuming the provider's stream right after this entry. */
  resumeCursor: AttentionStreamPosition;
  item: Record<string, unknown>;
}

export interface AttentionPageArgs {
  view: FactoryAttentionView;
  search?: string;
  before?: AttentionStreamPosition;
  limit: number;
}

export interface AttentionPageResult {
  entries: AttentionEntry[];
  /** More rows behind the scan once every returned entry is consumed. */
  hasMore: boolean;
  /** Resume point for a scan-budget stop past the last returned entry. */
  continuation?: AttentionStreamPosition;
}

export interface AttentionCounts {
  open: number;
  unread: number;
}

export interface AttentionLatest {
  key: string;
  at: Date;
  unread: boolean;
}

export interface AttentionProvider {
  kind: FactoryAttentionKind;
  counts(scope: AttentionScope): Promise<AttentionCounts>;
  latest(scope: AttentionScope): Promise<AttentionLatest | null>;
  page(scope: AttentionScope, args: AttentionPageArgs): Promise<AttentionPageResult>;
  markAllRead(
    scope: AttentionScope,
    args: { before?: AttentionStreamPosition; now: Date },
  ): Promise<{ hasMore: boolean; continuation?: AttentionStreamPosition }>;
}

const SCAN_PAGE_SIZE = 50;
// Receipt filtering is bounded per request; the response cursor resumes after the last scan.
const MAX_RECEIPT_SCAN_PAGES = 4;

export function factoryDecisionType(decision: FactoryDeferredDecisionRecord): string {
  return typeof decision.decision.type === 'string' ? decision.decision.type.slice(0, 64) : 'unknown';
}

function failureOccurredAt(decision: FactoryDeferredDecisionRecord): Date {
  return decision.completedAt ?? decision.updatedAt;
}

function matchesView(view: FactoryAttentionView, receipt: FactoryAttentionReceiptRecord | undefined): boolean {
  if (view === 'archived') return receipt?.state === 'archived';
  if (view === 'unread') return receipt === undefined;
  return receipt?.state !== 'archived';
}

function attentionTarget(decision: FactoryDeferredDecisionRecord, item: WorkItemRow | undefined) {
  if (!item) return { kind: 'rules' as const };
  const role = typeof decision.decision.role === 'string' ? decision.decision.role : undefined;
  const session = role ? item.sessions[role] : undefined;
  if (session) {
    return {
      kind: 'thread' as const,
      sessionId: session.sessionId,
      threadId: session.threadId,
    };
  }
  return {
    kind: 'work-item' as const,
    workItemId: item.id,
    board: workItemBoard(item),
  };
}

function workItemBoard(item: WorkItemRow): 'review' | 'work' {
  const review = item.externalSource?.integrationId === 'github' && item.externalSource.type === 'pull-request';
  return review ? 'review' : 'work';
}

export class AutomationFailedAttentionProvider implements AttentionProvider {
  readonly kind = 'automation-failed' as const;
  readonly #workItems: WorkItemsStorage;

  constructor({ workItems }: { workItems: WorkItemsStorage }) {
    this.#workItems = workItems;
  }

  async counts(scope: AttentionScope): Promise<AttentionCounts> {
    const [failedCount, receiptCount, archivedCount] = await Promise.all([
      this.#workItems.countDeferredDecisionsByStatuses({
        orgId: scope.orgId,
        factoryProjectId: scope.factoryProjectId,
        statuses: ['failed'],
      }),
      this.#workItems.countAttentionReceipts({ ...receiptScope(scope), kind: this.kind }),
      this.#workItems.countAttentionReceipts({ ...receiptScope(scope), kind: this.kind, state: 'archived' }),
    ]);
    return {
      open: Math.max(0, failedCount - archivedCount),
      unread: Math.max(0, failedCount - receiptCount),
    };
  }

  async latest(scope: AttentionScope): Promise<AttentionLatest | null> {
    const page = await this.#workItems.listFailedDecisionPage({
      orgId: scope.orgId,
      factoryProjectId: scope.factoryProjectId,
      limit: 1,
    });
    const newest = page.decisions[0];
    if (!newest) return null;
    const identity = factoryDecisionAttentionIdentity(newest.id, newest.failureOccurrence);
    const receipts = await this.#workItems.listAttentionReceipts({
      ...receiptScope(scope),
      identities: [identity],
    });
    return {
      key: factoryAttentionKey(scope.factoryProjectId, identity),
      at: failureOccurredAt(newest),
      unread: receipts.length === 0,
    };
  }

  async page(scope: AttentionScope, { view, search, before, limit }: AttentionPageArgs): Promise<AttentionPageResult> {
    const entries: AttentionEntry[] = [];
    let scanBefore = before;
    let scannedPages = 0;
    while (true) {
      const page = await this.#workItems.listFailedDecisionPage({
        orgId: scope.orgId,
        factoryProjectId: scope.factoryProjectId,
        before: scanBefore,
        limit: SCAN_PAGE_SIZE,
      });
      scannedPages += 1;
      if (page.decisions.length === 0) return { entries, hasMore: false };
      const receipts = await this.#workItems.listAttentionReceipts({
        ...receiptScope(scope),
        identities: page.decisions.map(decision =>
          factoryDecisionAttentionIdentity(decision.id, decision.failureOccurrence),
        ),
      });
      const receiptByKey = new Map(
        receipts.map(receipt => [factoryAttentionKey(scope.factoryProjectId, receipt), receipt]),
      );
      const linkedItems = await this.#workItems.listByIds({
        orgId: scope.orgId,
        factoryProjectId: scope.factoryProjectId,
        ids: page.decisions.flatMap(decision => (decision.workItemId ? [decision.workItemId] : [])),
      });
      const itemById = new Map(linkedItems.map(item => [item.id, item]));
      for (const decision of page.decisions) {
        const identity = factoryDecisionAttentionIdentity(decision.id, decision.failureOccurrence);
        const receipt = receiptByKey.get(factoryAttentionKey(scope.factoryProjectId, identity));
        if (!matchesView(view, receipt)) continue;
        const item = decision.workItemId ? itemById.get(decision.workItemId) : undefined;
        if (
          search &&
          item?.title.toLowerCase().includes(search) !== true &&
          decision.lastError?.toLowerCase().includes(search) !== true &&
          !factoryDecisionType(decision).toLowerCase().includes(search)
        ) {
          continue;
        }
        if (entries.length === limit) {
          return { entries, hasMore: true };
        }
        entries.push({
          occurredAt: failureOccurredAt(decision),
          resumeCursor: { occurredAt: failureOccurredAt(decision), id: decision.id },
          item: this.#toItem(scope, decision, item, receipt),
        });
      }
      const lastScanned = page.decisions.at(-1);
      if (!page.hasMore || !lastScanned) return { entries, hasMore: false };
      if (scannedPages === MAX_RECEIPT_SCAN_PAGES) {
        return {
          entries,
          hasMore: true,
          continuation: { occurredAt: failureOccurredAt(lastScanned), id: lastScanned.id },
        };
      }
      scanBefore = { occurredAt: failureOccurredAt(lastScanned), id: lastScanned.id };
    }
  }

  async markAllRead(
    scope: AttentionScope,
    { before, now }: { before?: AttentionStreamPosition; now: Date },
  ): Promise<{ hasMore: boolean; continuation?: AttentionStreamPosition }> {
    let scanBefore = before;
    let pages = 0;
    while (pages < MAX_RECEIPT_SCAN_PAGES) {
      const page = await this.#workItems.listFailedDecisionPage({
        orgId: scope.orgId,
        factoryProjectId: scope.factoryProjectId,
        before: scanBefore,
        limit: SCAN_PAGE_SIZE,
      });
      pages += 1;
      if (page.decisions.length === 0) break;
      await this.#workItems.markAttentionReceiptsRead({
        ...receiptScope(scope),
        identities: page.decisions.map(decision =>
          factoryDecisionAttentionIdentity(decision.id, decision.failureOccurrence),
        ),
        now,
      });
      const last = page.decisions.at(-1);
      if (!page.hasMore || !last) break;
      const position = { occurredAt: failureOccurredAt(last), id: last.id };
      if (pages === MAX_RECEIPT_SCAN_PAGES) return { hasMore: true, continuation: position };
      scanBefore = position;
    }
    return { hasMore: false };
  }

  #toItem(
    scope: AttentionScope,
    decision: FactoryDeferredDecisionRecord,
    item: WorkItemRow | undefined,
    receipt: FactoryAttentionReceiptRecord | undefined,
  ) {
    const failure = factoryDispatchFailureMetadata(decision.failureCode);
    const identity = factoryDecisionAttentionIdentity(decision.id, decision.failureOccurrence);
    return {
      key: factoryAttentionKey(scope.factoryProjectId, identity),
      kind: this.kind,
      decisionId: decision.id,
      occurrence: decision.failureOccurrence,
      workItemId: decision.workItemId,
      title: item?.title ?? failure.label,
      detail: decision.lastError?.slice(0, 512) ?? failure.label,
      decisionType: factoryDecisionType(decision),
      failureCode: decision.failureCode,
      canRetry: failure.canRetry,
      occurredAt: failureOccurredAt(decision).toISOString(),
      read: receipt !== undefined,
      archived: receipt?.state === 'archived',
      target: attentionTarget(decision, item),
    };
  }
}

export class MentionAttentionProvider implements AttentionProvider {
  readonly kind = 'mention' as const;
  readonly #workItems: WorkItemsStorage;
  readonly #comments: WorkItemCommentsStorage;

  constructor({ workItems, comments }: { workItems: WorkItemsStorage; comments: WorkItemCommentsStorage }) {
    this.#workItems = workItems;
    this.#comments = comments;
  }

  async counts(scope: AttentionScope): Promise<AttentionCounts> {
    const [mentionCount, receiptCount, archivedCount] = await Promise.all([
      this.#comments.countMentionsForUser(receiptScope(scope)),
      this.#workItems.countAttentionReceipts({ ...receiptScope(scope), kind: this.kind }),
      this.#workItems.countAttentionReceipts({ ...receiptScope(scope), kind: this.kind, state: 'archived' }),
    ]);
    return {
      open: Math.max(0, mentionCount - archivedCount),
      unread: Math.max(0, mentionCount - receiptCount),
    };
  }

  async latest(scope: AttentionScope): Promise<AttentionLatest | null> {
    const [newest] = await this.#comments.listMentionsForUser({ ...receiptScope(scope), limit: 1 });
    if (!newest) return null;
    const identity = factoryMentionAttentionIdentity(newest.commentId);
    const receipts = await this.#workItems.listAttentionReceipts({
      ...receiptScope(scope),
      identities: [identity],
    });
    return {
      key: factoryAttentionKey(scope.factoryProjectId, identity),
      at: newest.occurredAt,
      unread: receipts.length === 0,
    };
  }

  async page(scope: AttentionScope, { view, search, before, limit }: AttentionPageArgs): Promise<AttentionPageResult> {
    const entries: AttentionEntry[] = [];
    let scanBefore = before;
    let scannedPages = 0;
    while (true) {
      const mentions = await this.#comments.listMentionsForUser({
        ...receiptScope(scope),
        before: scanBefore,
        limit: SCAN_PAGE_SIZE + 1,
      });
      scannedPages += 1;
      const page = mentions.slice(0, SCAN_PAGE_SIZE);
      const pageHasMore = mentions.length > SCAN_PAGE_SIZE;
      if (page.length === 0) return { entries, hasMore: false };

      const receipts = await this.#workItems.listAttentionReceipts({
        ...receiptScope(scope),
        identities: page.map(mention => factoryMentionAttentionIdentity(mention.commentId)),
      });
      const receiptByKey = new Map(
        receipts.map(receipt => [factoryAttentionKey(scope.factoryProjectId, receipt), receipt]),
      );
      const comments = await this.#comments.listByIds({
        orgId: scope.orgId,
        ids: [...new Set(page.map(mention => mention.commentId))],
      });
      const commentById = new Map(comments.map(comment => [comment.id, comment]));
      const items = await this.#workItems.listByIds({
        orgId: scope.orgId,
        factoryProjectId: scope.factoryProjectId,
        ids: [...new Set(page.map(mention => mention.workItemId))],
      });
      const itemById = new Map(items.map(item => [item.id, item]));

      for (const mention of page) {
        const comment = commentById.get(mention.commentId);
        if (!comment || comment.deletedAt) continue;
        const item = itemById.get(mention.workItemId);
        if (!item) continue;
        const identity = factoryMentionAttentionIdentity(mention.commentId);
        const receipt = receiptByKey.get(factoryAttentionKey(scope.factoryProjectId, identity));
        if (!matchesView(view, receipt)) continue;
        const authorName = comment.author.displayName;
        if (
          search &&
          !item.title.toLowerCase().includes(search) &&
          !comment.body.toLowerCase().includes(search) &&
          authorName?.toLowerCase().includes(search) !== true
        ) {
          continue;
        }
        if (entries.length === limit) {
          return { entries, hasMore: true };
        }
        entries.push({
          occurredAt: mention.occurredAt,
          resumeCursor: { occurredAt: mention.occurredAt, id: mention.id },
          item: {
            key: factoryAttentionKey(scope.factoryProjectId, identity),
            kind: this.kind,
            commentId: mention.commentId,
            occurrence: 0,
            workItemId: mention.workItemId,
            title: item.title,
            detail: comment.body.slice(0, 512),
            authorId: comment.author.id,
            ...(authorName ? { authorName } : {}),
            occurredAt: mention.occurredAt.toISOString(),
            read: receipt !== undefined,
            archived: receipt?.state === 'archived',
            target: {
              kind: 'work-item' as const,
              workItemId: mention.workItemId,
              board: workItemBoard(item),
              commentId: mention.commentId,
            },
          },
        });
      }
      const lastScanned = page.at(-1);
      if (!pageHasMore || !lastScanned) return { entries, hasMore: false };
      const position = { occurredAt: lastScanned.occurredAt, id: lastScanned.id };
      if (scannedPages === MAX_RECEIPT_SCAN_PAGES) {
        return { entries, hasMore: true, continuation: position };
      }
      scanBefore = position;
    }
  }

  async markAllRead(
    scope: AttentionScope,
    { before, now }: { before?: AttentionStreamPosition; now: Date },
  ): Promise<{ hasMore: boolean; continuation?: AttentionStreamPosition }> {
    let scanBefore = before;
    let pages = 0;
    while (pages < MAX_RECEIPT_SCAN_PAGES) {
      const mentions = await this.#comments.listMentionsForUser({
        ...receiptScope(scope),
        before: scanBefore,
        limit: SCAN_PAGE_SIZE + 1,
      });
      pages += 1;
      const page = mentions.slice(0, SCAN_PAGE_SIZE);
      if (page.length === 0) break;
      await this.#workItems.markAttentionReceiptsRead({
        ...receiptScope(scope),
        identities: page.map(mention => factoryMentionAttentionIdentity(mention.commentId)),
        now,
      });
      const last = page.at(-1);
      if (mentions.length <= SCAN_PAGE_SIZE || !last) break;
      const position = { occurredAt: last.occurredAt, id: last.id };
      if (pages === MAX_RECEIPT_SCAN_PAGES) return { hasMore: true, continuation: position };
      scanBefore = position;
    }
    return { hasMore: false };
  }
}

function receiptScope(scope: AttentionScope): { orgId: string; factoryProjectId: string; userId: string } {
  return { orgId: scope.orgId, factoryProjectId: scope.factoryProjectId, userId: scope.userId };
}
