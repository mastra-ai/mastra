import type { NotificationPriority, SendNotificationSignalInput } from '@mastra/core/notifications';
import { SignalProvider } from '@mastra/core/signals';
import type { SignalProviderTarget, SignalSubscription } from '@mastra/core/signals';
import type { MCPClient } from '../client/configuration';
import type { MCPEventOccurrence, MCPEventSubscribeOptions, MCPEventSubscription } from '../client/events';
import { InMemoryMCPEventCursorStore } from './events-cursor-store';
import type { MCPEventCursorStore } from './events-cursor-store';
import { createMCPEventsTools } from './events-tools';
import { formatUntrustedEvent, stableArgsHash } from './events-utils';

/**
 * An event type on a server plus the subscription arguments that select its occurrences.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export interface MCPEventTarget {
  server: string;
  event: string;
  args?: Record<string, unknown>;
}

/**
 * Options for {@link MCPEventsSignalProvider}.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export interface MCPEventsSignalProviderOptions {
  /** The client whose servers are subscribed to. Usually an `MCPClient`. */
  client: Pick<MCPClient, 'events'>;
  /** Default `'mcp-events'`. Also used as the notification `source`. */
  id?: string;
  /** Default `'MCP Events'`. */
  name?: string;
  /** Where resume cursors are kept. Default: an {@link InMemoryMCPEventCursorStore}. */
  cursorStore?: MCPEventCursorStore;
  /** Passed to every `events.subscribe()` call, e.g. `maxAgeMs` to bound the replay backlog. */
  subscribeOptions?: Omit<MCPEventSubscribeOptions, 'cursor' | 'signal'>;
  /** Priority of event notifications. Default `'medium'`. */
  priority?: NotificationPriority;
  /**
   * Coalesce pending notifications per subscription key (`coalesceKey: 'mcp-events:<key>'`, regardless of `id`).
   * When on, a burst of occurrences that arrives before the agent reads its inbox keeps only the latest
   * occurrence's summary and payload. Default `false`: every occurrence is its own notification.
   */
  coalesce?: boolean;
  /**
   * Expose `mcp_events_list`, `mcp_events_subscribe` and `mcp_events_unsubscribe` to the agent,
   * optionally limited to the listed servers. Default `false`: letting a model subscribe a thread
   * to server events is opt-in.
   */
  tools?: boolean | { servers: string[] };
  /** Called for failures that do not reach a caller: notification delivery, cursor storage, subscription end. */
  onError?: (error: unknown, info: { server: string; event: string; key: string }) => void;
}

interface LiveSubscription {
  key: string;
  target: MCPEventTarget;
  ready: Promise<void>;
  subscription?: MCPEventSubscription;
  closed: boolean;
}

const GAP_NOTE = 'Some events may have been skipped (gap); re-fetch authoritative state with tools if it matters.';

/**
 * Delivers MCP Events (SEP-3415) occurrences into agent threads as notification signals.
 *
 * Each `(server, event, arguments)` key holds one MCP subscription, shared by every thread
 * subscribed to it. Occurrences are wrapped as untrusted data before the model sees them, and the
 * subscription cursor is persisted after each occurrence so a new provider resumes where this one
 * stopped.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 *
 * @example
 * ```ts
 * const mcpEvents = new MCPEventsSignalProvider({ client: mcp });
 * const agent = new Agent({ ..., signals: [mcpEvents] });
 * await mcpEvents.subscribeThread(
 *   { resourceId: 'user-1', threadId: 'thread-1' },
 *   { server: 'github', event: 'repo.push', args: { repo: 'mastra-ai/mastra' } },
 * );
 * ```
 */
export class MCPEventsSignalProvider extends SignalProvider {
  readonly id: string;
  readonly name: string;

  readonly #options: MCPEventsSignalProviderOptions;
  readonly #cursorStore: MCPEventCursorStore;
  readonly #live = new Map<string, LiveSubscription>();

  constructor(options: MCPEventsSignalProviderOptions) {
    super();
    this.id = options.id ?? 'mcp-events';
    this.name = options.name ?? 'MCP Events';
    this.#options = options;
    this.#cursorStore = options.cursorStore ?? new InMemoryMCPEventCursorStore();
  }

  /** The subscription key, `<server>:<event>:<hash of arguments>`, also used as the cursor store key. */
  static key(target: MCPEventTarget): string {
    return `${target.server}:${target.event}:${stableArgsHash(target.args)}`;
  }

  /**
   * Subscribes a thread to an event. Resolves once the MCP subscription is established, and
   * rejects (without subscribing the thread) when the server refuses it.
   */
  async subscribeThread(thread: SignalProviderTarget, target: MCPEventTarget): Promise<SignalSubscription> {
    const key = MCPEventsSignalProvider.key(target);
    const existed = this.hasSubscription(thread, key);
    const subscription = this.subscribe(thread, key, {
      server: target.server,
      event: target.event,
      arguments: target.args,
      ...(thread.ifIdle ? { ifIdle: thread.ifIdle } : {}),
    });
    try {
      await this.#ensureLive(key, target);
    } catch (error) {
      if (!existed) this.unsubscribe(thread, key);
      throw error;
    }
    return subscription;
  }

  /**
   * Unsubscribes a thread. When it was the last thread on the key, the MCP subscription is
   * cancelled and its stored cursor deleted.
   *
   * @returns `true` if the thread was subscribed.
   */
  async unsubscribeThread(thread: SignalProviderTarget, target: MCPEventTarget): Promise<boolean> {
    const key = MCPEventsSignalProvider.key(target);
    const removed = this.unsubscribe(thread, key);
    if (removed && this.getSubscriptionsForResource(key).length === 0) {
      const live = this.#live.get(key);
      if (live) {
        this.#live.delete(key);
        live.closed = true;
        await live.ready.catch(() => {});
        await live.subscription?.cancel();
      }
      await this.#cursorStore.delete(key);
    }
    return removed;
  }

  getTools() {
    const { tools } = this.#options;
    if (!tools) return {};
    return createMCPEventsTools({
      provider: this,
      client: this.#options.client,
      servers: tools === true ? undefined : tools.servers,
    });
  }

  /** Cancels every MCP subscription. Stored cursors are kept so a new provider resumes from them. */
  stop(): void {
    super.stop();
    for (const live of this.#live.values()) {
      live.closed = true;
      const { subscription } = live;
      if (!subscription) continue;
      void this.#persistCursor(live, subscription);
      subscription.cancel().catch(error => this.#report(error, live));
    }
    this.#live.clear();
  }

  #ensureLive(key: string, target: MCPEventTarget): Promise<void> {
    const existing = this.#live.get(key);
    if (existing) return existing.ready;

    const live: LiveSubscription = { key, target, closed: false, ready: Promise.resolve() };
    live.ready = this.#open(live).catch(error => {
      if (this.#live.get(key) === live) this.#live.delete(key);
      throw error;
    });
    this.#live.set(key, live);
    return live.ready;
  }

  async #open(live: LiveSubscription): Promise<void> {
    const { server, event, args } = live.target;
    const cursor = (await this.#cursorStore.get(live.key)) ?? null;
    const subscription = await this.#options.client.events.subscribe(server, event, args, {
      ...this.#options.subscribeOptions,
      cursor,
    });
    if (live.closed) {
      await subscription.cancel();
      return;
    }
    live.subscription = subscription;
    void this.#run(live, subscription);
  }

  async #run(live: LiveSubscription, subscription: MCPEventSubscription): Promise<void> {
    try {
      for await (const occurrence of subscription) {
        if (live.closed) break;
        await this.#deliver(live, subscription, occurrence);
        await this.#persistCursor(live, subscription);
      }
    } catch (error) {
      if (!live.closed) await this.#ended(live, error);
    } finally {
      if (this.#live.get(live.key) === live) this.#live.delete(live.key);
    }
  }

  async #deliver(live: LiveSubscription, subscription: MCPEventSubscription, occurrence: MCPEventOccurrence) {
    const { server, event, args } = live.target;
    const truncated = subscription.truncated;
    const notification: SendNotificationSignalInput = {
      source: this.id,
      kind: 'mcp-event',
      priority: this.#options.priority ?? 'medium',
      summary: formatUntrustedEvent({
        header: `MCP event ${JSON.stringify(event)} from server ${JSON.stringify(server)}.`,
        data: { eventId: occurrence.eventId, timestamp: occurrence.timestamp, data: occurrence.data },
        footer: truncated ? GAP_NOTE : undefined,
      }),
      attributes: { server, event, ...(truncated ? { truncated: true } : {}) },
      // Absorbs replays after a restart resumed from an older cursor.
      dedupeKey: `${this.id}:${live.key}:${occurrence.eventId}`,
      ...(this.#options.coalesce ? { coalesceKey: `mcp-events:${live.key}` } : {}),
      payload: { server, event, arguments: args, occurrence },
    };
    await this.#notifyAll(live, notification);
  }

  async #ended(live: LiveSubscription, error: unknown): Promise<void> {
    const { server, event } = live.target;
    const message = error instanceof Error ? error.message : String(error);
    const subscriptions = this.getSubscriptionsForResource(live.key);
    await this.#notifyAll(live, {
      source: this.id,
      kind: 'mcp-event-subscription-ended',
      priority: 'high',
      summary: formatUntrustedEvent({
        header: `The subscription to MCP event ${JSON.stringify(event)} from server ${JSON.stringify(server)} ended; no further events will arrive. The server's reason follows.`,
        data: { error: message },
      }),
      attributes: { server, event },
      payload: { server, event, arguments: live.target.args, error: message },
    });
    for (const subscription of subscriptions) {
      this.unsubscribe({ resourceId: subscription.resourceId, threadId: subscription.threadId }, live.key);
    }
    this.#report(error, live);
  }

  async #notifyAll(live: LiveSubscription, notification: SendNotificationSignalInput): Promise<void> {
    for (const subscription of this.getSubscriptionsForResource(live.key)) {
      const ifIdle = subscription.metadata.ifIdle as SignalProviderTarget['ifIdle'];
      try {
        await this.notify(notification, {
          resourceId: subscription.resourceId,
          threadId: subscription.threadId,
          ...(ifIdle ? { ifIdle } : {}),
        });
      } catch (error) {
        this.#report(error, live);
      }
    }
  }

  async #persistCursor(live: LiveSubscription, subscription: MCPEventSubscription): Promise<void> {
    const cursor = subscription.cursor;
    if (typeof cursor !== 'string') return;
    try {
      await this.#cursorStore.set(live.key, cursor);
    } catch (error) {
      this.#report(error, live);
    }
  }

  #report(error: unknown, live: LiveSubscription): void {
    const info = { server: live.target.server, event: live.target.event, key: live.key };
    if (this.#options.onError) {
      this.#options.onError(error, info);
    } else if (this.mastra) {
      this.mastra.getLogger().warn(`[${this.id}] MCP event subscription error`, { ...info, error });
    } else {
      console.warn(`[${this.id}] ${info.key}:`, error);
    }
  }
}
