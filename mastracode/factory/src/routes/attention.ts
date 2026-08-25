import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';

import { factoryDispatchFailureMetadata } from '../rules/dispatch-errors.js';
import type {
  FactoryAttentionReceiptAction,
  FactoryAttentionReceiptRecord,
  FactoryDeferredDecisionRecord,
  WorkItemRow,
  WorkItemsStorage,
} from '../storage/domains/work-items/base.js';
import { factoryAttentionKey, factoryDecisionAttentionIdentity } from '../storage/domains/work-items/base.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;
// Receipt filtering is bounded to 200 failed decisions per request; the response cursor resumes after the last scan.
const MAX_RECEIPT_SCAN_PAGES = 4;

type FactoryAttentionView = 'open' | 'unread' | 'archived';

interface ResolvedAttentionProject {
  orgId: string;
  userId: string;
  factoryProjectId: string;
}

interface AttentionRouteDependencies {
  workItems: WorkItemsStorage;
  resolveProject(context: unknown): Promise<ResolvedAttentionProject | { response: Response }>;
}

export function factoryDecisionType(decision: FactoryDeferredDecisionRecord): string {
  return typeof decision.decision.type === 'string' ? decision.decision.type.slice(0, 64) : 'unknown';
}

function parseAttentionView(raw: string | undefined): FactoryAttentionView | undefined {
  if (!raw || raw === 'open') return 'open';
  if (raw === 'unread' || raw === 'archived') return raw;
  return undefined;
}

function parseAttentionLimit(raw: string | undefined): number {
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_PAGE_SIZE;
  if (!Number.isFinite(parsed)) return DEFAULT_PAGE_SIZE;
  return Math.max(1, Math.min(MAX_PAGE_SIZE, parsed));
}

function attentionIdentity(decision: FactoryDeferredDecisionRecord) {
  return factoryDecisionAttentionIdentity(decision.id, decision.failureOccurrence);
}

function attentionKey(factoryProjectId: string, decision: FactoryDeferredDecisionRecord): string {
  return factoryAttentionKey(factoryProjectId, attentionIdentity(decision));
}

function failureOccurredAt(decision: FactoryDeferredDecisionRecord): Date {
  return decision.completedAt ?? decision.updatedAt;
}

function encodeAttentionCursor(decision: FactoryDeferredDecisionRecord): string {
  return Buffer.from(JSON.stringify([failureOccurredAt(decision).toISOString(), decision.id]), 'utf8').toString(
    'base64url',
  );
}

function parseAttentionCursor(raw: string | undefined): { occurredAt: Date; id: string } | undefined {
  if (!raw) return undefined;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (
      !Array.isArray(decoded) ||
      decoded.length !== 2 ||
      typeof decoded[0] !== 'string' ||
      typeof decoded[1] !== 'string'
    ) {
      return undefined;
    }
    const occurredAt = new Date(decoded[0]);
    if (Number.isNaN(occurredAt.getTime()) || !UUID_RE.test(decoded[1])) return undefined;
    return { occurredAt, id: decoded[1] };
  } catch {
    return undefined;
  }
}

function parseFailureOccurrence(raw: string | undefined): number | undefined {
  if (!raw || !/^(0|[1-9]\d*)$/.test(raw)) return undefined;
  const occurrence = Number(raw);
  return Number.isSafeInteger(occurrence) ? occurrence : undefined;
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
  const review = item.externalSource?.integrationId === 'github' && item.externalSource.type === 'pull-request';
  return {
    kind: 'work-item' as const,
    workItemId: item.id,
    board: review ? ('review' as const) : ('work' as const),
  };
}

function attentionItem(
  factoryProjectId: string,
  decision: FactoryDeferredDecisionRecord,
  item: WorkItemRow | undefined,
  receipt: FactoryAttentionReceiptRecord | undefined,
) {
  const failure = factoryDispatchFailureMetadata(decision.failureCode);
  return {
    key: attentionKey(factoryProjectId, decision),
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

function receiptRoute(
  dependencies: AttentionRouteDependencies,
  verb: 'read' | 'archive' | 'restore',
  action: FactoryAttentionReceiptAction,
): ApiRoute {
  return registerApiRoute(`/web/factory/projects/:id/attention/automation-failed/:decisionId/:occurrence/${verb}`, {
    method: 'POST',
    requiresAuth: false,
    handler: async context => {
      const resolved = await dependencies.resolveProject(context);
      if ('response' in resolved) return resolved.response;
      const decisionId = context.req.param('decisionId');
      const failureOccurrence = parseFailureOccurrence(context.req.param('occurrence'));
      if (!decisionId || !UUID_RE.test(decisionId) || failureOccurrence === undefined) {
        return context.json({ error: 'invalid_attention_item' }, 422);
      }
      await dependencies.workItems.ensureReady();
      const receipt = await dependencies.workItems.setAttentionReceipt({
        orgId: resolved.orgId,
        factoryProjectId: resolved.factoryProjectId,
        userId: resolved.userId,
        decisionId,
        failureOccurrence,
        action,
        now: new Date(),
      });
      if (!receipt) return context.json({ error: 'attention_item_not_current' }, 409);
      return context.json({
        receipt: {
          key: factoryAttentionKey(resolved.factoryProjectId, receipt),
          state: receipt.state,
          readAt: receipt.readAt.toISOString(),
          archivedAt: receipt.archivedAt?.toISOString() ?? null,
        },
      });
    },
  });
}

export function buildAttentionRoutes(dependencies: AttentionRouteDependencies): ApiRoute[] {
  const { workItems } = dependencies;
  return [
    registerApiRoute('/web/factory/projects/:id/attention', {
      method: 'GET',
      requiresAuth: false,
      handler: async context => {
        const resolved = await dependencies.resolveProject(context);
        if ('response' in resolved) return resolved.response;
        const view = parseAttentionView(context.req.query('view'));
        if (view === undefined) return context.json({ error: 'invalid_attention_view' }, 400);
        const cursorRaw = context.req.query('before');
        const before = parseAttentionCursor(cursorRaw);
        if (cursorRaw && !before) return context.json({ error: 'invalid_cursor' }, 400);
        await workItems.ensureReady();
        const [failedCount, approvalCount, receiptCount, archivedCount, newestPage] = await Promise.all([
          workItems.countDeferredDecisionsByStatuses({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
            statuses: ['failed'],
          }),
          workItems.countDeferredDecisionsByStatuses({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
            statuses: ['proposed'],
          }),
          workItems.countAttentionReceipts({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
            userId: resolved.userId,
          }),
          workItems.countAttentionReceipts({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
            userId: resolved.userId,
            state: 'archived',
          }),
          workItems.listFailedDecisionPage({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
            limit: 1,
          }),
        ]);
        const failureOpenCount = Math.max(0, failedCount - archivedCount);
        const openCount = failureOpenCount + approvalCount;
        const unreadCount = Math.max(0, failedCount - receiptCount);
        const badgeCount = unreadCount + approvalCount;
        const newestFailure = newestPage.decisions[0];
        const newestReceipt = newestFailure
          ? (
              await workItems.listAttentionReceipts({
                orgId: resolved.orgId,
                factoryProjectId: resolved.factoryProjectId,
                userId: resolved.userId,
                identities: [attentionIdentity(newestFailure)],
              })
            )[0]
          : undefined;
        const search = context.req.query('search')?.trim().toLowerCase().slice(0, 200);
        const requestedLimit = parseAttentionLimit(context.req.query('limit'));
        const visible: Array<{
          decision: FactoryDeferredDecisionRecord;
          item: WorkItemRow | undefined;
          receipt: FactoryAttentionReceiptRecord | undefined;
        }> = [];
        let scanBefore = before;
        let cursorDecision: FactoryDeferredDecisionRecord | undefined;
        let continuationDecision: FactoryDeferredDecisionRecord | undefined;
        let scannedPages = 0;
        let hasMore = false;

        scan: while (
          (view === 'open' && failureOpenCount > 0) ||
          (view === 'unread' && unreadCount > 0) ||
          (view === 'archived' && archivedCount > 0)
        ) {
          const page = await workItems.listFailedDecisionPage({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
            before: scanBefore,
            limit: MAX_PAGE_SIZE,
          });
          scannedPages += 1;
          if (page.decisions.length === 0) break;
          const receipts = await workItems.listAttentionReceipts({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
            userId: resolved.userId,
            identities: page.decisions.map(attentionIdentity),
          });
          const receiptByKey = new Map(
            receipts.map(receipt => [factoryAttentionKey(resolved.factoryProjectId, receipt), receipt]),
          );
          const linkedItems = await workItems.listByIds({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
            ids: page.decisions.flatMap(decision => (decision.workItemId ? [decision.workItemId] : [])),
          });
          const itemById = new Map(linkedItems.map(item => [item.id, item]));
          for (const decision of page.decisions) {
            const receipt = receiptByKey.get(attentionKey(resolved.factoryProjectId, decision));
            if (
              view === 'archived'
                ? receipt?.state !== 'archived'
                : view === 'unread'
                  ? receipt
                  : receipt?.state === 'archived'
            ) {
              continue;
            }
            const item = decision.workItemId ? itemById.get(decision.workItemId) : undefined;
            if (
              search &&
              item?.title.toLowerCase().includes(search) !== true &&
              decision.lastError?.toLowerCase().includes(search) !== true &&
              !factoryDecisionType(decision).toLowerCase().includes(search)
            ) {
              continue;
            }
            if (visible.length === requestedLimit) {
              hasMore = true;
              continuationDecision = cursorDecision;
              break scan;
            }
            visible.push({ decision, item, receipt });
            if (visible.length === requestedLimit) cursorDecision = decision;
          }
          const lastScanned = page.decisions.at(-1);
          if (!page.hasMore || !lastScanned) break;
          if (scannedPages === MAX_RECEIPT_SCAN_PAGES) {
            hasMore = true;
            continuationDecision = lastScanned;
            break;
          }
          scanBefore = { occurredAt: failureOccurredAt(lastScanned), id: lastScanned.id };
        }

        return context.json({
          items: visible.map(({ decision, item, receipt }) =>
            attentionItem(resolved.factoryProjectId, decision, item, receipt),
          ),
          openCount,
          approvalCount,
          badgeCount,
          unreadCount,
          latestOccurrenceKey: newestFailure ? attentionKey(resolved.factoryProjectId, newestFailure) : null,
          latestOccurrenceAt: newestFailure ? failureOccurredAt(newestFailure).toISOString() : null,
          latestOccurrenceUnread: newestFailure !== undefined && newestReceipt === undefined,
          hasMore,
          ...(hasMore && continuationDecision ? { nextCursor: encodeAttentionCursor(continuationDecision) } : {}),
        });
      },
    }),
    registerApiRoute('/web/factory/projects/:id/attention/read-all', {
      method: 'POST',
      requiresAuth: false,
      handler: async context => {
        const resolved = await dependencies.resolveProject(context);
        if ('response' in resolved) return resolved.response;
        const cursorRaw = context.req.query('before');
        const initialBefore = parseAttentionCursor(cursorRaw);
        if (cursorRaw && !initialBefore) return context.json({ error: 'invalid_cursor' }, 400);
        await workItems.ensureReady();
        let before = initialBefore;
        let pages = 0;
        let hasMore = false;
        let nextCursor: string | undefined;
        while (pages < MAX_RECEIPT_SCAN_PAGES) {
          const page = await workItems.listFailedDecisionPage({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
            before,
            limit: MAX_PAGE_SIZE,
          });
          pages += 1;
          if (page.decisions.length === 0) break;
          await workItems.markAttentionReceiptsRead({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
            userId: resolved.userId,
            occurrences: page.decisions.map(decision => ({
              decisionId: decision.id,
              failureOccurrence: decision.failureOccurrence,
            })),
            now: new Date(),
          });
          const last = page.decisions.at(-1);
          if (!page.hasMore || !last) break;
          if (pages === MAX_RECEIPT_SCAN_PAGES) {
            hasMore = true;
            nextCursor = encodeAttentionCursor(last);
            break;
          }
          before = { occurredAt: failureOccurredAt(last), id: last.id };
        }
        return context.json({ ok: true, hasMore, ...(nextCursor ? { nextCursor } : {}) });
      },
    }),
    receiptRoute(dependencies, 'read', 'read'),
    receiptRoute(dependencies, 'archive', 'archive'),
    receiptRoute(dependencies, 'restore', 'restore'),
  ];
}
