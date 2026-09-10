/** Sessions parked on a tool, read live from the registry: the item exists exactly as long as an answer is owed. */

import type { LiveSessions } from '../session/live-sessions.js';
import type {
  FactoryAttentionIdentity,
  FactoryAttentionReceiptRecord,
  WorkItemRow,
  WorkItemsStorage,
} from '../storage/domains/work-items/base.js';
import { factoryAgentWaitingAttentionIdentity, factoryAttentionKey } from '../storage/domains/work-items/base.js';
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
import { matchesView, receiptScope } from './attention-providers.js';

interface ParkedSession {
  item: WorkItemRow | undefined;
  role: string;
  sessionId: string;
  threadId: string;
  toolName: string;
  occurredAt: Date;
  identity: FactoryAttentionIdentity;
  list?: 'user';
}

interface ReceiptedParkedSession {
  entry: ParkedSession;
  receipt: FactoryAttentionReceiptRecord | undefined;
}

function parkedRunLabel(toolName: string): string {
  return toolName === 'submit_plan' ? 'Plan waiting for review' : 'Agent is waiting for an answer';
}

function olderThan(entry: ParkedSession, before: AttentionStreamPosition | undefined): boolean {
  if (!before) return true;
  const gap = entry.occurredAt.getTime() - before.occurredAt.getTime();
  return gap < 0 || (gap === 0 && entry.sessionId.localeCompare(before.id) > 0);
}

function toItem(scope: AttentionScope, { entry, receipt }: ReceiptedParkedSession): Record<string, unknown> {
  const title = entry.item?.title ?? parkedRunLabel(entry.toolName);
  return {
    key: factoryAttentionKey(scope.factoryProjectId, entry.identity),
    kind: 'agent-waiting' as const,
    sessionId: entry.sessionId,
    threadId: entry.threadId,
    role: entry.role,
    toolName: entry.toolName,
    occurrence: entry.identity.occurrence,
    workItemId: entry.item?.id ?? null,
    title,
    detail: parkedRunLabel(entry.toolName),
    occurredAt: entry.occurredAt.toISOString(),
    read: receipt !== undefined,
    archived: receipt?.state === 'archived',
    target: {
      kind: 'thread' as const,
      sessionId: entry.sessionId,
      threadId: entry.threadId,
      ...(entry.list ? { list: entry.list } : {}),
    },
  };
}

export class ParkedRunAttentionProvider implements AttentionProvider {
  readonly kind = 'agent-waiting' as const;
  readonly #workItems: WorkItemsStorage;
  readonly #liveSessions: Pick<LiveSessions, 'parkedIn'>;

  constructor({
    workItems,
    liveSessions,
  }: {
    workItems: WorkItemsStorage;
    liveSessions: Pick<LiveSessions, 'parkedIn'>;
  }) {
    this.#workItems = workItems;
    this.#liveSessions = liveSessions;
  }

  /** Newest park first. A session bound to several cards is listed once, under the first card. Parks with no card (user sessions) still list, aimed at their own thread. */
  async #parked(scope: AttentionScope): Promise<ParkedSession[]> {
    const runBySession = new Map(
      this.#liveSessions.parkedIn(scope.factoryProjectId).map(({ sessionId, run }) => [sessionId, run]),
    );
    if (runBySession.size === 0) return [];
    const items = await this.#workItems.list({ orgId: scope.orgId, factoryProjectId: scope.factoryProjectId });
    const bySession = new Map<string, ParkedSession>();
    for (const item of items) {
      for (const [role, ref] of Object.entries(item.sessions)) {
        const run = runBySession.get(ref.sessionId);
        if (!run || bySession.has(ref.sessionId)) continue;
        bySession.set(ref.sessionId, {
          item,
          role,
          sessionId: ref.sessionId,
          threadId: ref.threadId,
          toolName: run.toolName,
          occurredAt: new Date(run.suspendedAt),
          identity: factoryAgentWaitingAttentionIdentity(ref.sessionId, run.suspendedAt),
        });
      }
    }
    for (const [sessionId, run] of runBySession) {
      if (bySession.has(sessionId)) continue;
      bySession.set(sessionId, {
        item: undefined,
        role: 'user',
        sessionId,
        threadId: sessionId,
        toolName: run.toolName,
        occurredAt: new Date(run.suspendedAt),
        identity: factoryAgentWaitingAttentionIdentity(sessionId, run.suspendedAt),
        list: 'user',
      });
    }
    return [...bySession.values()].sort(
      (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || a.sessionId.localeCompare(b.sessionId),
    );
  }

  async #withReceipts(scope: AttentionScope, parked: ParkedSession[]): Promise<ReceiptedParkedSession[]> {
    const receipts = await this.#workItems.listAttentionReceipts({
      ...receiptScope(scope),
      identities: parked.map(entry => entry.identity),
    });
    const byKey = new Map(receipts.map(receipt => [factoryAttentionKey(scope.factoryProjectId, receipt), receipt]));
    return parked.map(entry => ({
      entry,
      receipt: byKey.get(factoryAttentionKey(scope.factoryProjectId, entry.identity)),
    }));
  }

  async counts(scope: AttentionScope): Promise<AttentionCounts> {
    let open = 0;
    let unread = 0;
    for (const { receipt } of await this.#withReceipts(scope, await this.#parked(scope))) {
      if (receipt?.state !== 'archived') open += 1;
      if (receipt === undefined) unread += 1;
    }
    return { open, unread };
  }

  async latest(scope: AttentionScope): Promise<AttentionLatest | null> {
    const [newest] = await this.#withReceipts(scope, (await this.#parked(scope)).slice(0, 1));
    if (!newest) return null;
    return {
      key: factoryAttentionKey(scope.factoryProjectId, newest.entry.identity),
      at: newest.entry.occurredAt,
      unread: newest.receipt === undefined,
    };
  }

  async page(scope: AttentionScope, { view, search, before, limit }: AttentionPageArgs): Promise<AttentionPageResult> {
    const parked = (await this.#parked(scope)).filter(entry => olderThan(entry, before));
    const entries: AttentionEntry[] = [];
    for (const receipted of await this.#withReceipts(scope, parked)) {
      const { entry, receipt } = receipted;
      if (!matchesView(view, receipt)) continue;
      if (search && !`${entry.item?.title ?? ''} ${parkedRunLabel(entry.toolName)}`.toLowerCase().includes(search)) {
        continue;
      }
      if (entries.length === limit) return { entries, hasMore: true };
      entries.push({
        occurredAt: entry.occurredAt,
        resumeCursor: { occurredAt: entry.occurredAt, id: entry.sessionId },
        item: toItem(scope, receipted),
      });
    }
    return { entries, hasMore: false };
  }

  async markAllRead(
    scope: AttentionScope,
    { before, now }: { before?: AttentionStreamPosition; now: Date },
  ): Promise<{ hasMore: boolean }> {
    const parked = (await this.#parked(scope)).filter(entry => olderThan(entry, before));
    if (parked.length > 0) {
      await this.#workItems.markAttentionReceiptsRead({
        ...receiptScope(scope),
        identities: parked.map(entry => entry.identity),
        now,
      });
    }
    return { hasMore: false };
  }
}
