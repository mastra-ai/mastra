/**
 * VoyageAI Text Embedding Models
 *
 * Implements EmbeddingModelV2 and EmbeddingModelV3 interfaces for Mastra integration.
 */

import { VoyageAIClient } from 'voyageai';
import type {
  VoyageTextModel,
  VoyageTextEmbeddingConfig,
  VoyageProviderOptions,
  VoyageInputType,
} from './types';

/**
 * Convert our input type to VoyageAI SDK's expected format
 */
function toSdkInputType(inputType: VoyageInputType | undefined): 'query' | 'document' | undefined {
  if (inputType === null) return undefined;
  return inputType;
}

/**
 * VoyageAI Text Embedding Model - V2 Implementation
 *
 * Implements the EmbeddingModelV2 interface from AI SDK v5.
 */
export class VoyageTextEmbeddingModelV2 {
  readonly specificationVersion = 'v2' as const;
  readonly provider = 'voyage' as const;
  readonly modelId: string;
  readonly maxEmbeddingsPerCall = 1000; // VoyageAI supports up to 1000 inputs per API call
  readonly supportsParallelCalls = true;

  private client: VoyageAIClient;
  private config: VoyageTextEmbeddingConfig;

  constructor(config: VoyageTextEmbeddingConfig) {
    this.modelId = config.model;
    this.config = config;

    const apiKey = config.apiKey || process.env.VOYAGE_API_KEY;
    if (!apiKey) {
      throw new Error(
        'VoyageAI API key is required. Set VOYAGE_API_KEY environment variable or pass apiKey in config.',
      );
    }

    this.client = new VoyageAIClient({ apiKey });
  }

  /**
   * Generate embeddings for the provided text values
   */
  async doEmbed(args: {
    values: string[];
    abortSignal?: AbortSignal;
    headers?: Record<string, string>;
    providerOptions?: VoyageProviderOptions;
  }): Promise<{ embeddings: number[][] }> {
    const { values, providerOptions } = args;

    // Merge config with runtime providerOptions (providerOptions take precedence)
    const inputType = providerOptions?.voyage?.inputType ?? this.config.inputType;
    const outputDimension = providerOptions?.voyage?.outputDimension ?? this.config.outputDimension;
    const outputDtype = providerOptions?.voyage?.outputDtype ?? this.config.outputDtype;
    const truncation = providerOptions?.voyage?.truncation ?? this.config.truncation ?? true;

    const response = await this.client.embed({
      input: values,
      model: this.modelId,
      inputType: toSdkInputType(inputType),
      outputDimension: outputDimension,
      outputDtype: outputDtype,
      truncation: truncation,
    });

    // Extract embeddings from response
    // The SDK returns { data: [{ embedding: number[], index: number }], ... }
    const embeddings = response.data
      ?.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map(item => item.embedding ?? []) ?? [];

    return { embeddings };
  }
}

/**
 * VoyageAI Text Embedding Model - V3 Implementation
 *
 * Implements the EmbeddingModelV3 interface from AI SDK v6.
 * Wraps V2 implementation and adds warnings array.
 */
export class VoyageTextEmbeddingModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider = 'voyage' as const;
  readonly modelId: string;
  readonly maxEmbeddingsPerCall = 1000; // VoyageAI supports up to 1000 inputs per API call
  readonly supportsParallelCalls = true;

  private v2Model: VoyageTextEmbeddingModelV2;

  constructor(config: VoyageTextEmbeddingConfig) {
    this.modelId = config.model;
    this.v2Model = new VoyageTextEmbeddingModelV2(config);
  }

  /**
   * Generate embeddings for the provided text values
   */
  async doEmbed(args: {
    values: string[];
    abortSignal?: AbortSignal;
    headers?: Record<string, string>;
    providerOptions?: VoyageProviderOptions;
  }): Promise<{ embeddings: number[][]; warnings: never[] }> {
    const result = await this.v2Model.doEmbed(args);
    return { ...result, warnings: [] };
  }
}

/**
 * Create a VoyageAI text embedding model (V3)
 *
 * @param config - Model configuration or model name string
 * @returns EmbeddingModelV3 compatible model
 *
 * @example
 * ```typescript
 * // With model name only
 * const model = createVoyageTextEmbedding('voyage-3.5');
 *
 * // With full config
 * const model = createVoyageTextEmbedding({
 *   model: 'voyage-3-large',
 *   inputType: 'query',
 *   outputDimension: 512,
 * });
 * ```
 */
export function createVoyageTextEmbedding(
  config: VoyageTextEmbeddingConfig | VoyageTextModel,
): VoyageTextEmbeddingModelV3 {
  const normalizedConfig: VoyageTextEmbeddingConfig =
    typeof config === 'string' ? { model: config } : config;
  return new VoyageTextEmbeddingModelV3(normalizedConfig);
}

/**
 * Create a VoyageAI text embedding model (V2)
 *
 * @param config - Model configuration or model name string
 * @returns EmbeddingModelV2 compatible model
 *
 * @example
 * ```typescript
 * const model = createVoyageTextEmbeddingV2('voyage-3.5');
 * ```
 */
export function createVoyageTextEmbeddingV2(
  config: VoyageTextEmbeddingConfig | VoyageTextModel,
): VoyageTextEmbeddingModelV2 {
  const normalizedConfig: VoyageTextEmbeddingConfig =
    typeof config === 'string' ? { model: config } : config;
  return new VoyageTextEmbeddingModelV2(normalizedConfig);
}
