import { createAnthropic } from '@ai-sdk/anthropic-v6';
import { createOpenRouter } from '@openrouter/ai-sdk-provider-v5';
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

export class MastraGateway extends MastraModelGateway {
  readonly id = 'mastra';
  readonly name = 'Memory Gateway';

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

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    if (!this.shouldEnable()) {
      return {};
    }

    const openrouterConfig = PROVIDER_REGISTRY['openrouter'];
    const models = openrouterConfig?.models ?? [];

    const providers = {
      mastra: {
        apiKeyEnvVar: 'MASTRA_GATEWAY_API_KEY',
        apiKeyHeader: 'Authorization',
        name: 'Memory Gateway',
        gateway: 'mastra',
        models: [...models],
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
        headers: {
          'User-Agent': MASTRA_USER_AGENT,
          [GATEWAY_AUTH_HEADER]: `Bearer ${apiKey}`,
          ...headers,
        },
        fetch: this.config.customFetch as any,
      })(modelId) as unknown as GatewayLanguageModel;
    }

    if (this.config?.customFetch) {
      // Non-Anthropic OAuth path: gateway key in GATEWAY_AUTH_HEADER, customFetch owns Authorization
      return createOpenRouter({
        apiKey: 'oauth-gateway-placeholder',
        baseURL,
        headers: {
          'User-Agent': MASTRA_USER_AGENT,
          [GATEWAY_AUTH_HEADER]: `Bearer ${apiKey}`,
          ...headers,
        },
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
