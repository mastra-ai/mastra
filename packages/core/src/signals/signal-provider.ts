import type { Agent } from '../agent/agent';
import type { AgentSignalIfIdleOptions } from '../agent/types';
import { isLeaseProvider, NoopLeaseProvider, type LeaseProvider } from '../events/pubsub';
import type { Mastra } from '../mastra';
import type { SendNotificationSignalInput } from '../notifications/types';
import type { InputProcessorOrWorkflow, OutputProcessorOrWorkflow } from '../processors';
import type { SignalSubscriptionsStorage, StoredSignalSubscription } from '../storage/domains/signal-subscriptions';

/**
 * Identifies a specific agent thread that a signal provider targets.
 *
 * @experimental Agent signals are experimental and may change in a future release.
 */
export type SignalProviderTarget = {
  threadId: string;
  resourceId: string;
  agentId?: string;
  /** Options for signal delivery when the target thread is idle — forwarded to sendNotificationSignal */
  ifIdle?: AgentSignalIfIdleOptions<unknown>;
};

/**
 * A subscription that links an agent thread to an external resource
 * monitored by a signal provider.
 *
 * @experimental Agent signals are experimental and may change in a future release.
 */
export type SignalSubscription = {
  /** Unique identifier for the subscription */
  id: string;
  /** The provider that owns this subscription */
  providerId: string;
  /** The thread receiving signals */
  threadId: string;
  /** The resource owning the thread */
  resourceId: string;
  /** Provider-specific identifier for the external resource (e.g., "github:owner/repo#123") */
  externalResourceId: string;
  /** When the subscription was created */
  subscribedAt: Date;
  /** Provider-specific metadata for the subscription */
  metadata: Record<string, unknown>;
};

/**
 * Options for the handleWebhook method.
 *
 * @experimental Agent signals are experimental and may change in a future release.
 */
export type SignalProviderWebhookRequest = {
  body: unknown;
  headers: Record<string, string>;
  params?: Record<string, string>;
};

/**
 * Abstract base for signal providers.
 *
 * A SignalProvider monitors external sources and pushes notification signals
 * into agent threads. It combines three capabilities:
 *
 * 1. **Subscription tracking** — built-in registry of which threads are subscribed to which external resources
 * 2. **External monitoring** — polling or webhook-driven event ingestion
 * 3. **Optional processor/tool integration** — providers can expose input/output processors and tools
 *
 * Not all signal providers are processors. A provider that only polls an API
 * and pushes notifications needs no processor hooks at all. Providers that
 * need to intercept agent execution (e.g., injecting subscription hints) can
 * return processors via `getInputProcessors()` / `getOutputProcessors()`.
 * Providers that expose agent tools (e.g., subscribe/unsubscribe commands)
 * can return them via `getTools()`.
 *
 * ## Usage
 *
 * ```ts
 * const agent = new Agent({
 *   signals: [new MySignalProvider()],
 * });
 * ```
 *
 * The Agent automatically:
 * - Calls `connect(this)` to establish the bidirectional link
 * - Registers any processors returned by `getInputProcessors()` / `getOutputProcessors()`
 * - Merges any tools returned by `getTools()`
 * - Starts polling if `pollInterval` is defined
 *
 * ## Building a Provider
 *
 * Extend this class, implement the abstract `id` field, and override
 * whichever hooks your provider needs:
 *
 * ```ts
 * class SlackSignals extends SignalProvider<'slack-signals'> {
 *   readonly id = 'slack-signals';
 *   readonly pollInterval = 30_000; // poll every 30s
 *
 *   async poll(subscriptions: SignalSubscription[]) {
 *     for (const sub of subscriptions) {
 *       // check Slack, emit notifications for changes
 *     }
 *   }
 * }
 * ```
 *
 * @experimental Agent signals are experimental and may change in a future release.
 */
export abstract class SignalProvider<TId extends string = string> {
  abstract readonly id: TId;
  readonly name?: string;

  /**
   * The Mastra instance this provider is registered with.
   * Set by the framework when the agent is registered with Mastra.
   */
  protected mastra?: Mastra<any, any, any, any, any, any, any, any, any, any>;

  /**
   * @internal Called when the provider's agent is registered with a Mastra instance.
   */
  __registerMastra(mastra: Mastra<any, any, any, any, any, any, any, any, any, any>): void {
    this.mastra = mastra;
  }

  /**
   * The agent this provider is connected to.
   * Set automatically when passed to `Agent({ signals: [...] })`.
   */
  #connectedAgent?: Agent<any, any, any, any>;

  /**
   * In-memory subscription registry.
   * Key: `${resourceId}:${threadId}:${externalResourceId}`
   */
  readonly #subscriptions = new Map<string, SignalSubscription>();

  /**
   * Index: externalResourceId → set of subscription keys
   */
  readonly #subscriptionsByResource = new Map<string, Set<string>>();

  /**
   * Index: `${resourceId}:${threadId}` → set of subscription keys
   */
  readonly #subscriptionsByThread = new Map<string, Set<string>>();

  /** Active polling timer, if any */
  #pollTimer?: ReturnType<typeof setInterval>;

  /** Guard to prevent overlapping poll cycles */
  #isPollRunning = false;

  /** Stable identity used when acquiring polling leases. */
  readonly #pollOwner = crypto.randomUUID();

  /** Leases currently held by this provider instance. */
  readonly #heldPollLeases = new Set<string>();

  /** Initialization is run once even when an agent is forked. */
  #initialization?: Promise<void>;

  // ── Connection ──────────────────────────────────────────────────────

  /**
   * Called by the Agent constructor to establish the bidirectional link.
   * Override to perform additional setup (always call `super.connect(agent)`).
   */
  connect(agent: Agent<any, any, any, any>): void {
    this.#connectedAgent = agent;
  }

  /**
   * Whether this provider is already connected to an agent.
   * Used to skip re-wiring when an Agent is forked via `__fork()`.
   */
  get isConnected(): boolean {
    return this.#connectedAgent !== undefined;
  }

  /**
   * The connected agent. Available after `connect()` has been called.
   * Use this to send signals and notification signals back into agent threads.
   */
  protected get agent(): Agent<any, any, any, any> | undefined {
    return this.#connectedAgent;
  }

  // ── Processors & Tools ─────────────────────────────────────────────

  /**
   * Return input processors this provider needs registered with the agent.
   * Override when your provider intercepts agent input steps (e.g., injecting
   * subscription hints, detecting PR-related shell commands).
   *
   * @example
   * ```ts
   * getInputProcessors() {
   *   return [this]; // when the provider itself implements processInputStep
   * }
   * ```
   */
  getInputProcessors?(): InputProcessorOrWorkflow[];

  /**
   * Return output processors this provider needs registered with the agent.
   * Override when your provider intercepts agent output steps.
   */
  getOutputProcessors?(): OutputProcessorOrWorkflow[];

  /**
   * Return tools this provider exposes to the agent.
   * Override when your provider adds agent-callable tools (e.g.,
   * subscribe/unsubscribe commands).
   *
   * @example
   * ```ts
   * getTools() {
   *   return {
   *     subscribe_pr: createTool({ ... }),
   *     unsubscribe_pr: createTool({ ... }),
   *   };
   * }
   * ```
   */
  getTools?(): Record<string, unknown>;

  // ── Subscription tracking ──────────────────────────────────────────

  /**
   * Subscribe a thread to an external resource.
   *
   * @param target - The thread to receive signals
   * @param externalResourceId - Provider-specific resource identifier
   *   (e.g., `"github:mastra-ai/mastra#123"`, `"slack:C0B01RW7A4T"`)
   * @param metadata - Optional provider-specific metadata for the subscription
   */
  protected async subscribe(
    target: SignalProviderTarget,
    externalResourceId: string,
    metadata: Record<string, unknown> = {},
  ): Promise<SignalSubscription> {
    const key = this.#subscriptionKey(target, externalResourceId);
    const existing = (await this.getSubscriptionsForThread(target)).find(
      subscription => subscription.externalResourceId === externalResourceId,
    );
    const subscription: SignalSubscription = existing
      ? { ...existing, metadata: { ...existing.metadata, ...metadata } }
      : {
          id: `${this.id}:${key}`,
          providerId: this.id,
          threadId: target.threadId,
          resourceId: target.resourceId,
          externalResourceId,
          subscribedAt: new Date(),
          metadata,
        };

    const store = await this.#getSubscriptionStore();
    if (store) {
      const stored = await store.upsertSubscription(this.#toStored(subscription));
      return this.#fromStored(stored);
    }

    this.#cacheSubscription(subscription);
    return subscription;
  }

  /**
   * Unsubscribe a thread from an external resource.
   *
   * @returns `true` if a subscription was removed, `false` if none existed
   */
  protected async unsubscribe(target: SignalProviderTarget, externalResourceId: string): Promise<boolean> {
    const subscription = (await this.getSubscriptionsForThread(target)).find(
      candidate => candidate.externalResourceId === externalResourceId,
    );
    if (!subscription) return false;

    const store = await this.#getSubscriptionStore();
    if (store) await store.deleteSubscription(subscription.id);
    this.#uncacheSubscription(subscription);
    return true;
  }

  /** Get all active subscriptions for this provider. */
  protected async getSubscriptions(): Promise<SignalSubscription[]> {
    return this.#listSubscriptions({ providerId: this.id });
  }

  /** Get all subscriptions for a specific external resource. */
  protected async getSubscriptionsForResource(externalResourceId: string): Promise<SignalSubscription[]> {
    return this.#listSubscriptions({ providerId: this.id, externalResourceId });
  }

  /** Get all subscriptions for a specific thread. */
  protected async getSubscriptionsForThread(target: SignalProviderTarget): Promise<SignalSubscription[]> {
    return this.#listSubscriptions({ providerId: this.id, resourceId: target.resourceId, threadId: target.threadId });
  }

  /** Check if a thread is subscribed to a specific external resource. */
  protected async hasSubscription(target: SignalProviderTarget, externalResourceId: string): Promise<boolean> {
    return (await this.getSubscriptionsForThread(target)).some(
      subscription => subscription.externalResourceId === externalResourceId,
    );
  }

  /** Remove all subscriptions for a thread. */
  protected async unsubscribeAll(target: SignalProviderTarget): Promise<number> {
    const subscriptions = await this.getSubscriptionsForThread(target);
    const store = await this.#getSubscriptionStore();
    if (store) {
      await store.deleteSubscriptions({
        providerId: this.id,
        resourceId: target.resourceId,
        threadId: target.threadId,
      });
    }
    for (const subscription of subscriptions) this.#uncacheSubscription(subscription);
    return subscriptions.length;
  }

  /** Total number of active subscriptions. */
  protected async getSubscriptionCount(): Promise<number> {
    return (await this.getSubscriptions()).length;
  }

  // ── Polling ────────────────────────────────────────────────────────

  /**
   * Optional poll interval in milliseconds.
   * When defined, the framework calls `poll()` on this interval
   * with all active subscriptions.
   *
   * Set to `undefined` or `0` for webhook-only providers that don't poll.
   */
  readonly pollInterval?: number;

  /**
   * Called on each poll cycle with all active subscriptions.
   * Override to check external sources and emit notifications.
   *
   * @param subscriptions - All active subscriptions for this provider
   */
  poll?(subscriptions: SignalSubscription[]): Promise<void>;

  /**
   * Start the polling timer. Called automatically by the Agent after `connect()`.
   * Can also be called manually to restart polling after `stopPolling()`.
   */
  startPolling(): void {
    if (this.#pollTimer) return;
    const interval = this.pollInterval;
    if (!interval || interval <= 0 || typeof this.poll !== 'function') return;

    this.#pollTimer = setInterval(() => void this.#runPollCycle(), interval);

    // Don't let the timer keep the process alive
    this.#pollTimer.unref?.();
  }

  async #runPollCycle(): Promise<void> {
    if (this.#isPollRunning) return;
    this.#isPollRunning = true;
    try {
      const subscriptions = await this.getSubscriptions();
      if (subscriptions.length === 0) return;

      const leaseProvider = this.#getLeaseProvider();
      const ttlMs = Math.max((this.pollInterval ?? 30_000) * 2, 1_000);
      const byResource = new Map<string, SignalSubscription[]>();
      for (const subscription of subscriptions) {
        const resourceSubscriptions = byResource.get(subscription.externalResourceId) ?? [];
        resourceSubscriptions.push(subscription);
        byResource.set(subscription.externalResourceId, resourceSubscriptions);
      }
      for (const [externalResourceId, resourceSubscriptions] of byResource) {
        const leaseKey = `signal-provider:${this.id}:${externalResourceId}`;
        const acquired = this.#heldPollLeases.has(leaseKey)
          ? await leaseProvider.renewLease(leaseKey, this.#pollOwner, ttlMs)
          : (await leaseProvider.acquireLease(leaseKey, this.#pollOwner, ttlMs)).acquired;
        if (!acquired) {
          this.#heldPollLeases.delete(leaseKey);
          continue;
        }
        this.#heldPollLeases.add(leaseKey);
        await this.poll!(resourceSubscriptions);
      }
    } catch (error) {
      console.warn(`[${this.id}] poll failed:`, error);
    } finally {
      this.#isPollRunning = false;
    }
  }

  /**
   * Stop the polling timer.
   */
  stopPolling(): void {
    if (this.#pollTimer) {
      clearInterval(this.#pollTimer);
      this.#pollTimer = undefined;
    }
  }

  // ── Webhook ────────────────────────────────────────────────────────

  /**
   * Handle an incoming webhook request.
   * Override to parse the payload, match it to subscriptions,
   * and emit notification signals.
   *
   * Call this method from an application-defined HTTP endpoint after
   * performing provider-specific webhook verification.
   */
  handleWebhook?(request: SignalProviderWebhookRequest): Promise<{ status?: number; body?: unknown }>;

  // ── Lifecycle ──────────────────────────────────────────────────────

  /**
   * Called after `connect()` to perform async initialization.
   * Override for setup that requires the agent or Mastra to be available.
   */
  start?(): Promise<void> | void;

  /** @internal Awaits provider initialization before polling can begin. */
  __initialize(): Promise<void> {
    this.#initialization ??= Promise.resolve(this.start?.()).then(() => {
      this.startPolling();
    });
    return this.#initialization;
  }

  /**
   * Called on shutdown. Override to clean up resources.
   * Default implementation stops polling and clears the local fallback cache.
   */
  async stop(): Promise<void> {
    this.stopPolling();
    const leaseProvider = this.#getLeaseProvider();
    await Promise.all([...this.#heldPollLeases].map(leaseKey => leaseProvider.releaseLease(leaseKey, this.#pollOwner)));
    this.#heldPollLeases.clear();
    this.#subscriptions.clear();
    this.#subscriptionsByResource.clear();
    this.#subscriptionsByThread.clear();
  }

  // ── Convenience ────────────────────────────────────────────────────

  /**
   * Send a notification signal to the connected agent.
   * Convenience wrapper around `this.agent.sendNotificationSignal()`.
   *
   * @throws If no agent is connected
   */
  protected async notify(notification: SendNotificationSignalInput, target: SignalProviderTarget): Promise<void> {
    const agent = this.#connectedAgent;
    if (!agent) {
      throw new Error(
        `[${this.id}] Cannot send notification: no agent connected. Was this provider passed to Agent({ signals: [...] })?`,
      );
    }

    await agent.sendNotificationSignal(notification, {
      resourceId: target.resourceId,
      threadId: target.threadId,
      ...(target.ifIdle ? { ifIdle: target.ifIdle } : {}),
    });
  }

  // ── Internal ───────────────────────────────────────────────────────

  async #getSubscriptionStore(): Promise<SignalSubscriptionsStorage | undefined> {
    return this.mastra?.getStorage()?.getStore('signalSubscriptions');
  }

  #getLeaseProvider(): LeaseProvider {
    const getPubSub = this.#connectedAgent?.getPubSub;
    const pubsub = typeof getPubSub === 'function' ? getPubSub.call(this.#connectedAgent) : undefined;
    return isLeaseProvider(pubsub) ? pubsub : NoopLeaseProvider;
  }

  async #listSubscriptions(filter: {
    providerId: string;
    threadId?: string;
    resourceId?: string;
    externalResourceId?: string;
  }): Promise<SignalSubscription[]> {
    const store = await this.#getSubscriptionStore();
    if (store) return (await store.listSubscriptions(filter)).map(subscription => this.#fromStored(subscription));

    return [...this.#subscriptions.values()].filter(
      subscription =>
        subscription.providerId === filter.providerId &&
        (!filter.threadId || subscription.threadId === filter.threadId) &&
        (!filter.resourceId || subscription.resourceId === filter.resourceId) &&
        (!filter.externalResourceId || subscription.externalResourceId === filter.externalResourceId),
    );
  }

  #toStored(subscription: SignalSubscription): StoredSignalSubscription {
    return {
      ...subscription,
      subscribedAt: subscription.subscribedAt.getTime(),
    };
  }

  #fromStored(subscription: StoredSignalSubscription): SignalSubscription {
    return {
      ...subscription,
      subscribedAt: new Date(subscription.subscribedAt),
      metadata: subscription.metadata ?? {},
    };
  }

  #cacheSubscription(subscription: SignalSubscription): void {
    const target = { resourceId: subscription.resourceId, threadId: subscription.threadId };
    const key = this.#subscriptionKey(target, subscription.externalResourceId);
    this.#subscriptions.set(key, subscription);
    const resourceSet = this.#subscriptionsByResource.get(subscription.externalResourceId) ?? new Set<string>();
    resourceSet.add(key);
    this.#subscriptionsByResource.set(subscription.externalResourceId, resourceSet);
    const threadKey = this.#threadKey(target);
    const threadSet = this.#subscriptionsByThread.get(threadKey) ?? new Set<string>();
    threadSet.add(key);
    this.#subscriptionsByThread.set(threadKey, threadSet);
  }

  #uncacheSubscription(subscription: SignalSubscription): void {
    const target = { resourceId: subscription.resourceId, threadId: subscription.threadId };
    const key = this.#subscriptionKey(target, subscription.externalResourceId);
    this.#subscriptions.delete(key);
    const resourceSet = this.#subscriptionsByResource.get(subscription.externalResourceId);
    resourceSet?.delete(key);
    if (resourceSet?.size === 0) this.#subscriptionsByResource.delete(subscription.externalResourceId);
    const threadKey = this.#threadKey(target);
    const threadSet = this.#subscriptionsByThread.get(threadKey);
    threadSet?.delete(key);
    if (threadSet?.size === 0) this.#subscriptionsByThread.delete(threadKey);
  }

  #subscriptionKey(target: SignalProviderTarget, externalResourceId: string): string {
    return `${target.resourceId}:${target.threadId}:${externalResourceId}`;
  }

  #threadKey(target: SignalProviderTarget): string {
    return `${target.resourceId}:${target.threadId}`;
  }
}

/**
 * Type guard to check if an object is a SignalProvider.
 *
 * @experimental Agent signals are experimental and may change in a future release.
 */
export function isSignalProvider(obj: unknown): obj is SignalProvider {
  return obj instanceof SignalProvider;
}
