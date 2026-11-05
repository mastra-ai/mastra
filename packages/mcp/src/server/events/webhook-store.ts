/**
 * One webhook subscription as held by the server: the immutable subscription key, the derived
 * `id`, the signing secret and the granted lifetime.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export interface WebhookSubscriptionRecord {
  /** Derived from the key; carried in `X-MCP-Subscription-Id`. */
  id: string;
  /** Canonical identifier of the authenticated subject that subscribed. */
  principal: string;
  /** Callback URL (`delivery.url`). */
  url: string;
  /** Event name. */
  name: string;
  /** Validated subscription arguments. */
  arguments: Record<string, unknown>;
  /** Current `whsec_` signing secret. */
  secret: string;
  /** The secret replaced by the latest rotation, still used to dual-sign until `until` (epoch ms). */
  previousSecret?: { secret: string; until: number };
  /** Expiry in epoch ms, or `null` for a no-expiry grant. */
  expiresAt: number | null;
  /** Creation time in epoch ms. */
  createdAt: number;
}

/**
 * Where `MCPServer` keeps webhook subscriptions. The default keeps them in memory, which suits short
 * TTL grants: after a restart clients resubscribe on their next refresh. A server that grants
 * no-expiry subscriptions (`allowNoExpiry`) must persist them, so it needs a durable store.
 *
 * In-flight delivery state (retry queue, watermark, delivery status) is not stored here; it stays
 * in memory and is rebuilt by the client's next refresh.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export interface WebhookSubscriptionStore {
  get(id: string): Promise<WebhookSubscriptionRecord | undefined>;
  /** Inserts or replaces the record with this `id`. */
  set(record: WebhookSubscriptionRecord): Promise<void>;
  delete(id: string): Promise<void>;
  /** Every record subscribed to event `name`, including expired ones. */
  list(name: string): Promise<WebhookSubscriptionRecord[]>;
}

/**
 * Default {@link WebhookSubscriptionStore}: a process-local map.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export class InMemoryWebhookSubscriptionStore implements WebhookSubscriptionStore {
  private readonly records = new Map<string, WebhookSubscriptionRecord>();

  async get(id: string): Promise<WebhookSubscriptionRecord | undefined> {
    return this.records.get(id);
  }

  async set(record: WebhookSubscriptionRecord): Promise<void> {
    this.records.set(record.id, record);
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }

  async list(name: string): Promise<WebhookSubscriptionRecord[]> {
    return [...this.records.values()].filter(record => record.name === name);
  }
}
