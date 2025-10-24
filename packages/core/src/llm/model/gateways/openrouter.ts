import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { createOpenRouter } from '@openrouter/ai-sdk-provider-v5';
import { OpenRouter } from '@openrouter/sdk';
import { InMemoryServerCache } from '../../../cache/inmemory.js';
import { MastraError } from '../../../error/index.js';
import { MastraModelGateway } from './base.js';
import type { ProviderConfig } from './base.js';

interface OpenRouterModel {
  id: string;
  name?: string;
  created?: number;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
    image?: string;
    request?: string;
  };
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number | null;
    is_moderated?: boolean;
  };
  per_request_limits?: {
    prompt_tokens?: string;
    completion_tokens?: string;
  } | null;
}

interface CachedProviders {
  providers: Record<string, ProviderConfig>;
  expiresAt: number;
}

export class OpenRouterGateway extends MastraModelGateway {
  readonly name = 'openrouter';
  readonly prefix = 'openrouter';
  private providerCache = new InMemoryServerCache();
  private readonly CACHE_KEY = 'openrouter-providers';
  private readonly CACHE_TTL = 3600; // 1 hour in seconds

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    // Check cache first
    const cached = (await this.providerCache.get(this.CACHE_KEY)) as CachedProviders | undefined;
    if (cached && cached.expiresAt > Date.now() / 1000) {
      return cached.providers;
    }

    const apiKey = process.env['OPENROUTER_API_KEY'];
    if (!apiKey) {
      throw new MastraError({
        id: 'OPENROUTER_GATEWAY_NO_API_KEY',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: 'Missing OPENROUTER_API_KEY environment variable required to fetch providers',
      });
    }

    try {
      const client = new OpenRouter({ apiKey });

      // Fetch models from OpenRouter
      const modelsResponse = await client.models.list();

      // Parse responses - OpenRouter API returns the data directly
      const models = (modelsResponse as any).data as OpenRouterModel[] | undefined;

      if (!models || !Array.isArray(models)) {
        throw new Error('Invalid models response from OpenRouter API');
      }

      // Create a single "openrouter" provider with all models
      const openrouterConfig: ProviderConfig = {
        url: 'https://openrouter.ai/api/v1',
        apiKeyEnvVar: 'OPENROUTER_API_KEY',
        apiKeyHeader: 'Authorization',
        name: 'OpenRouter',
        models: [],
        docUrl: 'https://openrouter.ai/docs',
        gateway: 'openrouter',
      };

      // Add all model IDs to the openrouter provider
      for (const model of models) {
        if (model.id) {
          openrouterConfig.models.push(model.id);
        }
      }

      // Sort model list for consistency
      openrouterConfig.models.sort();

      const providerConfigs = { openrouter: openrouterConfig };

      // Cache the result
      await this.providerCache.set(this.CACHE_KEY, {
        providers: providerConfigs,
        expiresAt: Date.now() / 1000 + this.CACHE_TTL,
      });

      return providerConfigs;
    } catch (error) {
      throw new MastraError({
        id: 'OPENROUTER_GATEWAY_FETCH_ERROR',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: `Failed to fetch providers from OpenRouter: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  async buildUrl(_routerId: string, _envVars?: typeof process.env): Promise<string> {
    return 'https://openrouter.ai/api/v1';
  }

  async getApiKey(modelId: string): Promise<string> {
    const apiKey = process.env['OPENROUTER_API_KEY'];

    if (!apiKey) {
      throw new MastraError({
        id: 'OPENROUTER_GATEWAY_NO_API_KEY',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: `Missing OPENROUTER_API_KEY environment variable required for model: ${modelId}`,
      });
    }

    return apiKey;
  }

  async resolveLanguageModel({
    modelId,
    providerId,
    apiKey,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
  }): Promise<LanguageModelV2> {
    return createOpenRouter({
      apiKey,
    })(modelId);
  }
}
