import { createAnthropic } from '@ai-sdk/anthropic-v6';
import { createOpenRouter } from '@openrouter/ai-sdk-provider-v6';
import { MastraError } from '../../../error/index.js';
import { PROVIDER_REGISTRY } from '../provider-registry.js';
import { MastraModelGateway } from './base.js';
import type { ProviderConfig, GatewayLanguageModel } from './base.js';
import { GATEWAY_AUTH_HEADER, MASTRA_USER_AGENT } from './constants.js';

export interface MastraGatewayConfig {
  apiKey?: string;
  baseUrl?: string;
  customFetch?: typeof globalThis.fetch;
}

/**
 * Builds the headers for the OAuth gateway paths. The gateway credential lives in a reserved
 * internal header, so caller-provided headers must not be able to replace it — including via a
 * differently-cased spelling, since HTTP header names are case-insensitive.
 */
function withGatewayAuthHeader(apiKey: string, headers?: Record<string, string>): Record<string, string> {
  const reserved = GATEWAY_AUTH_HEADER.toLowerCase();
  const result: Record<string, string> = { 'User-Agent': MASTRA_USER_AGENT };
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === reserved) continue;
    result[key] = value;
  }
  result[GATEWAY_AUTH_HEADER] = `Bearer ${apiKey}`;
  return result;
}

export class MastraGateway extends MastraModelGateway {
  readonly id = 'mastra';
  readonly name = 'Gateway';

  constructor(private config?: MastraGatewayConfig) {
    super();
  }

  private getBaseUrl(): string {
    const raw = this.config?.baseUrl ?? process.env['MASTRA_GATEWAY_URL'] ?? 'https://gateway-api.mastra.ai';
    return raw.replace(/\/+$/, '').replace(/\/v1$/, '');
  }

  override shouldEnable(): boolean {
    return !!(this.config?.apiKey ?? process.env['MASTRA_GATEWAY_API_KEY']);
  }

  /**
   * Gateway v2 deployments are signaled by MASTRA_GATEWAY_VERSION=v2 (set by the platform)
   * or by a v2 (organization) API key prefix, which predates the env var signal.
   * Keep in sync with isGatewayV2 in @mastra/server's gateway-memory-client.
   * Public so the server can ask a registered gateway instance for its
   * effective v2 state (the instance may carry a v2 key via config.apiKey
   * that env-only checks cannot see).
   */
  isV2(): boolean {
    if (process.env['MASTRA_GATEWAY_VERSION'] === 'v2') return true;
    const key = this.config?.apiKey ?? process.env['MASTRA_GATEWAY_API_KEY'];
    return !!key && (key.startsWith('msk-gateway-') || key.startsWith('mskv2_'));
  }

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    const isV2 = this.isV2();
    const openrouterConfig = PROVIDER_REGISTRY['openrouter'];
    let models = openrouterConfig?.models ?? [];
    if (isV2) {
      const apiKey = await this.getApiKey();
      const response = await (this.config?.customFetch ?? fetch)(`${this.getBaseUrl()}/v1/models`, {
        headers: this.config?.customFetch ? withGatewayAuthHeader(apiKey) : { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Gateway model catalog unavailable (${response.status})`);
      const body: unknown = await response.json();
      if (!body || typeof body !== 'object' || !('data' in body) || !Array.isArray(body.data)) {
        throw new Error('Gateway model catalog has an invalid response');
      }
      // The Mastra gateway model uses the OpenAI-compatible chat transport.
      // Models offered only through another endpoint cannot be selected here.
      models = body.data
        .filter(
          (item): item is { id: string; endpoints: string[] } =>
            !!item &&
            typeof item === 'object' &&
            typeof item.id === 'string' &&
            Array.isArray(item.endpoints) &&
            item.endpoints.includes('chat'),
        )
        .map(item => item.id);
    }

    const providers = {
      mastra: {
        apiKeyEnvVar: 'MASTRA_GATEWAY_API_KEY',
        apiKeyHeader: 'Authorization',
        name: 'Gateway',
        gateway: 'mastra',
        models: [...models],
        // Static release dates describe the bundled registry, not the live v2 catalog.
        modelReleaseDates: isV2 ? undefined : openrouterConfig?.modelReleaseDates,
        docUrl: 'https://mastra.ai/docs/gateway',
      },
    };

    return providers;
  }

  async buildUrl(_modelId: string): Promise<string> {
    return `${this.getBaseUrl()}/v1`;
  }

  async getApiKey(): Promise<string> {
    const apiKey = this.config?.apiKey ?? process.env['MASTRA_GATEWAY_API_KEY'];
    if (!apiKey) {
      throw new MastraError({
        id: 'MASTRA_GATEWAY_NO_API_KEY',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: 'Missing MASTRA_GATEWAY_API_KEY environment variable',
      });
    }
    return apiKey;
  }

  resolveLanguageModel({
    modelId,
    providerId,
    apiKey,
    headers,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
    headers?: Record<string, string>;
  }): GatewayLanguageModel {
    const baseURL = `${this.getBaseUrl()}/v1`;
    const fullModelId = `${providerId}/${modelId}`;

    if (this.config?.customFetch && providerId === 'anthropic') {
      // Anthropic OAuth path: use native Anthropic SDK (sends /messages, not /chat/completions)
      return createAnthropic({
        apiKey: 'oauth-gateway-placeholder',
        baseURL,
        headers: withGatewayAuthHeader(apiKey, headers),
        fetch: this.config.customFetch as any,
      })(modelId) as unknown as GatewayLanguageModel;
    }

    if (this.config?.customFetch) {
      // Non-Anthropic OAuth path: gateway key in GATEWAY_AUTH_HEADER, customFetch owns Authorization
      return createOpenRouter({
        apiKey: 'oauth-gateway-placeholder',
        baseURL,
        headers: withGatewayAuthHeader(apiKey, headers),
        fetch: this.config.customFetch,
      }).chat(fullModelId) as unknown as GatewayLanguageModel;
    }

    // API key path: gateway key goes via Authorization (standard flow)
    return createOpenRouter({
      apiKey,
      baseURL,
      headers: {
        'User-Agent': MASTRA_USER_AGENT,
        ...headers,
      },
    }).chat(fullModelId) as unknown as GatewayLanguageModel;
  }
}
