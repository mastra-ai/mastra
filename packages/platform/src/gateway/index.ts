import { MastraPlatformError } from '../provisioning/index';
import type { PlatformApi } from '../provisioning/index';

/** Where a key's requests are served. A key keeps its region for life. */
export type GatewayRegion = 'us' | 'eu';

export interface GatewaySpendLimit {
  /** Dollars, as a decimal string, e.g. `'25'` or `'7.50'`. */
  limitUsd: string;
  /** How often the limit starts over. Omit for a limit that never resets. */
  reset?: { every: number; unit: 'hour' | 'day' | 'week' | 'month' } | null;
}

export interface GatewayKey {
  keyId: string;
  label: string;
  /** The start of the key, to tell keys apart. The full key is only returned when it is created. */
  keyPrefix: string;
  region: GatewayRegion;
  revoked: boolean;
  /** Changes whenever the key's settings do. `updateKey` uses it to refuse writing over a newer change. */
  policyRevision: string;
  /** The models the key may call. `null` allows every model. */
  allowedModels: string[] | null;
  zeroDataRetention: boolean;
  spendLimit?: GatewaySpendLimit & { startedAt: string };
  [field: string]: unknown;
}

export interface CreateGatewayKeyInput {
  /** Up to 100 characters. */
  label: string;
  /** Defaults to `us`. */
  region?: GatewayRegion;
  /** The last day the key works, as `yyyy-MM-dd`. Use this or `expiresAt`. */
  expiresOn?: string;
  /** When the key stops working, as an ISO datetime. Use this or `expiresOn`. */
  expiresAt?: string;
  /** Limit the key to these models, e.g. `['openai/gpt-5-mini']`. */
  allowedModels?: string[];
  /** Don't fall back to another provider when the model's first provider fails. */
  disableFailover?: boolean;
  /** Only serve the key's requests where the provider keeps no data. Can only be set at creation. */
  zeroDataRetention?: boolean;
  spendLimit?: GatewaySpendLimit;
}

export interface CreatedGatewayKey {
  keyId: string;
  /** The key itself. Shown only once: store it now. */
  apiKey: string;
}

export interface UpdateGatewayKeyInput {
  label?: string;
  /** `null` removes the limit. */
  spendLimit?: GatewaySpendLimit | null;
  /**
   * The `policyRevision` the change is based on. The update is refused when the key changed since.
   * Defaults to the key's current revision, so the update wins over earlier changes.
   */
  expectedRevision?: string;
}

export interface GatewayKeyBudget {
  policy: GatewaySpendLimit & { startedAt: string };
  /** The current spending period. */
  window: { startsAt: string; endsAt: string | null };
  spentUsd: string;
  /** Held for requests still running. */
  heldUsd: string;
  remainingUsd: string;
}

export interface GatewayModel {
  /** The model ID to call, e.g. `openai/gpt-5-mini`. In a Mastra agent, prefix it with `mastra/`. */
  id: string;
  regions: GatewayRegion[];
  [field: string]: unknown;
}

export type GatewayUsageDimension = 'total' | 'hour' | 'day' | 'api_key' | 'model' | 'endpoint';

export interface GatewayUsageOptions {
  /** Start of the period: a date (midnight UTC) or a datetime. */
  from: Date | string;
  /** End of the period, at most 90 days after `from`. A date includes that whole day. */
  to: Date | string;
  /** Count requests, or each attempt at a provider including failovers, with token totals. Defaults to `requests`. */
  view?: 'requests' | 'attempts';
  /** Defaults to `total`. */
  groupBy?: GatewayUsageDimension;
  /** Only this key's requests. */
  keyId?: string;
  model?: string;
  endpoint?: string;
}

export interface GatewayRequestUsage {
  /** The `groupBy` value the row is for. `null` for `total`. */
  dimension: string | null;
  requests: number;
  errors: number;
  delivered: number;
  averageLatencyMs: number | null;
}

export interface GatewayAttemptUsage {
  dimension: string | null;
  attempts: number;
  servedAttempts: number;
  inputTokens: { sum: number | null; reportedAttempts: number };
  outputTokens: { sum: number | null; reportedAttempts: number };
  totalTokens: { sum: number | null; reportedAttempts: number };
  [field: string]: unknown;
}

const id = encodeURIComponent;
const bound = (value: Date | string) => (value instanceof Date ? value.toISOString() : value);

/**
 * The project's Mastra Gateway: its API keys, what they spend, and the models they can call. Agents
 * call Gateway models as `mastra/<model>` with a key in `MASTRA_GATEWAY_API_KEY`.
 */
export class PlatformGateway {
  constructor(
    private readonly api: PlatformApi,
    private readonly projectId: string,
  ) {}

  #keys(rest = '') {
    return `/v1/gateway/projects/${id(this.projectId)}/v2/keys${rest}`;
  }

  /**
   * The project's keys, revoked ones included. Keys the Platform made for itself, such as managed
   * agents' keys, aren't listed.
   */
  async listKeys(): Promise<GatewayKey[]> {
    return (await this.api.request<{ keys: GatewayKey[] }>('GET', this.#keys())).keys;
  }

  /** Creates a key. The response is the only time the key itself is returned. */
  async createKey(input: CreateGatewayKeyInput): Promise<CreatedGatewayKey> {
    return this.api.request('POST', this.#keys(), input);
  }

  /** Renames a key or changes its spend limit. */
  async updateKey(keyId: string, input: UpdateGatewayKeyInput): Promise<GatewayKey> {
    let { expectedRevision, ...changes } = input;
    if (!expectedRevision) {
      const key = (await this.listKeys()).find(k => k.keyId === keyId);
      if (!key) throw new MastraPlatformError(`Gateway key ${keyId} not found`, 404, null);
      expectedRevision = key.policyRevision;
    }
    return (
      await this.api.request<{ key: GatewayKey }>('PATCH', this.#keys(`/${id(keyId)}`), {
        ...changes,
        expectedRevision,
      })
    ).key;
  }

  /** Revokes a key. Requests with it are refused from then on. */
  async revokeKey(keyId: string): Promise<void> {
    await this.api.request('DELETE', this.#keys(`/${id(keyId)}`));
  }

  /** What a key with a spend limit has spent and has left in the current period. */
  async keyBudget(keyId: string): Promise<GatewayKeyBudget> {
    return (await this.api.request<{ budget: GatewayKeyBudget }>('GET', this.#keys(`/${id(keyId)}/budget`))).budget;
  }

  /** The models keys of a region can call. Defaults to `us`. */
  async listModels(options: { region?: GatewayRegion } = {}): Promise<GatewayModel[]> {
    const query = options.region ? `?region=${id(options.region)}` : '';
    return (await this.api.request<{ models: GatewayModel[] }>('GET', `/v1/gateway/organization/v2/models${query}`))
      .models;
  }

  /** The project's Gateway requests in a period, totalled or grouped. */
  async usage(options: GatewayUsageOptions & { view: 'attempts' }): Promise<GatewayAttemptUsage[]>;
  async usage(options: GatewayUsageOptions & { view?: 'requests' }): Promise<GatewayRequestUsage[]>;
  async usage(options: GatewayUsageOptions): Promise<GatewayRequestUsage[] | GatewayAttemptUsage[]> {
    const query = new URLSearchParams({ from: bound(options.from), to: bound(options.to), projectId: this.projectId });
    if (options.view) query.set('view', options.view);
    if (options.groupBy) query.set('groupBy', options.groupBy);
    if (options.keyId) query.set('apiKeyId', options.keyId);
    if (options.model) query.set('model', options.model);
    if (options.endpoint) query.set('endpoint', options.endpoint);
    return (
      await this.api.request<{ rows: GatewayRequestUsage[] }>('GET', `/v1/gateway/organization/v2/usage?${query}`)
    ).rows;
  }
}
