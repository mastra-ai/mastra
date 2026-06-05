import type { SendNotificationSignalInput } from '../notifications/types';
import { SignalProvider } from './signal-provider';
import type { SignalProviderTarget, SignalProviderWebhookRequest, SignalSubscription } from './signal-provider';

/**
 * Configuration for the webhook signal provider.
 *
 * @experimental Agent signals are experimental and may change in a future release.
 */
export type WebhookSignalProviderOptions = {
  /**
   * Unique identifier for the provider instance.
   * @default 'webhook-signals'
   */
  id?: string;

  /**
   * Human-readable name.
   * @default 'Webhook Signals'
   */
  name?: string;

  /**
   * Optional function to extract a matching key from an incoming webhook payload.
   * The returned string is matched against `externalResourceId` in subscriptions.
   *
   * @default Returns `payload.resource` or `payload.externalResourceId` if present.
   */
  extractResourceId?: (payload: unknown) => string | string[] | undefined;

  /**
   * Optional function to build the notification from a webhook payload.
   * When not provided, a default notification is built from the payload.
   */
  buildNotification?: (payload: unknown, subscription: SignalSubscription) => SendNotificationSignalInput;
};

/**
 * A generic webhook-based signal provider.
 *
 * Receives external events via HTTP webhooks and routes them to
 * subscribed agent threads as notification signals.
 *
 * ## Usage
 *
 * ```ts
 * const webhooks = new WebhookSignalProvider({
 *   extractResourceId: (payload) => (payload as any).repository,
 *   buildNotification: (payload, sub) => ({
 *     source: 'ci',
 *     kind: 'build-status',
 *     priority: 'medium',
 *     summary: `Build ${(payload as any).status} for ${sub.externalResourceId}`,
 *   }),
 * });
 *
 * const agent = new Agent({
 *   signals: [webhooks],
 * });
 *
 * // Subscribe a thread to a resource
 * webhooks.subscribeThread(
 *   { threadId: 'thread-1', resourceId: 'user-1' },
 *   'my-org/my-repo',
 * );
 *
 * // Later, when a webhook fires:
 * await webhooks.handleWebhook({
 *   body: { repository: 'my-org/my-repo', status: 'failed' },
 *   headers: {},
 * });
 * ```
 *
 * @experimental Agent signals are experimental and may change in a future release.
 */
export class WebhookSignalProvider extends SignalProvider<string> {
  readonly id: string;
  readonly name: string;
  readonly #options: WebhookSignalProviderOptions;

  constructor(options: WebhookSignalProviderOptions = {}) {
    super();
    this.id = options.id ?? 'webhook-signals';
    this.name = options.name ?? 'Webhook Signals';
    this.#options = options;
  }

  // ── Static signal factories ────────────────────────────────────────

  /**
   * Create signal inputs for subscribing/unsubscribing threads via signals.
   */
  static signals = {
    subscribe(resource: string): {
      type: 'reactive';
      tagName: string;
      contents: string;
      attributes: { resource: string };
    } {
      return {
        type: 'reactive',
        tagName: 'webhook-subscribe',
        contents: `Subscribe to webhook resource: ${resource}`,
        attributes: { resource },
      };
    },

    unsubscribe(resource: string): {
      type: 'reactive';
      tagName: string;
      contents: string;
      attributes: { resource: string };
    } {
      return {
        type: 'reactive',
        tagName: 'webhook-unsubscribe',
        contents: `Unsubscribe from webhook resource: ${resource}`,
        attributes: { resource },
      };
    },
  };

  // ── Public API ─────────────────────────────────────────────────────

  /**
   * Programmatically subscribe a thread to an external resource.
   */
  subscribeThread(
    target: SignalProviderTarget,
    externalResourceId: string,
    metadata?: Record<string, unknown>,
  ): SignalSubscription {
    return this.subscribe(target, externalResourceId, metadata);
  }

  /**
   * Programmatically unsubscribe a thread from an external resource.
   */
  unsubscribeThread(target: SignalProviderTarget, externalResourceId: string): boolean {
    return this.unsubscribe(target, externalResourceId);
  }

  // ── Webhook handling ───────────────────────────────────────────────

  /**
   * Handle an incoming webhook. Matches the payload against subscriptions
   * and emits notification signals to matching threads.
   */
  async handleWebhook(request: SignalProviderWebhookRequest): Promise<{ status?: number; body?: unknown }> {
    const payload = request.body;
    const resourceIds = [...new Set(this.#extractResourceIds(payload))];

    if (resourceIds.length === 0) {
      return { status: 200, body: { matched: 0 } };
    }

    let matched = 0;
    for (const resourceId of resourceIds) {
      const subscriptions = this.getSubscriptionsForResource(resourceId);
      for (const subscription of subscriptions) {
        const notification = this.#buildNotification(payload, subscription);
        try {
          await this.notify(notification, {
            threadId: subscription.threadId,
            resourceId: subscription.resourceId,
          });
          matched++;
        } catch (error) {
          console.warn(`[${this.id}] Failed to notify thread ${subscription.threadId}:`, error);
        }
      }
    }

    return { status: 200, body: { matched } };
  }

  // ── Internal ───────────────────────────────────────────────────────

  #extractResourceIds(payload: unknown): string[] {
    if (this.#options.extractResourceId) {
      const result = this.#options.extractResourceId(payload);
      if (!result) return [];
      return Array.isArray(result) ? result : [result];
    }

    // Default: look for common payload shapes
    if (payload && typeof payload === 'object') {
      const obj = payload as Record<string, unknown>;
      if (typeof obj.resource === 'string') return [obj.resource];
      if (typeof obj.externalResourceId === 'string') return [obj.externalResourceId];
    }

    return [];
  }

  #buildNotification(payload: unknown, subscription: SignalSubscription): SendNotificationSignalInput {
    if (this.#options.buildNotification) {
      return this.#options.buildNotification(payload, subscription);
    }

    return {
      source: this.id,
      kind: 'webhook-event',
      priority: 'medium',
      summary: `Webhook event for ${subscription.externalResourceId}`,
      payload,
      dedupeKey: `${this.id}:${subscription.externalResourceId}:${Date.now()}`,
      coalesceKey: `${this.id}:${subscription.externalResourceId}`,
    };
  }
}
