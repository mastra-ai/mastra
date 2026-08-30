/**
 * Per-kind attention providers. Each kind owns its counts, its bounded page
 * scan, and its wire item shape; the route layer k-way merges provider pages
 * on `occurredAt desc` with one resumable cursor per kind.
 */

import { factoryDispatchFailureMetadata } from '../rules/dispatch-errors.js';
import type {
  WorkItemCommentRow,
  WorkItemCommentsStorage,
  WorkItemMentionRow,
} from '../storage/domains/comments/base.js';
import type {
  FactoryAttentionIdentity,
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

export const SCAN_PAGE_SIZE = 50;
// Receipt filtering is bounded per request; the response cursor resumes after the last scan.
const MAX_RECEIPT_SCAN_PAGES = 4;

interface ScanBatch<T> {
  rows: T[];
  /** Set only when the page budget stopped a scan that still had rows behind it. */
  continuation?: AttentionStreamPosition;
}

/**
 * One bounded keyset scan, shared by every provider read. Walks newest-first
 * from `before` until the stream runs dry or the page budget is spent; the
 * final batch of a budget stop carries the position to resume from.
 */
export async function* scanBatches<T>(
  fetchBatch: (before?: AttentionStreamPosition) => Promise<{ rows: T[]; hasMore: boolean }>,
  positionOf: (row: T) => AttentionStreamPosition,
  before?: AttentionStreamPosition,
): AsyncGenerator<ScanBatch<T>> {
  let cursor = before;
  for (let scanned = 1; scanned <= MAX_RECEIPT_SCAN_PAGES; scanned += 1) {
    const { rows, hasMore } = await fetchBatch(cursor);
    const last = rows.at(-1);
    if (!last) return;
    const position = positionOf(last);
    yield { rows, ...(hasMore && scanned === MAX_RECEIPT_SCAN_PAGES ? { continuation: position } : {}) };
    if (!hasMore) return;
    cursor = position;
  }
}

/** Fills a page from the scan, stopping at `limit` entries or at the scan budget. */
export async function collectPage<T>(
  batches: AsyncGenerator<ScanBatch<T>>,
  limit: number,
  toEntries: (rows: T[]) => Promise<AttentionEntry[]>,
): Promise<AttentionPageResult> {
  const entries: AttentionEntry[] = [];
  for await (const batch of batches) {
    for (const entry of await toEntries(batch.rows)) {
      if (entries.length === limit) return { entries, hasMore: true };
      entries.push(entry);
    }
    if (batch.continuation) return { entries, hasMore: true, continuation: batch.continuation };
  }
  return { entries, hasMore: false };
}

/** Marks every scanned batch read, reporting where a budget stop left off. */
export async function markScanRead<T>(
  batches: AsyncGenerator<ScanBatch<T>>,
  markBatch: (rows: T[]) => Promise<void>,
): Promise<{ hasMore: boolean; continuation?: AttentionStreamPosition }> {
  for await (const batch of batches) {
    await markBatch(batch.rows);
    if (batch.continuation) return { hasMore: true, continuation: batch.continuation };
  }
  return { hasMore: false };
}

export function factoryDecisionType(decision: FactoryDeferredDecisionRecord): string {
  return typeof decision.decision.type === 'string' ? decision.decision.type.slice(0, 64) : 'unknown';
}

function failureOccurredAt(decision: FactoryDeferredDecisionRecord): Date {
  return decision.completedAt ?? decision.updatedAt;
}

export function matchesView(view: FactoryAttentionView, receipt: FactoryAttentionReceiptRecord | undefined): boolean {
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

export function workItemBoard(item: WorkItemRow): 'review' | 'work' {
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

  #scan(scope: AttentionScope, before?: AttentionStreamPosition) {
    return scanBatches<FactoryDeferredDecisionRecord>(
      async cursor => {
        const page = await this.#workItems.listFailedDecisionPage({
          orgId: scope.orgId,
          factoryProjectId: scope.factoryProjectId,
          before: cursor,
          limit: SCAN_PAGE_SIZE,
        });
        return { rows: page.decisions, hasMore: page.hasMore };
      },
      decision => ({ occurredAt: failureOccurredAt(decision), id: decision.id }),
      before,
    );
  }

  async page(scope: AttentionScope, { view, search, before, limit }: AttentionPageArgs): Promise<AttentionPageResult> {
    return collectPage(this.#scan(scope, before), limit, async decisions => {
      const [receiptByKey, itemById] = await Promise.all([
        this.#receiptsFor(scope, decisions),
        this.#linkedItems(scope, decisions),
      ]);
      const entries: AttentionEntry[] = [];
      for (const decision of decisions) {
        const identity = factoryDecisionAttentionIdentity(decision.id, decision.failureOccurrence);
        const receipt = receiptByKey.get(factoryAttentionKey(scope.factoryProjectId, identity));
        if (!matchesView(view, receipt)) continue;
        const item = decision.workItemId ? itemById.get(decision.workItemId) : undefined;
        if (search && !matchesFailureSearch(decision, item, search)) continue;
        entries.push({
          occurredAt: failureOccurredAt(decision),
          resumeCursor: { occurredAt: failureOccurredAt(decision), id: decision.id },
          item: toFailureItem(scope, decision, item, receipt),
        });
      }
      return entries;
    });
  }

  async #receiptsFor(
    scope: AttentionScope,
    decisions: FactoryDeferredDecisionRecord[],
  ): Promise<Map<string, FactoryAttentionReceiptRecord>> {
    const receipts = await this.#workItems.listAttentionReceipts({
      ...receiptScope(scope),
      identities: decisions.map(decision => factoryDecisionAttentionIdentity(decision.id, decision.failureOccurrence)),
    });
    return new Map(receipts.map(receipt => [factoryAttentionKey(scope.factoryProjectId, receipt), receipt]));
  }

  async #linkedItems(
    scope: AttentionScope,
    decisions: FactoryDeferredDecisionRecord[],
  ): Promise<Map<string, WorkItemRow>> {
    const items = await this.#workItems.listByIds({
      orgId: scope.orgId,
      factoryProjectId: scope.factoryProjectId,
      ids: decisions.flatMap(decision => (decision.workItemId ? [decision.workItemId] : [])),
    });
    return new Map(items.map(item => [item.id, item]));
  }

  async markAllRead(
    scope: AttentionScope,
    { before, now }: { before?: AttentionStreamPosition; now: Date },
  ): Promise<{ hasMore: boolean; continuation?: AttentionStreamPosition }> {
    return markScanRead(this.#scan(scope, before), async decisions => {
      await this.#workItems.markAttentionReceiptsRead({
        ...receiptScope(scope),
        identities: decisions.map(decision =>
          factoryDecisionAttentionIdentity(decision.id, decision.failureOccurrence),
        ),
        now,
      });
    });
  }
}

interface ResolvedMention {
  mention: WorkItemMentionRow;
  comment: WorkItemCommentRow;
  item: WorkItemRow;
  identity: FactoryAttentionIdentity;
  receipt: FactoryAttentionReceiptRecord | undefined;
}

export class MentionAttentionProvider implements AttentionProvider {
  readonly kind = 'mention' as const;
  readonly #workItems: WorkItemsStorage;
  readonly #comments: WorkItemCommentsStorage;

  constructor({ workItems, comments }: { workItems: WorkItemsStorage; comments: WorkItemCommentsStorage }) {
    this.#workItems = workItems;
    this.#comments = comments;
  }

  #scan(scope: AttentionScope, before?: AttentionStreamPosition) {
    return scanBatches<WorkItemMentionRow>(
      async cursor => {
        const rows = await this.#comments.listMentionsForUser({
          ...receiptScope(scope),
          ...(cursor ? { before: cursor } : {}),
          limit: SCAN_PAGE_SIZE + 1,
        });
        return { rows: rows.slice(0, SCAN_PAGE_SIZE), hasMore: rows.length > SCAN_PAGE_SIZE };
      },
      mention => ({ occurredAt: mention.occurredAt, id: mention.id }),
      before,
    );
  }

  /**
   * Mention rows joined to what the inbox needs to show one — dropping the
   * ones it cannot: a deleted comment, or a work item gone from the project.
   */
  async #resolve(scope: AttentionScope, mentions: WorkItemMentionRow[]): Promise<ResolvedMention[]> {
    const [receipts, comments, items] = await Promise.all([
      this.#workItems.listAttentionReceipts({
        ...receiptScope(scope),
        identities: mentions.map(mention => factoryMentionAttentionIdentity(mention.commentId)),
      }),
      this.#comments.listByIds({
        orgId: scope.orgId,
        ids: [...new Set(mentions.map(mention => mention.commentId))],
      }),
      this.#workItems.listByIds({
        orgId: scope.orgId,
        factoryProjectId: scope.factoryProjectId,
        ids: [...new Set(mentions.map(mention => mention.workItemId))],
      }),
    ]);
    const receiptByKey = new Map(
      receipts.map(receipt => [factoryAttentionKey(scope.factoryProjectId, receipt), receipt]),
    );
    const commentById = new Map(comments.map(comment => [comment.id, comment]));
    const itemById = new Map(items.map(item => [item.id, item]));

    const resolved: ResolvedMention[] = [];
    for (const mention of mentions) {
      const comment = commentById.get(mention.commentId);
      const item = itemById.get(mention.workItemId);
      if (!comment || comment.deletedAt || !item) continue;
      const identity = factoryMentionAttentionIdentity(mention.commentId);
      resolved.push({
        mention,
        comment,
        item,
        identity,
        receipt: receiptByKey.get(factoryAttentionKey(scope.factoryProjectId, identity)),
      });
    }
    return resolved;
  }

  /**
   * Derived from the same bounded scan as `page`, never from raw aggregates:
   * the badge must count exactly what the views can show, down to stopping at
   * the same scan budget. Aggregates would count orphan mention rows the list
   * can never display or clear.
   */
  async counts(scope: AttentionScope): Promise<AttentionCounts> {
    let open = 0;
    let unread = 0;
    for await (const batch of this.#scan(scope)) {
      for (const { receipt } of await this.#resolve(scope, batch.rows)) {
        if (receipt?.state !== 'archived') open += 1;
        if (receipt === undefined) unread += 1;
      }
    }
    return { open, unread };
  }

  async latest(scope: AttentionScope): Promise<AttentionLatest | null> {
    const mentions = await this.#comments.listMentionsForUser({ ...receiptScope(scope), limit: 10 });
    const newest = (await this.#resolve(scope, mentions))[0];
    if (!newest) return null;
    return {
      key: factoryAttentionKey(scope.factoryProjectId, newest.identity),
      at: newest.mention.occurredAt,
      unread: newest.receipt === undefined,
    };
  }

  async page(scope: AttentionScope, { view, search, before, limit }: AttentionPageArgs): Promise<AttentionPageResult> {
    return collectPage(this.#scan(scope, before), limit, async mentions => {
      const entries: AttentionEntry[] = [];
      for (const resolved of await this.#resolve(scope, mentions)) {
        if (!matchesView(view, resolved.receipt)) continue;
        if (search && !matchesMentionSearch(resolved, search)) continue;
        entries.push({
          occurredAt: resolved.mention.occurredAt,
          resumeCursor: { occurredAt: resolved.mention.occurredAt, id: resolved.mention.id },
          item: toMentionItem(scope, resolved),
        });
      }
      return entries;
    });
  }

  async markAllRead(
    scope: AttentionScope,
    { before, now }: { before?: AttentionStreamPosition; now: Date },
  ): Promise<{ hasMore: boolean; continuation?: AttentionStreamPosition }> {
    return markScanRead(this.#scan(scope, before), async mentions => {
      await this.#workItems.markAttentionReceiptsRead({
        ...receiptScope(scope),
        identities: mentions.map(mention => factoryMentionAttentionIdentity(mention.commentId)),
        now,
      });
    });
  }
}

function matchesFailureSearch(
  decision: FactoryDeferredDecisionRecord,
  item: WorkItemRow | undefined,
  search: string,
): boolean {
  return (
    item?.title.toLowerCase().includes(search) === true ||
    decision.lastError?.toLowerCase().includes(search) === true ||
    factoryDecisionType(decision).toLowerCase().includes(search)
  );
}

function toFailureItem(
  scope: AttentionScope,
  decision: FactoryDeferredDecisionRecord,
  item: WorkItemRow | undefined,
  receipt: FactoryAttentionReceiptRecord | undefined,
) {
  const failure = factoryDispatchFailureMetadata(decision.failureCode);
  const identity = factoryDecisionAttentionIdentity(decision.id, decision.failureOccurrence);
  return {
    key: factoryAttentionKey(scope.factoryProjectId, identity),
    kind: 'automation-failed' as const,
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

function matchesMentionSearch({ item, comment }: ResolvedMention, search: string): boolean {
  return (
    item.title.toLowerCase().includes(search) ||
    comment.body.toLowerCase().includes(search) ||
    comment.author.displayName?.toLowerCase().includes(search) === true
  );
}

function toMentionItem(scope: AttentionScope, { mention, comment, item, identity, receipt }: ResolvedMention) {
  const authorName = comment.author.displayName;
  return {
    key: factoryAttentionKey(scope.factoryProjectId, identity),
    kind: 'mention' as const,
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
  };
}

export function receiptScope(scope: AttentionScope): { orgId: string; factoryProjectId: string; userId: string } {
  return { orgId: scope.orgId, factoryProjectId: scope.factoryProjectId, userId: scope.userId };
}
