/**
 * Attention routes: k-way merge of the per-kind providers on `occurredAt desc`.
 * The wire cursor is a per-kind map — each kind's stream resumes independently,
 * `null` meaning "not started yet", an absent kind meaning "exhausted".
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';

import type { WorkItemCommentsStorage } from '../storage/domains/comments/base.js';
import type {
  FactoryAttentionKind,
  FactoryAttentionReceiptAction,
  WorkItemsStorage,
} from '../storage/domains/work-items/base.js';
import { factoryAttentionKey } from '../storage/domains/work-items/base.js';
import { ActivityAttentionProvider } from './attention-activity.js';
import type {
  AttentionLatest,
  AttentionPageResult,
  AttentionProvider,
  AttentionScope,
  AttentionStreamPosition,
  FactoryAttentionView,
} from './attention-providers.js';
import { AutomationFailedAttentionProvider, MentionAttentionProvider } from './attention-providers.js';

export { factoryDecisionType } from './attention-providers.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;

interface AttentionRouteDependencies {
  workItems: WorkItemsStorage;
  comments: WorkItemCommentsStorage;
  resolveProject(context: unknown): Promise<AttentionScope | { response: Response }>;
}

type AttentionCursorMap = Map<FactoryAttentionKind, AttentionStreamPosition | undefined>;

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

function isAttentionKind(value: string): value is FactoryAttentionKind {
  return value === 'automation-failed' || value === 'mention' || value === 'activity';
}

/** Kinds the sidebar badge and the notification sound answer to. */
const BADGE_KINDS: ReadonlySet<FactoryAttentionKind> = new Set(['automation-failed', 'mention']);

type AttentionTier = 'all' | 'badge' | 'activity';

function parseAttentionTier(raw: string | undefined): AttentionTier | undefined {
  if (raw === undefined) return 'all';
  return raw === 'badge' || raw === 'activity' ? raw : undefined;
}

function kindInTier(tier: AttentionTier, kind: FactoryAttentionKind): boolean {
  if (tier === 'all') return true;
  return tier === 'badge' ? BADGE_KINDS.has(kind) : !BADGE_KINDS.has(kind);
}

function encodeAttentionCursor(cursors: AttentionCursorMap): string {
  const wire: Record<string, [string, string] | null> = {};
  for (const [kind, position] of cursors) {
    wire[kind] = position ? [position.occurredAt.toISOString(), position.id] : null;
  }
  return Buffer.from(JSON.stringify(wire), 'utf8').toString('base64url');
}

function parseStreamPosition(value: unknown): AttentionStreamPosition | undefined {
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string' || typeof value[1] !== 'string') {
    return undefined;
  }
  const occurredAt = new Date(value[0]);
  if (Number.isNaN(occurredAt.getTime()) || !UUID_RE.test(value[1])) return undefined;
  return { occurredAt, id: value[1] };
}

function parseAttentionCursor(raw: string | undefined): AttentionCursorMap | undefined {
  if (!raw) return undefined;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    // Cursors minted before the inbox merged kinds are a bare position over the
    // only stream there was. Held by anyone mid-list when this deploys, so they
    // resume that stream rather than 400: mentions arrive on their next load.
    if (Array.isArray(decoded)) {
      const legacy = parseStreamPosition(decoded);
      return legacy ? new Map([['automation-failed', legacy]]) : undefined;
    }
    if (!decoded || typeof decoded !== 'object') return undefined;
    const cursors: AttentionCursorMap = new Map();
    for (const [kind, value] of Object.entries(decoded)) {
      if (!isAttentionKind(kind)) return undefined;
      if (value === null) {
        cursors.set(kind, undefined);
        continue;
      }
      const position = parseStreamPosition(value);
      if (!position) return undefined;
      cursors.set(kind, position);
    }
    return cursors.size > 0 ? cursors : undefined;
  } catch {
    return undefined;
  }
}

function parseOccurrence(raw: string | undefined): number | undefined {
  if (!raw || !/^(0|[1-9]\d*)$/.test(raw)) return undefined;
  const occurrence = Number(raw);
  return Number.isSafeInteger(occurrence) ? occurrence : undefined;
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

function newestLatest(latests: Array<AttentionLatest | null>): AttentionLatest | null {
  let newest: AttentionLatest | null = null;
  for (const latest of latests) {
    if (!latest) continue;
    if (!newest || latest.at.getTime() > newest.at.getTime()) newest = latest;
  }
  return newest;
}

function receiptRoute(
  dependencies: AttentionRouteDependencies,
  verb: 'read' | 'archive' | 'restore',
  action: FactoryAttentionReceiptAction,
): ApiRoute {
  return registerApiRoute(`/web/factory/projects/:id/attention/:kind/:sourceId/:occurrence/${verb}`, {
    method: 'POST',
    requiresAuth: false,
    handler: async context => {
      const resolved = await dependencies.resolveProject(context);
      if ('response' in resolved) return resolved.response;
      const kind = context.req.param('kind');
      const sourceId = context.req.param('sourceId');
      const occurrence = parseOccurrence(context.req.param('occurrence'));
      if (!kind || !isAttentionKind(kind) || !sourceId || !UUID_RE.test(sourceId) || occurrence === undefined) {
        return context.json({ error: 'invalid_attention_item' }, 422);
      }
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
  const { workItems, comments } = dependencies;
  const providers: AttentionProvider[] = [
    new AutomationFailedAttentionProvider({ workItems }),
    new MentionAttentionProvider({ workItems, comments }),
    new ActivityAttentionProvider({ workItems, comments }),
  ];

  return [
    registerApiRoute('/web/factory/projects/:id/attention', {
      method: 'GET',
      requiresAuth: false,
      handler: async context => {
        const resolved = await dependencies.resolveProject(context);
        if ('response' in resolved) return resolved.response;
        const view = parseAttentionView(context.req.query('view'));
        if (view === undefined) return context.json({ error: 'invalid_attention_view' }, 400);
        // `tier` scopes the item list only; the counts always describe every
        // tier, so the badge popover can page badge kinds without losing the
        // activity numbers.
        const tier = parseAttentionTier(context.req.query('tier'));
        if (tier === undefined) return context.json({ error: 'invalid_attention_tier' }, 400);
        const cursorRaw = context.req.query('before');
        const before = parseAttentionCursor(cursorRaw);
        if (cursorRaw && !before) return context.json({ error: 'invalid_cursor' }, 400);
        await workItems.ensureReady();
        await comments.ensureReady();

        const search = context.req.query('search')?.trim().toLowerCase().slice(0, 200);
        const limit = parseAttentionLimit(context.req.query('limit'));
        const active = providers.filter(
          provider => kindInTier(tier, provider.kind) && (!before || before.has(provider.kind)),
        );

        const [approvalCount, summaries, pages] = await Promise.all([
          workItems.countDeferredDecisionsByStatuses({
            orgId: resolved.orgId,
            factoryProjectId: resolved.factoryProjectId,
            statuses: ['proposed'],
          }),
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

        // The badge tier and the activity tier are counted apart: activity
        // leaking into `latests` would ring the notification sound on every
        // teammate comment.
        const badge = summaries.filter(summary => BADGE_KINDS.has(summary.kind));
        const activity = summaries.filter(summary => !BADGE_KINDS.has(summary.kind));
        const sum = (rows: typeof summaries, field: 'open' | 'unread') =>
          rows.reduce((total, row) => total + row.counts[field], 0);
        const openCount = sum(badge, 'open') + approvalCount;
        const unreadCount = sum(badge, 'unread');
        // An unread item must never be masked by a newer already-read one of
        // another kind — the streams are independent.
        const latests = badge.map(summary => summary.latest);
        const unreadLatests = latests.filter(latest => latest?.unread ?? false);
        const latest = unreadLatests.length > 0 ? newestLatest(unreadLatests) : newestLatest(latests);
        const merged = mergeAttentionPages(pages, limit);

        return context.json({
          items: merged.items,
          openCount,
          approvalCount,
          badgeCount: unreadCount + approvalCount,
          unreadCount,
          activityUnreadCount: sum(activity, 'unread'),
          latestOccurrenceKey: latest?.key ?? null,
          latestOccurrenceAt: latest?.at.toISOString() ?? null,
          latestOccurrenceUnread: latest?.unread ?? false,
          hasMore: merged.hasMore,
          ...(merged.nextCursor ? { nextCursor: merged.nextCursor } : {}),
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
        const before = parseAttentionCursor(cursorRaw);
        if (cursorRaw && !before) return context.json({ error: 'invalid_cursor' }, 400);
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
