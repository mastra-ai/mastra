import { boardForWorkItem } from '../boards/index.js';
import type { BoardRegistry } from '../boards/index.js';
import { toBoardSource } from '../boards/project-boards.js';
import type { ProjectBoardSource } from '../boards/project-boards.js';
import { decisionRetryable, overtakenDecisionIds } from '../rules/decision-applicability.js';
/**
 * Per-kind attention providers. Each kind owns its counts, its bounded page
 * scan, and its wire item shape; the route layer k-way merges provider pages
 * on `occurredAt desc` with one resumable cursor per kind.
 */

import { factoryDispatchFailureMetadata } from '../rules/dispatch-errors.js';
import type {
  FactoryAttentionIdentity,
  FactoryAttentionKind,
  FactoryAttentionReceiptRecord,
  FactoryDeferredDecisionRecord,
  FactoryDispatchStatus,
  WorkItemRow,
  WorkItemsStorage,
} from '../storage/domains/work-items/base.js';
import { factoryAttentionKey, factoryDecisionAttentionIdentity } from '../storage/domains/work-items/base.js';

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
    board: boardForWorkItem(item),
  };
}

/** One deferred-decision status seen as attention: failures and parked runs differ only by this. */
export interface DecisionAttentionSpec {
  kind: FactoryAttentionKind;
  status: FactoryDispatchStatus;
  identity(decision: FactoryDeferredDecisionRecord): FactoryAttentionIdentity;
  occurredAt(decision: FactoryDeferredDecisionRecord): Date;
  title(decision: FactoryDeferredDecisionRecord, item: WorkItemRow | undefined): string;
  detail(decision: FactoryDeferredDecisionRecord, item: WorkItemRow | undefined): string;
  extra?(decision: FactoryDeferredDecisionRecord, context: { overtaken: boolean }): Record<string, unknown>;
  matches(decision: FactoryDeferredDecisionRecord, item: WorkItemRow | undefined, search: string): boolean;
}

export class DecisionAttentionProvider implements AttentionProvider {
  readonly kind: FactoryAttentionKind;
  readonly #workItems: WorkItemsStorage;
  readonly #spec: DecisionAttentionSpec;
  readonly #boards: ProjectBoardSource;

  constructor(
    { workItems, boards }: { workItems: WorkItemsStorage; boards: BoardRegistry | ProjectBoardSource },
    spec: DecisionAttentionSpec,
  ) {
    this.#workItems = workItems;
    this.#boards = toBoardSource(boards);
    this.#spec = spec;
    this.kind = spec.kind;
  }

  async counts(scope: AttentionScope): Promise<AttentionCounts> {
    const [total, receiptCount, archivedCount] = await Promise.all([
      this.#workItems.countDeferredDecisionsByStatuses({
        orgId: scope.orgId,
        factoryProjectId: scope.factoryProjectId,
        statuses: [this.#spec.status],
      }),
      this.#workItems.countAttentionReceipts({ ...receiptScope(scope), kind: this.kind }),
      this.#workItems.countAttentionReceipts({ ...receiptScope(scope), kind: this.kind, state: 'archived' }),
    ]);
    return {
      open: Math.max(0, total - archivedCount),
      unread: Math.max(0, total - receiptCount),
    };
  }

  async latest(scope: AttentionScope): Promise<AttentionLatest | null> {
    const page = await this.#workItems.listDecisionPageByStatus({
      orgId: scope.orgId,
      factoryProjectId: scope.factoryProjectId,
      status: this.#spec.status,
      limit: 1,
    });
    const newest = page.decisions[0];
    if (!newest) return null;
    const identity = this.#spec.identity(newest);
    const receipts = await this.#workItems.listAttentionReceipts({
      ...receiptScope(scope),
      identities: [identity],
    });
    return {
      key: factoryAttentionKey(scope.factoryProjectId, identity),
      at: this.#spec.occurredAt(newest),
      unread: receipts.length === 0,
    };
  }

  #scan(scope: AttentionScope, before?: AttentionStreamPosition) {
    return scanBatches<FactoryDeferredDecisionRecord>(
      async cursor => {
        const page = await this.#workItems.listDecisionPageByStatus({
          orgId: scope.orgId,
          factoryProjectId: scope.factoryProjectId,
          status: this.#spec.status,
          before: cursor,
          limit: SCAN_PAGE_SIZE,
        });
        return { rows: page.decisions, hasMore: page.hasMore };
      },
      decision => ({ occurredAt: this.#spec.occurredAt(decision), id: decision.id }),
      before,
    );
  }

  async page(scope: AttentionScope, { view, search, before, limit }: AttentionPageArgs): Promise<AttentionPageResult> {
    return collectPage(this.#scan(scope, before), limit, async decisions => {
      const [receiptByKey, itemById, overtaken] = await Promise.all([
        this.#receiptsFor(scope, decisions),
        this.#linkedItems(scope, decisions),
        this.#boards.load(scope).then(boards => overtakenDecisionIds(this.#workItems, boards, scope, decisions)),
      ]);
      const entries: AttentionEntry[] = [];
      for (const decision of decisions) {
        const identity = this.#spec.identity(decision);
        const receipt = receiptByKey.get(factoryAttentionKey(scope.factoryProjectId, identity));
        if (!matchesView(view, receipt)) continue;
        const item = decision.workItemId ? itemById.get(decision.workItemId) : undefined;
        if (search && !this.#spec.matches(decision, item, search)) continue;
        const occurredAt = this.#spec.occurredAt(decision);
        entries.push({
          occurredAt,
          resumeCursor: { occurredAt, id: decision.id },
          item: {
            key: factoryAttentionKey(scope.factoryProjectId, identity),
            kind: this.kind,
            decisionId: decision.id,
            occurrence: identity.occurrence,
            workItemId: decision.workItemId,
            title: this.#spec.title(decision, item),
            detail: this.#spec.detail(decision, item),
            decisionType: factoryDecisionType(decision),
            ...this.#spec.extra?.(decision, { overtaken: overtaken.has(decision.id) }),
            occurredAt: occurredAt.toISOString(),
            read: receipt !== undefined,
            archived: receipt?.state === 'archived',
            target: attentionTarget(decision, item),
          },
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
      identities: decisions.map(decision => this.#spec.identity(decision)),
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
        identities: decisions.map(decision => this.#spec.identity(decision)),
        now,
      });
    });
  }
}

export const failedDecisionAttentionSpec: DecisionAttentionSpec = {
  kind: 'automation-failed',
  status: 'failed',
  identity: decision => factoryDecisionAttentionIdentity(decision.id, decision.failureOccurrence),
  occurredAt: decision => decision.completedAt ?? decision.updatedAt,
  title: (decision, item) => item?.title ?? factoryDispatchFailureMetadata(decision.failureCode).label,
  detail: decision => decision.lastError?.slice(0, 512) ?? factoryDispatchFailureMetadata(decision.failureCode).label,
  extra: (decision, { overtaken }) => ({
    failureCode: decision.failureCode,
    canRetry: decisionRetryable(decision, overtaken),
  }),
  matches: (decision, item, search) =>
    item?.title.toLowerCase().includes(search) === true ||
    decision.lastError?.toLowerCase().includes(search) === true ||
    factoryDecisionType(decision).toLowerCase().includes(search),
};

export function receiptScope(scope: AttentionScope): { orgId: string; factoryProjectId: string; userId: string } {
  return { orgId: scope.orgId, factoryProjectId: scope.factoryProjectId, userId: scope.userId };
}
