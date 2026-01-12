import { createGoogleGenerativeAI } from '@ai-sdk/google-v5';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v5';
import { createOpenAI } from '@ai-sdk/openai-v5';
import type { EmbeddingModelV2 } from '@internal/ai-sdk-v5';

import { GatewayRegistry } from './provider-registry.js';
import type { OpenAICompatibleConfig } from './shared.types.js';

/**
 * Creates a VoyageAI embedding model wrapper that implements EmbeddingModelV2.
 * Uses the official VoyageAI SDK internally.
 *
 * @param modelId - The VoyageAI model ID (e.g., 'voyage-3.5', 'voyage-3-large')
 * @param apiKey - The VoyageAI API key
 * @returns An EmbeddingModelV2-compatible model
 */
function createVoyageEmbeddingModel(modelId: string, apiKey: string): EmbeddingModelV2<string> {
  // Lazy import to avoid bundling voyageai if not used
  // This allows the package to be optional
  let VoyageAIClient: any;
  try {
    // Try to import the voyageai package
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    VoyageAIClient = require('voyageai').VoyageAIClient;
  } catch {
    throw new Error(
      'VoyageAI SDK not found. Please install the voyageai package: npm install voyageai\n' +
        'Or use @mastra/voyageai for a more integrated experience: npm install @mastra/voyageai',
    );
  }

  const client = new VoyageAIClient({ apiKey });

  return {
    specificationVersion: 'v2',
    provider: 'voyage',
    modelId,
    maxEmbeddingsPerCall: 128,
    supportsParallelCalls: true,

    async doEmbed({ values }: { values: string[] }): Promise<{ embeddings: number[][] }> {
      const response = await client.embed({
        input: values,
        model: modelId,
      });

      // Extract embeddings from response, sorted by index
      const embeddings =
        response.data
          ?.sort((a: { index?: number }, b: { index?: number }) => (a.index ?? 0) - (b.index ?? 0))
          .map((item: { embedding?: number[] }) => item.embedding ?? []) ?? [];

      return { embeddings };
    },
  };
}

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
  {
    id: 'text-embedding-004',
    provider: 'google',
    dimensions: 768,
    maxInputTokens: 3072,
    description: 'Google text-embedding-004 model',
  },
  // VoyageAI
  {
    id: 'voyage-3-large',
    provider: 'voyage',
    dimensions: 1024,
    maxInputTokens: 32000,
    description: 'VoyageAI voyage-3-large - best quality general-purpose and multilingual',
  },
  {
    id: 'voyage-3.5',
    provider: 'voyage',
    dimensions: 1024,
    maxInputTokens: 32000,
    description: 'VoyageAI voyage-3.5 - balanced quality and speed',
  },
  {
    id: 'voyage-3.5-lite',
    provider: 'voyage',
    dimensions: 1024,
    maxInputTokens: 32000,
    description: 'VoyageAI voyage-3.5-lite - optimized for latency and cost',
  },
  {
    id: 'voyage-code-3',
    provider: 'voyage',
    dimensions: 1024,
    maxInputTokens: 32000,
    description: 'VoyageAI voyage-code-3 - optimized for code retrieval',
  },
  {
    id: 'voyage-finance-2',
    provider: 'voyage',
    dimensions: 1024,
    maxInputTokens: 32000,
    description: 'VoyageAI voyage-finance-2 - optimized for financial domain',
  },
  {
    id: 'voyage-law-2',
    provider: 'voyage',
    dimensions: 1024,
    maxInputTokens: 32000,
    description: 'VoyageAI voyage-law-2 - optimized for legal domain',
  },
];

/**
 * Type for embedding model IDs in the format "provider/model"
 */
export type EmbeddingModelId =
  | 'openai/text-embedding-3-small'
  | 'openai/text-embedding-3-large'
  | 'openai/text-embedding-ada-002'
  | 'google/gemini-embedding-001'
  | 'google/text-embedding-004'
  | 'voyage/voyage-3-large'
  | 'voyage/voyage-3.5'
  | 'voyage/voyage-3.5-lite'
  | 'voyage/voyage-code-3'
  | 'voyage/voyage-finance-2'
  | 'voyage/voyage-law-2';

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
      } else if (normalizedConfig.providerId === 'voyage') {
        // VoyageAI uses its own SDK - create a simple wrapper that implements EmbeddingModelV2
        // Note: Requires @mastra/voyageai or voyageai package to be installed
        this.providerModel = createVoyageEmbeddingModel(normalizedConfig.modelId, apiKey) as EmbeddingModelV2<VALUE>;
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
    return this.providerModel.doEmbed(args);
  }
}
