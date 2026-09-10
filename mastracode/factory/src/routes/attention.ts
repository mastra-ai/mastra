/**
 * Attention routes: k-way merge of the per-kind providers on `occurredAt desc`.
 * The wire cursor is a per-kind map — each kind's stream resumes independently,
 * `null` meaning "not started yet", an absent kind meaning "exhausted".
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';

import type { LiveSessions } from '../session/live-sessions.js';
import type { WorkItemCommentsStorage } from '../storage/domains/comments/base.js';
import type {
  FactoryAttentionKind,
  FactoryAttentionReceiptAction,
  WorkItemsStorage,
} from '../storage/domains/work-items/base.js';
import { factoryAttentionKey } from '../storage/domains/work-items/base.js';
import { ActivityAttentionProvider } from './attention-activity.js';
import { ParkedRunAttentionProvider } from './attention-parked.js';
import type { ParkedSessionOwnership } from './attention-parked.js';
import { proposedDecisionAttentionSpec } from './attention-proposed.js';
import type {
  AttentionPageResult,
  AttentionProvider,
  AttentionScope,
  AttentionStreamPosition,
} from './attention-providers.js';
import {
  DecisionAttentionProvider,
  failedDecisionAttentionSpec,
  MentionAttentionProvider,
  SupervisorFindingAttentionProvider,
} from './attention-providers.js';
import { FACTORY_ROUTE_CONTRACTS } from './contracts.js';

export { factoryDecisionType } from './attention-providers.js';

interface AttentionRouteDependencies {
  workItems: WorkItemsStorage;
  comments: WorkItemCommentsStorage;
  liveSessions: Pick<LiveSessions, 'parked' | 'parkedIn'>;
  /** Session ownership, so a park no work item authorizes is listed only for a viewer its session row admits. */
  sessions?: ParkedSessionOwnership;
  resolveProject(context: unknown): Promise<AttentionScope | { response: Response }>;
}

type AttentionCursorMap = Map<FactoryAttentionKind, AttentionStreamPosition | undefined>;

function encodeAttentionCursor(cursors: AttentionCursorMap): string {
  const wire: Record<string, [string, string] | null> = {};
  for (const [kind, position] of cursors) {
    wire[kind] = position ? [position.occurredAt.toISOString(), position.id] : null;
  }
  return Buffer.from(JSON.stringify(wire), 'utf8').toString('base64url');
}

interface MergedAttentionPage {
  items: Array<Record<string, unknown>>;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Take the newest `limit` entries across provider pages. Each kind's next
 * cursor is the resume position of its last consumed entry; a kind consumed to
 * the end inherits the provider's own continuation.
 */
function mergeAttentionPages(
  pages: Array<{
    kind: FactoryAttentionKind;
    incoming: AttentionStreamPosition | undefined;
    result: AttentionPageResult;
  }>,
  limit: number,
): MergedAttentionPage {
  const consumed = new Map(pages.map(page => [page.kind, 0]));
  const items: Array<Record<string, unknown>> = [];
  while (items.length < limit) {
    let best: { kind: FactoryAttentionKind; at: number } | undefined;
    for (const page of pages) {
      const next = page.result.entries[consumed.get(page.kind) ?? 0];
      if (!next) continue;
      const at = next.occurredAt.getTime();
      if (!best || at > best.at) best = { kind: page.kind, at };
    }
    if (!best) break;
    const index = consumed.get(best.kind) ?? 0;
    const entry = pages.find(page => page.kind === best.kind)?.result.entries[index];
    if (!entry) break;
    items.push(entry.item);
    consumed.set(best.kind, index + 1);
  }

  const nextCursors: AttentionCursorMap = new Map();
  let hasMore = false;
  for (const page of pages) {
    const used = consumed.get(page.kind) ?? 0;
    const entries = page.result.entries;
    if (used < entries.length) {
      hasMore = true;
      const lastConsumed = used > 0 ? entries[used - 1] : undefined;
      nextCursors.set(page.kind, lastConsumed ? lastConsumed.resumeCursor : page.incoming);
      continue;
    }
    if (page.result.hasMore) {
      hasMore = true;
      nextCursors.set(page.kind, page.result.continuation ?? entries.at(-1)?.resumeCursor ?? page.incoming);
    }
  }
  return {
    items,
    hasMore,
    ...(hasMore && nextCursors.size > 0 ? { nextCursor: encodeAttentionCursor(nextCursors) } : {}),
  };
}

function receiptRoute(
  dependencies: AttentionRouteDependencies,
  verb: 'read' | 'archive' | 'restore',
  action: FactoryAttentionReceiptAction,
): ApiRoute {
  const contract =
    verb === 'read'
      ? FACTORY_ROUTE_CONTRACTS.attentionRead
      : verb === 'archive'
        ? FACTORY_ROUTE_CONTRACTS.attentionArchive
        : FACTORY_ROUTE_CONTRACTS.attentionRestore;
  return registerApiRoute(contract.path, {
    method: contract.method,
    requiresAuth: false,
    handler: async context => {
      const resolved = await dependencies.resolveProject(context);
      if ('response' in resolved) return resolved.response;
      const parsedPath = contract.pathSchema.safeParse({
        id: resolved.factoryProjectId,
        kind: context.req.param('kind'),
        sourceId: context.req.param('sourceId'),
        occurrence: context.req.param('occurrence'),
      });
      if (!parsedPath.success) return context.json({ error: 'invalid_attention_item' }, 422);
      const { kind, sourceId, occurrence } = parsedPath.data;
      const stillParked =
        kind !== 'agent-waiting' || dependencies.liveSessions.parked(sourceId)?.suspendedAt === occurrence;
      if (!stillParked) return context.json({ error: 'attention_item_not_current' }, 409);
      await dependencies.workItems.ensureReady();
      const receipt = await dependencies.workItems.setAttentionReceipt({
        orgId: resolved.orgId,
        factoryProjectId: resolved.factoryProjectId,
        userId: resolved.userId,
        identity: { kind, sourceId, occurrence },
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
  const { workItems, comments, liveSessions, sessions } = dependencies;
  const providers: AttentionProvider[] = [
    new DecisionAttentionProvider({ workItems }, failedDecisionAttentionSpec),
    new DecisionAttentionProvider({ workItems }, proposedDecisionAttentionSpec),
    new SupervisorFindingAttentionProvider({ workItems }),
    new MentionAttentionProvider({ workItems, comments }),
    new ActivityAttentionProvider({ workItems, comments }),
    new ParkedRunAttentionProvider({ workItems, liveSessions, ...(sessions ? { sessions } : {}) }),
  ];

  return [
    registerApiRoute(FACTORY_ROUTE_CONTRACTS.attentionList.path, {
      method: FACTORY_ROUTE_CONTRACTS.attentionList.method,
      requiresAuth: false,
      handler: async context => {
        const resolved = await dependencies.resolveProject(context);
        if ('response' in resolved) return resolved.response;
        const query = FACTORY_ROUTE_CONTRACTS.attentionList.querySchema.safeParse({
          view: context.req.query('view'),
          kind: context.req.queries('kind'),
          before: context.req.query('before'),
          limit: context.req.query('limit'),
          search: context.req.query('search'),
        });
        if (!query.success) {
          const field = query.error.issues[0]?.path[0];
          return context.json(
            {
              error:
                field === 'kind'
                  ? 'invalid_attention_kind'
                  : field === 'before'
                    ? 'invalid_cursor'
                    : 'invalid_attention_view',
            },
            400,
          );
        }
        const { view, before, search, limit } = query.data;
        const kinds = query.data.kind ?? providers.map(provider => provider.kind);
        await workItems.ensureReady();
        await comments.ensureReady();

        const active = providers.filter(
          provider => kinds.includes(provider.kind) && (!before || before.has(provider.kind)),
        );

        const [summaries, pages] = await Promise.all([
          Promise.all(
            providers.map(async provider => ({
              kind: provider.kind,
              counts: await provider.counts(resolved),
              latest: await provider.latest(resolved),
            })),
          ),
          Promise.all(
            active.map(async provider => ({
              kind: provider.kind,
              incoming: before?.get(provider.kind),
              result: await provider.page(resolved, {
                view,
                ...(search ? { search } : {}),
                before: before?.get(provider.kind),
                limit,
              }),
            })),
          ),
        ]);

        const merged = mergeAttentionPages(pages, limit);

        return context.json({
          items: merged.items,
          kinds: Object.fromEntries(
            summaries.map(summary => [
              summary.kind,
              {
                ...summary.counts,
                latest: summary.latest ? { ...summary.latest, at: summary.latest.at.toISOString() } : null,
              },
            ]),
          ),
          hasMore: merged.hasMore,
          ...(merged.nextCursor ? { nextCursor: merged.nextCursor } : {}),
        });
      },
    }),
    registerApiRoute(FACTORY_ROUTE_CONTRACTS.attentionReadAll.path, {
      method: FACTORY_ROUTE_CONTRACTS.attentionReadAll.method,
      requiresAuth: false,
      handler: async context => {
        const resolved = await dependencies.resolveProject(context);
        if ('response' in resolved) return resolved.response;
        const query = FACTORY_ROUTE_CONTRACTS.attentionReadAll.querySchema.safeParse({
          before: context.req.query('before'),
        });
        if (!query.success) return context.json({ error: 'invalid_cursor' }, 400);
        const { before } = query.data;
        await workItems.ensureReady();
        await comments.ensureReady();

        const now = new Date();
        const active = providers.filter(provider => !before || before.has(provider.kind));
        const nextCursors: AttentionCursorMap = new Map();
        let hasMore = false;
        for (const provider of active) {
          const result = await provider.markAllRead(resolved, { before: before?.get(provider.kind), now });
          if (result.hasMore) {
            hasMore = true;
            if (result.continuation) nextCursors.set(provider.kind, result.continuation);
          }
        }
        return context.json({
          ok: true,
          hasMore,
          ...(hasMore && nextCursors.size > 0 ? { nextCursor: encodeAttentionCursor(nextCursors) } : {}),
        });
      },
    }),
    receiptRoute(dependencies, 'read', 'read'),
    receiptRoute(dependencies, 'archive', 'archive'),
    receiptRoute(dependencies, 'restore', 'restore'),
  ];
}
