import type { StorageThreadType } from '@mastra/core/memory';
import { SignalProvider } from '@mastra/core/signals';
import type { SignalSubscription } from '@mastra/core/signals';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { SlackUserAuthOptions } from '../user-auth';
import { SlackUserAuth } from '../user-auth';
import type { SlackConversationMessage, SlackSignalsClient } from './slack-client';
import { compareSlackTs, FetchSlackSignalsClient } from './slack-client';

/** Thread metadata key where Slack subscriptions (and their cursors) persist. */
export const SLACK_SIGNALS_METADATA_KEY = 'slackSignals';

export const SLACK_SIGNALS_SOURCE = 'slack';

const DEFAULT_POLL_INTERVAL_MS = 30_000;
const EXCERPT_LENGTH = 240;
const MAX_MESSAGES_PER_NOTIFICATION = 10;

/**
 * A persisted Slack subscription record, stored on the Mastra thread's
 * metadata so cursors survive restarts (no duplicate signals).
 */
export type SlackThreadSubscriptionRecord = {
  /** e.g. `slack:C0123456789:1725000000.000100` (channel-only when watching top-level messages). */
  externalResourceId: string;
  channelId: string;
  /** Present when watching a specific thread; absent for a channel watch. */
  threadTs?: string;
  /** Last-seen Slack ts cursor — only messages after this fire signals. */
  lastSeenTs: string;
  subscribedAt: string;
};

export type SlackSignalsThreadMetadata = {
  subscriptions: SlackThreadSubscriptionRecord[];
};

export type SlackSignalsThreadStore = {
  getThreadById(input: { threadId: string; resourceId?: string }): Promise<StorageThreadType | null>;
  saveThread(input: { thread: StorageThreadType }): Promise<StorageThreadType>;
};

export type SlackSignalsOptions = {
  /** An existing SlackUserAuth instance, or options to construct one. */
  auth?: SlackUserAuth | SlackUserAuthOptions;
  /** Static user token escape hatch — shorthand for `auth: { token }`. */
  token?: string;
  /** OAuth client_id for the connect flow — shorthand for `auth: { clientId }`. */
  clientId?: string;
  /** Poll interval in ms. Default 30s. */
  pollIntervalMs?: number;
  /** Injectable Slack API client (tests / custom transports). */
  client?: SlackSignalsClient;
  /** Explicit thread store; defaults to the Mastra memory store when registered. */
  threadStore?: SlackSignalsThreadStore;
  /** Stream options applied when a notification wakes an idle thread. */
  getNotificationStreamOptions?: (target: {
    resourceId: string;
    threadId: string;
  }) => Record<string, unknown> | undefined | Promise<Record<string, unknown> | undefined>;
};

export type SlackSubscribeInput = {
  threadId: string;
  resourceId: string;
  channelId: string;
  threadTs?: string;
};

/** Build the externalResourceId for a Slack channel/thread subscription. */
export function slackExternalResourceId(channelId: string, threadTs?: string): string {
  return threadTs ? `slack:${channelId}:${threadTs}` : `slack:${channelId}`;
}

export function getSlackSignalsMetadata(metadata: Record<string, unknown> | undefined): SlackSignalsThreadMetadata {
  const raw = metadata?.[SLACK_SIGNALS_METADATA_KEY] as Partial<SlackSignalsThreadMetadata> | undefined;
  return { subscriptions: Array.isArray(raw?.subscriptions) ? raw.subscriptions : [] };
}

export function setSlackSignalsMetadata(
  metadata: Record<string, unknown> | undefined,
  value: SlackSignalsThreadMetadata,
): Record<string, unknown> {
  return { ...(metadata ?? {}), [SLACK_SIGNALS_METADATA_KEY]: value };
}

/** Current time as a Slack ts string — the baseline cursor at subscribe time. */
function nowSlackTs(): string {
  return (Date.now() / 1000).toFixed(6);
}

function excerpt(text: string | undefined, length = EXCERPT_LENGTH): string | undefined {
  if (!text) return undefined;
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (!collapsed) return undefined;
  return collapsed.length > length ? `${collapsed.slice(0, length - 1)}…` : collapsed;
}

type SlackToolExecuteContext = {
  agent?: {
    threadId?: string;
    resourceId?: string;
  };
};

type SlackToolFactory = (definition: {
  id: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  execute: (input: any, context?: SlackToolExecuteContext) => Promise<unknown>;
}) => unknown;

const createSlackTool = createTool as unknown as SlackToolFactory;

/**
 * Polling signal provider that watches Slack conversations **as the user**
 * and wakes agent threads when new messages arrive.
 *
 * - Identity: a Slack **user token** (via {@link SlackUserAuth}) — watches
 *   anything the user can see (threads, channels, DMs), no bot invite needed.
 * - Delivery: polling only. No webhooks, tunnels, or public endpoints.
 * - Persistence: subscriptions + last-seen `ts` cursors live on the Mastra
 *   thread's metadata, so restarts never re-signal old messages.
 *
 * Distinct from `SlackProvider` (channels): that is a bot-identity channel
 * backend (webhook wake + broadcast, needs a public endpoint). SlackSignals
 * is "watch this Slack conversation and wake me" with zero infrastructure.
 *
 * ```ts
 * const agent = new Agent({
 *   signals: [new SlackSignals()],
 * });
 * ```
 *
 * @experimental Agent signals are experimental and may change in a future release.
 */
export class SlackSignals extends SignalProvider<'slack-signals'> {
  readonly id = 'slack-signals' as const;
  readonly name = 'Slack Signals';
  readonly pollInterval: number;

  readonly #auth: SlackUserAuth;
  readonly #client: SlackSignalsClient;
  readonly #options: SlackSignalsOptions;

  constructor(options: SlackSignalsOptions = {}) {
    super();
    this.#options = options;
    this.pollInterval = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.#auth =
      options.auth instanceof SlackUserAuth
        ? options.auth
        : new SlackUserAuth({
            ...(options.auth ?? {}),
            ...(options.token ? { token: options.token } : {}),
            ...(options.clientId ? { clientId: options.clientId } : {}),
          });
    this.#client = options.client ?? new FetchSlackSignalsClient();
  }

  /** The auth helper — hosts use this for connect flows and status commands. */
  get auth(): SlackUserAuth {
    return this.#auth;
  }

  // ── Subscriptions ───────────────────────────────────────────────────

  /**
   * Subscribe an agent thread to a Slack conversation. New messages after the
   * subscribe time fire notification signals on the thread.
   */
  async subscribeToSlackThread(input: SlackSubscribeInput): Promise<SlackThreadSubscriptionRecord> {
    const target = { threadId: input.threadId, resourceId: input.resourceId };
    const externalResourceId = slackExternalResourceId(input.channelId, input.threadTs);

    const loaded = await this.#loadThread(target);
    const persisted = loaded
      ? getSlackSignalsMetadata(loaded.thread.metadata).subscriptions.find(
          record => record.externalResourceId === externalResourceId,
        )
      : undefined;

    const record: SlackThreadSubscriptionRecord = persisted ?? {
      externalResourceId,
      channelId: input.channelId,
      ...(input.threadTs ? { threadTs: input.threadTs } : {}),
      lastSeenTs: nowSlackTs(),
      subscribedAt: new Date().toISOString(),
    };

    this.subscribe(target, externalResourceId, { ...record });
    if (!persisted) {
      await this.#persistRecord(target, record);
    }
    return record;
  }

  /** Unsubscribe an agent thread from a Slack conversation. */
  async unsubscribeFromSlackThread(input: SlackSubscribeInput): Promise<boolean> {
    const target = { threadId: input.threadId, resourceId: input.resourceId };
    const externalResourceId = slackExternalResourceId(input.channelId, input.threadTs);
    const removed = this.unsubscribe(target, externalResourceId);

    const loaded = await this.#loadThread(target);
    if (loaded) {
      const metadata = getSlackSignalsMetadata(loaded.thread.metadata);
      const remaining = metadata.subscriptions.filter(record => record.externalResourceId !== externalResourceId);
      if (remaining.length !== metadata.subscriptions.length) {
        await this.#saveThreadMetadata(loaded, target, { subscriptions: remaining });
        return true;
      }
    }
    return removed;
  }

  /** List active Slack subscriptions for an agent thread. */
  listSlackSubscriptions(target: { threadId: string; resourceId: string }): SlackThreadSubscriptionRecord[] {
    return this.getSubscriptionsForThread(target).map(sub => sub.metadata as SlackThreadSubscriptionRecord);
  }

  /**
   * Re-register persisted subscriptions for a thread into the in-memory
   * registry (e.g. after a restart, when the host resumes a thread).
   */
  async restoreSubscriptionsForThread(target: { threadId: string; resourceId: string }): Promise<number> {
    const loaded = await this.#loadThread(target);
    if (!loaded) return 0;
    const metadata = getSlackSignalsMetadata(loaded.thread.metadata);
    for (const record of metadata.subscriptions) {
      this.subscribe(target, record.externalResourceId, { ...record });
    }
    return metadata.subscriptions.length;
  }

  // ── Polling ─────────────────────────────────────────────────────────

  /** Run one poll cycle over all active subscriptions immediately. */
  async pollNow(): Promise<void> {
    await this.poll(this.getSubscriptions());
  }

  async poll(subscriptions: SignalSubscription[]): Promise<void> {
    const token = await this.#auth.getToken();
    const selfUserId = await this.#auth.getUserId();
    for (const subscription of subscriptions) {
      try {
        await this.#pollSubscription({ subscription, token, selfUserId });
      } catch (error) {
        console.warn(`[${this.id}] poll failed for ${subscription.externalResourceId}:`, error);
      }
    }
  }

  async #pollSubscription(input: {
    subscription: SignalSubscription;
    token: string;
    selfUserId?: string;
  }): Promise<void> {
    const { subscription, token, selfUserId } = input;
    const target = { threadId: subscription.threadId, resourceId: subscription.resourceId };
    const record = await this.#resolveRecord(target, subscription);
    if (!record) return;

    const messages = await this.#client.fetchNewMessages({
      token,
      channelId: record.channelId,
      threadTs: record.threadTs,
      oldest: record.lastSeenTs,
    });
    if (messages.length === 0) return;

    const latestTs = messages[messages.length - 1]!.ts;
    const fresh = messages.filter(message => !selfUserId || message.user !== selfUserId);

    // Advance the cursor past everything we saw (including our own messages)
    // before signaling, so a crash mid-notify can't replay old messages.
    const updated: SlackThreadSubscriptionRecord = { ...record, lastSeenTs: latestTs };
    subscription.metadata = { ...subscription.metadata, ...updated };
    await this.#persistRecord(target, updated);

    if (fresh.length === 0) return;
    await this.#sendSlackNotification({ target, record: updated, messages: fresh });
  }

  async #sendSlackNotification(input: {
    target: { threadId: string; resourceId: string };
    record: SlackThreadSubscriptionRecord;
    messages: SlackConversationMessage[];
  }): Promise<void> {
    const { target, record, messages } = input;
    const latest = messages[messages.length - 1]!;
    const latestExcerpt = excerpt(latest.text);
    const location = record.threadTs
      ? `Slack thread ${record.channelId}/${record.threadTs}`
      : `Slack channel ${record.channelId}`;
    const summary =
      `${messages.length} new message${messages.length === 1 ? '' : 's'} in ${location}` +
      (latest.user ? ` — latest from <@${latest.user}>` : '') +
      (latestExcerpt ? `: ${latestExcerpt}` : '');

    const streamOptions = await this.#options.getNotificationStreamOptions?.(target);
    const ifIdle = streamOptions ? { streamOptions: streamOptions as never } : undefined;

    await this.notify(
      {
        source: SLACK_SIGNALS_SOURCE,
        kind: record.threadTs ? 'thread-activity' : 'channel-activity',
        priority: 'medium',
        summary,
        dedupeKey: `${record.externalResourceId}:${latest.ts}`,
        coalesceKey: record.externalResourceId,
        attributes: {
          channelId: record.channelId,
          ...(record.threadTs ? { threadTs: record.threadTs } : {}),
          messageCount: messages.length,
          latestTs: latest.ts,
          ...(latest.user ? { latestAuthor: latest.user } : {}),
          ...(latestExcerpt ? { latestExcerpt } : {}),
        },
        metadata: {
          slack: {
            channelId: record.channelId,
            threadTs: record.threadTs,
            messages: messages.slice(-MAX_MESSAGES_PER_NOTIFICATION).map(message => ({
              ts: message.ts,
              user: message.user,
              botId: message.botId,
              text: excerpt(message.text, 500),
            })),
          },
        },
      },
      { ...target, ...(ifIdle ? { ifIdle } : {}) },
    );
  }

  // ── Persistence ─────────────────────────────────────────────────────

  /**
   * Resolve the current record for a subscription, preferring the persisted
   * thread-metadata copy (its cursor survives restarts and other writers).
   */
  async #resolveRecord(
    target: { threadId: string; resourceId: string },
    subscription: SignalSubscription,
  ): Promise<SlackThreadSubscriptionRecord | undefined> {
    const loaded = await this.#loadThread(target);
    if (loaded) {
      const persisted = getSlackSignalsMetadata(loaded.thread.metadata).subscriptions.find(
        record => record.externalResourceId === subscription.externalResourceId,
      );
      if (persisted) {
        const inMemory = subscription.metadata as Partial<SlackThreadSubscriptionRecord>;
        // Use whichever cursor is further ahead.
        const lastSeenTs =
          inMemory.lastSeenTs && compareSlackTs(inMemory.lastSeenTs, persisted.lastSeenTs) > 0
            ? inMemory.lastSeenTs
            : persisted.lastSeenTs;
        return { ...persisted, lastSeenTs };
      }
    }
    const inMemory = subscription.metadata as Partial<SlackThreadSubscriptionRecord>;
    if (!inMemory.channelId || !inMemory.lastSeenTs) return undefined;
    return {
      externalResourceId: subscription.externalResourceId,
      channelId: inMemory.channelId,
      ...(inMemory.threadTs ? { threadTs: inMemory.threadTs } : {}),
      lastSeenTs: inMemory.lastSeenTs,
      subscribedAt: inMemory.subscribedAt ?? new Date().toISOString(),
    };
  }

  async #persistRecord(
    target: { threadId: string; resourceId: string },
    record: SlackThreadSubscriptionRecord,
  ): Promise<void> {
    const loaded = await this.#loadThread(target);
    if (!loaded) return; // no store — cursors are in-memory only
    const metadata = getSlackSignalsMetadata(loaded.thread.metadata);
    const subscriptions = metadata.subscriptions.some(
      existing => existing.externalResourceId === record.externalResourceId,
    )
      ? metadata.subscriptions.map(existing =>
          existing.externalResourceId === record.externalResourceId ? record : existing,
        )
      : [...metadata.subscriptions, record];
    await this.#saveThreadMetadata(loaded, target, { subscriptions });
  }

  async #loadThread(target: {
    threadId: string;
    resourceId: string;
  }): Promise<{ threadStore: SlackSignalsThreadStore; thread: StorageThreadType } | undefined> {
    const threadStore = await this.#resolveThreadStore();
    if (!threadStore) return undefined;
    const thread = await threadStore.getThreadById({ threadId: target.threadId, resourceId: target.resourceId });
    return {
      threadStore,
      thread:
        thread ??
        ({
          id: target.threadId,
          resourceId: target.resourceId,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        } as StorageThreadType),
    };
  }

  async #saveThreadMetadata(
    loaded: { threadStore: SlackSignalsThreadStore; thread: StorageThreadType },
    target: { threadId: string; resourceId: string },
    value: SlackSignalsThreadMetadata,
  ): Promise<void> {
    await loaded.threadStore.saveThread({
      thread: {
        ...loaded.thread,
        id: target.threadId,
        resourceId: target.resourceId,
        createdAt: loaded.thread.createdAt ?? new Date(),
        updatedAt: new Date(),
        metadata: setSlackSignalsMetadata(loaded.thread.metadata, value),
      },
    });
  }

  async #resolveThreadStore(): Promise<SlackSignalsThreadStore | undefined> {
    if (this.#options.threadStore) return this.#options.threadStore;
    const storage = (
      this.mastra as { getStorage?: () => { getStore?: (name: 'memory') => Promise<unknown> } | undefined } | undefined
    )?.getStorage?.();
    const memoryStore = storage?.getStore ? await storage.getStore('memory') : undefined;
    return memoryStore as SlackSignalsThreadStore | undefined;
  }

  // ── Tools ───────────────────────────────────────────────────────────

  getTools(): Record<string, unknown> {
    const resolveTarget = (context?: SlackToolExecuteContext) => {
      const threadId = context?.agent?.threadId;
      const resourceId = context?.agent?.resourceId;
      if (!threadId || !resourceId) return undefined;
      return { threadId, resourceId };
    };

    return {
      slack_subscribe_thread: createSlackTool({
        id: 'slack_subscribe_thread',
        description:
          'Subscribe this agent thread to a Slack conversation. New messages (after now) will wake this thread as notification signals. Provide the Slack channel id (e.g. C0123456789) and optionally a thread ts (e.g. 1725000000.000100) to watch a specific thread instead of the whole channel.',
        inputSchema: z.object({
          channelId: z.string().describe('Slack channel id, e.g. C0123456789'),
          threadTs: z
            .string()
            .optional()
            .describe('Slack thread timestamp to watch a specific thread, e.g. 1725000000.000100'),
        }),
        execute: async (input: { channelId: string; threadTs?: string }, context?: SlackToolExecuteContext) => {
          const target = resolveTarget(context);
          if (!target) return { ok: false, message: 'No agent thread context available.' };
          const record = await this.subscribeToSlackThread({ ...target, ...input });
          return {
            ok: true,
            subscribed: record.externalResourceId,
            message: `Subscribed to ${record.externalResourceId}. New Slack messages will wake this thread (polled every ${Math.round(this.pollInterval / 1000)}s).`,
          };
        },
      }),
      slack_unsubscribe_thread: createSlackTool({
        id: 'slack_unsubscribe_thread',
        description: 'Unsubscribe this agent thread from a previously subscribed Slack conversation.',
        inputSchema: z.object({
          channelId: z.string().describe('Slack channel id, e.g. C0123456789'),
          threadTs: z.string().optional().describe('Slack thread timestamp, when the subscription targets a thread'),
        }),
        execute: async (input: { channelId: string; threadTs?: string }, context?: SlackToolExecuteContext) => {
          const target = resolveTarget(context);
          if (!target) return { ok: false, message: 'No agent thread context available.' };
          const removed = await this.unsubscribeFromSlackThread({ ...target, ...input });
          const externalResourceId = slackExternalResourceId(input.channelId, input.threadTs);
          return {
            ok: true,
            removed,
            message: removed
              ? `Unsubscribed from ${externalResourceId}.`
              : `No subscription found for ${externalResourceId}.`,
          };
        },
      }),
      slack_list_subscriptions: createSlackTool({
        id: 'slack_list_subscriptions',
        description: 'List the Slack conversations this agent thread is subscribed to.',
        inputSchema: z.object({}),
        execute: async (_input: Record<string, never>, context?: SlackToolExecuteContext) => {
          const target = resolveTarget(context);
          if (!target) return { ok: false, message: 'No agent thread context available.' };
          if (this.getSubscriptionsForThread(target).length === 0) {
            await this.restoreSubscriptionsForThread(target).catch(() => 0);
          }
          return { ok: true, subscriptions: this.listSlackSubscriptions(target) };
        },
      }),
    };
  }
}
