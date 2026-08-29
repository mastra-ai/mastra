/** Projects `activity.ts` fan-out rows. Below the badge: the sidebar counts mentions and failures only. */

import type {
  WorkItemActivityRow,
  WorkItemCommentRow,
  WorkItemCommentsStorage,
} from '../storage/domains/comments/base.js';
import type {
  FactoryAttentionIdentity,
  FactoryAttentionReceiptRecord,
  WorkItemRow,
  WorkItemsStorage,
} from '../storage/domains/work-items/base.js';
import { factoryActivityAttentionIdentity, factoryAttentionKey } from '../storage/domains/work-items/base.js';
import type {
  AttentionCounts,
  AttentionEntry,
  AttentionLatest,
  AttentionPageArgs,
  AttentionPageResult,
  AttentionProvider,
  AttentionScope,
  AttentionStreamPosition,
} from './attention-providers.js';
import {
  collectPage,
  markScanRead,
  matchesView,
  receiptScope,
  SCAN_PAGE_SIZE,
  scanBatches,
  workItemBoard,
} from './attention-providers.js';

interface ResolvedActivity {
  activity: WorkItemActivityRow;
  item: WorkItemRow;
  comment: WorkItemCommentRow | undefined;
  identity: FactoryAttentionIdentity;
  receipt: FactoryAttentionReceiptRecord | undefined;
}

export class ActivityAttentionProvider implements AttentionProvider {
  readonly kind = 'activity' as const;
  readonly #workItems: WorkItemsStorage;
  readonly #comments: WorkItemCommentsStorage;

  constructor({ workItems, comments }: { workItems: WorkItemsStorage; comments: WorkItemCommentsStorage }) {
    this.#workItems = workItems;
    this.#comments = comments;
  }

  #scan(scope: AttentionScope, before?: AttentionStreamPosition) {
    return scanBatches<WorkItemActivityRow>(
      async cursor => {
        const rows = await this.#comments.listActivityForUser({
          ...receiptScope(scope),
          ...(cursor ? { before: cursor } : {}),
          limit: SCAN_PAGE_SIZE + 1,
        });
        return { rows: rows.slice(0, SCAN_PAGE_SIZE), hasMore: rows.length > SCAN_PAGE_SIZE };
      },
      activity => ({ occurredAt: activity.occurredAt, id: activity.id }),
      before,
    );
  }

  /**
   * A vanished work item drops the row; a deleted latest comment does not —
   * the entry still reports that the discussion moved, with the body replaced.
   */
  async #resolve(scope: AttentionScope, rows: WorkItemActivityRow[]): Promise<ResolvedActivity[]> {
    const [receipts, comments, items] = await Promise.all([
      this.#workItems.listAttentionReceipts({
        ...receiptScope(scope),
        identities: rows.map(row => factoryActivityAttentionIdentity(row.workItemId, row.occurrence)),
      }),
      this.#comments.listByIds({
        orgId: scope.orgId,
        ids: [...new Set(rows.map(row => row.latestCommentId))],
      }),
      this.#workItems.listByIds({
        orgId: scope.orgId,
        factoryProjectId: scope.factoryProjectId,
        ids: [...new Set(rows.map(row => row.workItemId))],
      }),
    ]);
    const receiptByKey = new Map(
      receipts.map(receipt => [factoryAttentionKey(scope.factoryProjectId, receipt), receipt]),
    );
    const commentById = new Map(comments.map(comment => [comment.id, comment]));
    const itemById = new Map(items.map(item => [item.id, item]));

    const resolved: ResolvedActivity[] = [];
    for (const activity of rows) {
      const item = itemById.get(activity.workItemId);
      if (!item) continue;
      const identity = factoryActivityAttentionIdentity(activity.workItemId, activity.occurrence);
      resolved.push({
        activity,
        item,
        comment: commentById.get(activity.latestCommentId),
        identity,
        receipt: receiptByKey.get(factoryAttentionKey(scope.factoryProjectId, identity)),
      });
    }
    return resolved;
  }

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

  /** Always null: `latestOccurrence*` drives the notification sound, and this tier stays silent. */
  async latest(): Promise<AttentionLatest | null> {
    return null;
  }

  async page(scope: AttentionScope, { view, search, before, limit }: AttentionPageArgs): Promise<AttentionPageResult> {
    return collectPage(this.#scan(scope, before), limit, async rows => {
      const entries: AttentionEntry[] = [];
      for (const resolved of await this.#resolve(scope, rows)) {
        if (!matchesView(view, resolved.receipt)) continue;
        if (search && !matchesActivitySearch(resolved, search)) continue;
        entries.push({
          occurredAt: resolved.activity.occurredAt,
          resumeCursor: { occurredAt: resolved.activity.occurredAt, id: resolved.activity.id },
          item: toActivityItem(scope, resolved),
        });
      }
      return entries;
    });
  }

  async markAllRead(
    scope: AttentionScope,
    { before, now }: { before?: AttentionStreamPosition; now: Date },
  ): Promise<{ hasMore: boolean; continuation?: AttentionStreamPosition }> {
    return markScanRead(this.#scan(scope, before), async rows => {
      await this.#workItems.markAttentionReceiptsRead({
        ...receiptScope(scope),
        identities: rows.map(row => factoryActivityAttentionIdentity(row.workItemId, row.occurrence)),
        now,
      });
    });
  }
}

function activityDetail({ comment }: ResolvedActivity): string {
  if (!comment || comment.deletedAt) return 'Comment removed';
  return comment.body.slice(0, 512);
}

function matchesActivitySearch(resolved: ResolvedActivity, search: string): boolean {
  return (
    resolved.item.title.toLowerCase().includes(search) ||
    activityDetail(resolved).toLowerCase().includes(search) ||
    resolved.activity.latestAuthorName?.toLowerCase().includes(search) === true
  );
}

function toActivityItem(scope: AttentionScope, resolved: ResolvedActivity) {
  const { activity, item, identity, receipt } = resolved;
  return {
    key: factoryAttentionKey(scope.factoryProjectId, identity),
    kind: 'activity' as const,
    commentId: activity.latestCommentId,
    occurrence: activity.occurrence,
    workItemId: activity.workItemId,
    title: item.title,
    detail: activityDetail(resolved),
    authorId: activity.latestAuthorId,
    ...(activity.latestAuthorName ? { authorName: activity.latestAuthorName } : {}),
    occurredAt: activity.occurredAt.toISOString(),
    read: receipt !== undefined,
    archived: receipt?.state === 'archived',
    target: {
      kind: 'work-item' as const,
      workItemId: activity.workItemId,
      board: workItemBoard(item),
      commentId: activity.latestCommentId,
    },
  };
}
