import { createOpenRouter } from '@openrouter/ai-sdk-provider-v5';
import { MastraError } from '../../../error/index.js';
import { PROVIDER_REGISTRY } from '../provider-registry.js';
import { MastraModelGateway } from './base.js';
import type { ProviderConfig, GatewayLanguageModel } from './base.js';
import { MASTRA_USER_AGENT } from './constants.js';

export class MastraGateway extends MastraModelGateway {
  readonly id = 'mastra';
  readonly name = 'Mastra Gateway';

  private getBaseUrl(): string {
    return process.env['MASTRA_GATEWAY_URL'] || 'https://server.mastra.ai';
  }

  override shouldEnable(): boolean {
    return !!process.env['MASTRA_GATEWAY_API_KEY'];
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
        name: 'Mastra Gateway',
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
    const apiKey = process.env['MASTRA_GATEWAY_API_KEY'];
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
