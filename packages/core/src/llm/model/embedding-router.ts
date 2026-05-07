import { createGoogleGenerativeAI } from '@ai-sdk/google-v5';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v5';
import { createOpenAI } from '@ai-sdk/openai-v5';
import type { EmbeddingModel } from '@internal/ai-sdk-v5';

type EmbeddingModelV2<VALUE> = Exclude<EmbeddingModel<VALUE>, string>;

import { GatewayRegistry } from './provider-registry.js';
import type { OpenAICompatibleConfig } from './shared.types.js';

/**
 * Information about a known embedding model
 */
export interface EmbeddingModelInfo {
  id: string;
  provider: string;
  dimensions: number;
  maxInputTokens: number;
  description?: string;
}

/**
 * Hardcoded list of known embedding models
 * This is a curated list that provides autocomplete support
 */
export const EMBEDDING_MODELS: EmbeddingModelInfo[] = [
  // OpenAI
  {
    id: 'text-embedding-3-small',
    provider: 'openai',
    dimensions: 1536,
    maxInputTokens: 8191,
    description: 'OpenAI text-embedding-3-small model',
  },
  {
    id: 'text-embedding-3-large',
    provider: 'openai',
    dimensions: 3072,
    maxInputTokens: 8191,
    description: 'OpenAI text-embedding-3-large model',
  },
  {
    id: 'text-embedding-ada-002',
    provider: 'openai',
    dimensions: 1536,
    maxInputTokens: 8191,
    description: 'OpenAI text-embedding-ada-002 model',
  },
  // Google
  {
    id: 'gemini-embedding-001',
    provider: 'google',
    dimensions: 768,
    maxInputTokens: 2048,
    description: 'Google gemini-embedding-001 model',
  },
];

/**
 * Type for embedding model IDs in the format "provider/model"
 */
export type EmbeddingModelId =
  | 'openai/text-embedding-3-small'
  | 'openai/text-embedding-3-large'
  | 'openai/text-embedding-ada-002'
  | 'google/gemini-embedding-001';

/**
 * Check if a model ID is a known embedding model
 */
export function isKnownEmbeddingModel(modelId: string): boolean {
  return EMBEDDING_MODELS.some(m => m.id === modelId);
}

/**
 * Get information about a known embedding model
 */
export function getEmbeddingModelInfo(modelId: string): EmbeddingModelInfo | undefined {
  return EMBEDDING_MODELS.find(m => m.id === modelId);
}

/**
 * Model router for embedding models that uses the provider/model string format.
 * Automatically resolves the correct AI SDK provider and initializes the embedding model.
 *
 * @example
 * ```ts
 * const embedder = new ModelRouterEmbeddingModel('openai/text-embedding-3-small');
 * const result = await embedder.doEmbed({ values: ['hello world'] });
 * ```
 */
export class ModelRouterEmbeddingModel<VALUE extends string = string> implements EmbeddingModelV2<VALUE> {
  readonly specificationVersion = 'v2' as const;
  readonly modelId: string;
  readonly provider: string;
  maxEmbeddingsPerCall: number | PromiseLike<number | undefined> = 2048;
  supportsParallelCalls: boolean | PromiseLike<boolean> = true;

  private providerModel: EmbeddingModelV2<VALUE>;

  constructor(config: string | OpenAICompatibleConfig) {
    // Normalize config to always have provider and model IDs
    let normalizedConfig: {
      providerId: string;
      modelId: string;
      url?: string;
      apiKey?: string;
      headers?: Record<string, string>;
    };

    if (typeof config === 'string') {
      // Parse provider/model from string (e.g., "openai/text-embedding-3-small")
      const parts = config.split('/');
      if (parts.length !== 2) {
        throw new Error(`Invalid model string format: "${config}". Expected format: "provider/model"`);
      }
      const [providerId, modelId] = parts as [string, string];
      normalizedConfig = { providerId, modelId };
    } else if ('providerId' in config && 'modelId' in config) {
      normalizedConfig = {
        providerId: config.providerId,
        modelId: config.modelId,
        url: config.url,
        apiKey: config.apiKey,
        headers: config.headers,
      };
    } else {
      // config has 'id' field
      const parts = config.id.split('/');
      if (parts.length !== 2) {
        throw new Error(`Invalid model string format: "${config.id}". Expected format: "provider/model"`);
      }
      const [providerId, modelId] = parts as [string, string];
      normalizedConfig = {
        providerId,
        modelId,
        url: config.url,
        apiKey: config.apiKey,
        headers: config.headers,
      };
    }

    this.provider = normalizedConfig.providerId;
    this.modelId = normalizedConfig.modelId;

    // If custom URL is provided, skip provider registry validation
    // and use the provided API key (or empty string if not provided)
    if (normalizedConfig.url) {
      const apiKey = normalizedConfig.apiKey || '';
      this.providerModel = createOpenAICompatible({
        name: normalizedConfig.providerId,
        apiKey,
        baseURL: normalizedConfig.url,
        headers: normalizedConfig.headers,
      }).textEmbeddingModel(normalizedConfig.modelId) as EmbeddingModelV2<VALUE>;
    } else {
      // Get provider config from registry
      const registry = GatewayRegistry.getInstance();
      const providerConfig = registry.getProviderConfig(normalizedConfig.providerId);

      if (!providerConfig) {
        throw new Error(`Unknown provider: ${normalizedConfig.providerId}`);
      }

      // Get API key from config or environment
      let apiKey = normalizedConfig.apiKey;
      if (!apiKey) {
        const apiKeyEnvVar = providerConfig.apiKeyEnvVar;
        if (Array.isArray(apiKeyEnvVar)) {
          // Try each possible environment variable
          for (const envVar of apiKeyEnvVar) {
            apiKey = process.env[envVar];
            if (apiKey) break;
          }
        } else {
          apiKey = process.env[apiKeyEnvVar];
        }
      }

      if (!apiKey) {
        const envVarDisplay = Array.isArray(providerConfig.apiKeyEnvVar)
          ? providerConfig.apiKeyEnvVar.join(' or ')
          : providerConfig.apiKeyEnvVar;
        throw new Error(`API key not found for provider ${normalizedConfig.providerId}. Set ${envVarDisplay}`);
      }

      // Initialize the provider model directly in constructor
      if (normalizedConfig.providerId === 'openai') {
        this.providerModel = createOpenAI({ apiKey }).textEmbeddingModel(
          normalizedConfig.modelId,
        ) as EmbeddingModelV2<VALUE>;
      } else if (normalizedConfig.providerId === 'google') {
        this.providerModel = createGoogleGenerativeAI({ apiKey }).textEmbedding(
          normalizedConfig.modelId,
        ) as EmbeddingModelV2<VALUE>;
      } else {
        // Use OpenAI-compatible provider for other providers
        if (!providerConfig.url) {
          throw new Error(`Provider ${normalizedConfig.providerId} does not have a URL configured`);
        }
        this.providerModel = createOpenAICompatible({
          name: normalizedConfig.providerId,
          apiKey,
          baseURL: providerConfig.url,
        }).textEmbeddingModel(normalizedConfig.modelId) as EmbeddingModelV2<VALUE>;
      }
    }

    // Copy properties from the provider model if available
    if (this.providerModel.maxEmbeddingsPerCall !== undefined) {
      this.maxEmbeddingsPerCall = this.providerModel.maxEmbeddingsPerCall;
    }
    if (this.providerModel.supportsParallelCalls !== undefined) {
      this.supportsParallelCalls = this.providerModel.supportsParallelCalls;
    }
  }

  async doEmbed(
    args: Parameters<EmbeddingModelV2<VALUE>['doEmbed']>[0],
  ): Promise<Awaited<ReturnType<EmbeddingModelV2<VALUE>['doEmbed']>>> {
    const result = await this.providerModel.doEmbed(args);
    // Ensure warnings is always an array — AI SDK v6's embedMany spreads
    // result.warnings and crashes if it's undefined.
    const warnings = (result as { warnings?: unknown[] }).warnings ?? [];
    return { ...result, warnings } as Awaited<ReturnType<EmbeddingModelV2<VALUE>['doEmbed']>>;
  }
}
