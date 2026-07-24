import type { Agent } from '../agent/agent';
import type { AgentExecutionOptions } from '../agent/agent.types';
import type { AgentSignalIfIdleOptions } from '../agent/types';
import type { Mastra } from '../mastra';
import type { SendNotificationSignalInput } from '../notifications/types';
import type { InputProcessorOrWorkflow, OutputProcessorOrWorkflow } from '../processors';

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

  /**
   * The notification `source` value carried by records this provider produces.
   *
   * Defaults to the provider `id`. Override when the emitted `source` differs
   * (e.g. GithubSignals has id `github-signals` but emits records with
   * `source: 'github'`). The dispatcher routes a due record to its provider by
   * matching `record.source === provider.notificationSource`.
   *
   * @experimental Agent signals are experimental and may change in a future release.
   */
  get notificationSource(): string {
    return this.id;
  }

  /**
   * Resolve the stream options used when a deferred notification produced by
   * this provider wakes an idle thread.
   *
   * A wake starts a fresh run, but the dispatcher carries no request context or
   * model selection — which surfaces as "No model selected". The dispatcher
   * matches a due record back to the provider that produced it (via
   * `record.source === provider.notificationSource`) and calls this method to
   * obtain the stream options (typically `requestContext`, `memory`, and model
   * settings) attached to the wake target's `ifIdle.streamOptions`.
   *
   * Resolved at dispatch time because the stream options carry live, non-
   * serializable state (e.g. a `RequestContext`) that cannot be persisted on
   * the notification record at enqueue time.
   *
   * @experimental Agent signals are experimental and may change in a future release.
   */
  getNotificationStreamOptions?(target: {
    resourceId: string;
    threadId: string;
  }): AgentExecutionOptions | undefined | Promise<AgentExecutionOptions | undefined>;

  // ── Subscription tracking ──────────────────────────────────────────

  /**
   * Subscribe a thread to an external resource.
   *
   * @param target - The thread to receive signals
   * @param externalResourceId - Provider-specific resource identifier
   *   (e.g., `"github:mastra-ai/mastra#123"`, `"slack:C0B01RW7A4T"`)
   * @param metadata - Optional provider-specific metadata for the subscription
   */
  protected subscribe(
    target: SignalProviderTarget,
    externalResourceId: string,
    metadata: Record<string, unknown> = {},
  ): SignalSubscription {
    const key = this.#subscriptionKey(target, externalResourceId);
    const existing = this.#subscriptions.get(key);
    if (existing) {
      existing.metadata = { ...existing.metadata, ...metadata };
      return existing;
    }

    const subscription: SignalSubscription = {
      id: crypto.randomUUID(),
      providerId: this.id,
      threadId: target.threadId,
      resourceId: target.resourceId,
      externalResourceId,
      subscribedAt: new Date(),
      metadata,
    };

    this.#subscriptions.set(key, subscription);

    // Update resource index
    let resourceSet = this.#subscriptionsByResource.get(externalResourceId);
    if (!resourceSet) {
      resourceSet = new Set();
      this.#subscriptionsByResource.set(externalResourceId, resourceSet);
    }
    resourceSet.add(key);

    // Update thread index
    const threadKey = this.#threadKey(target);
    let threadSet = this.#subscriptionsByThread.get(threadKey);
    if (!threadSet) {
      threadSet = new Set();
      this.#subscriptionsByThread.set(threadKey, threadSet);
    }
    threadSet.add(key);

    return subscription;
  }

  /**
   * Unsubscribe a thread from an external resource.
   *
   * @returns `true` if a subscription was removed, `false` if none existed
   */
  protected unsubscribe(target: SignalProviderTarget, externalResourceId: string): boolean {
    const key = this.#subscriptionKey(target, externalResourceId);
    const subscription = this.#subscriptions.get(key);
    if (!subscription) return false;

    this.#subscriptions.delete(key);

    // Clean up resource index
    const resourceSet = this.#subscriptionsByResource.get(externalResourceId);
    if (resourceSet) {
      resourceSet.delete(key);
      if (resourceSet.size === 0) this.#subscriptionsByResource.delete(externalResourceId);
    }

    // Clean up thread index
    const threadKey = this.#threadKey(target);
    const threadSet = this.#subscriptionsByThread.get(threadKey);
    if (threadSet) {
      threadSet.delete(key);
      if (threadSet.size === 0) this.#subscriptionsByThread.delete(threadKey);
    }

    return true;
  }

  /**
   * Get all active subscriptions for this provider.
   */
  protected getSubscriptions(): SignalSubscription[] {
    return [...this.#subscriptions.values()];
  }

  /**
   * Get all subscriptions for a specific external resource.
   *
   * @example
   * ```ts
   * const subs = this.getSubscriptionsForResource('github:mastra-ai/mastra#123');
   * for (const sub of subs) {
   *   await this.notify({ ... }, { resourceId: sub.resourceId, threadId: sub.threadId });
   * }
   * ```
   */
  protected getSubscriptionsForResource(externalResourceId: string): SignalSubscription[] {
    const keys = this.#subscriptionsByResource.get(externalResourceId);
    if (!keys) return [];
    return [...keys].map(key => this.#subscriptions.get(key)!).filter(Boolean);
  }

  /**
   * Get all subscriptions for a specific thread.
   */
  protected getSubscriptionsForThread(target: SignalProviderTarget): SignalSubscription[] {
    const threadKey = this.#threadKey(target);
    const keys = this.#subscriptionsByThread.get(threadKey);
    if (!keys) return [];
    return [...keys].map(key => this.#subscriptions.get(key)!).filter(Boolean);
  }

  /**
   * Check if a thread is subscribed to a specific external resource.
   */
  protected hasSubscription(target: SignalProviderTarget, externalResourceId: string): boolean {
    return this.#subscriptions.has(this.#subscriptionKey(target, externalResourceId));
  }

  /**
   * Remove all subscriptions for a thread.
   */
  protected unsubscribeAll(target: SignalProviderTarget): number {
    const threadSubscriptions = this.getSubscriptionsForThread(target);
    let removed = 0;
    for (const sub of threadSubscriptions) {
      if (this.unsubscribe(target, sub.externalResourceId)) removed++;
    }
    return removed;
  }

  /**
   * Total number of active subscriptions.
   */
  protected get subscriptionCount(): number {
    return this.#subscriptions.size;
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

    this.#pollTimer = setInterval(() => {
      if (this.#isPollRunning) return;
      const subscriptions = this.getSubscriptions();
      if (subscriptions.length === 0) return;
      this.#isPollRunning = true;
      void Promise.resolve(this.poll!(subscriptions))
        .catch(error => {
          console.warn(`[${this.id}] poll failed:`, error);
        })
        .finally(() => {
          this.#isPollRunning = false;
        });
    }, interval);

    // Don't let the timer keep the process alive
    this.#pollTimer.unref?.();
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
   * The framework routes `POST /api/signals/:providerId` to this method.
   */
  handleWebhook?(request: SignalProviderWebhookRequest): Promise<{ status?: number; body?: unknown }>;

  // ── Lifecycle ──────────────────────────────────────────────────────

  /**
   * Called after `connect()` to perform async initialization.
   * Override for setup that requires the agent or Mastra to be available.
   */
  start?(): Promise<void> | void;

  /**
   * Called on shutdown. Override to clean up resources.
   * Default implementation stops polling and clears all subscriptions.
   */
  stop(): void {
    this.stopPolling();
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
