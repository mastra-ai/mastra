/**
 * VoyageAI Multimodal Embedding Models
 *
 * Supports text + images + video (voyage-multimodal-3.5 only) embeddings.
 * Note: This uses a custom interface since the input format differs from text embeddings.
 */

import { VoyageAIClient } from 'voyageai';
import type {
  VoyageMultimodalModel,
  VoyageMultimodalEmbeddingConfig,
  VoyageMultimodalInput,
  VoyageMultimodalContent,
  VoyageProviderOptions,
  VoyageInputType,
} from './types';

/**
 * Convert our content format to VoyageAI SDK format
 */
function toSdkContent(content: VoyageMultimodalContent): unknown {
  switch (content.type) {
    case 'text':
      return content.text;
    case 'image_url':
      return { type: 'image_url', image_url: content.image_url };
    case 'image_base64':
      return { type: 'image_base64', image_base64: content.image_base64 };
    case 'video_url':
      return { type: 'video_url', video_url: content.video_url };
    default:
      throw new Error(`Unknown content type: ${(content as any).type}`);
  }
}

/**
 * Convert multimodal input to SDK format
 */
function toSdkInput(input: VoyageMultimodalInput): unknown[] {
  return input.content.map(toSdkContent);
}

/**
 * Convert our input type to VoyageAI SDK's expected format
 */
function toSdkInputType(inputType: VoyageInputType | undefined): 'query' | 'document' | undefined {
  if (inputType === null) return undefined;
  return inputType;
}

/**
 * VoyageAI Multimodal Embedding Model
 *
 * Note: This does NOT implement EmbeddingModelV2<string> because multimodal
 * inputs have a different structure (VoyageMultimodalInput vs string).
 * Use directly with vector stores for multimodal RAG pipelines.
 *
 * @example
 * ```typescript
 * const model = new VoyageMultimodalEmbeddingModel({ model: 'voyage-multimodal-3.5' });
 *
 * const result = await model.doEmbed({
 *   values: [{
 *     content: [
 *       { type: 'text', text: 'A photo of a cat' },
 *       { type: 'image_url', image_url: 'https://example.com/cat.jpg' }
 *     ]
 *   }]
 * });
 *
 * // Use embeddings with vector store
 * await vectorStore.upsert({ vectors: result.embeddings, ... });
 * ```
 */
export class VoyageMultimodalEmbeddingModel {
  readonly provider = 'voyage' as const;
  readonly modelId: string;
  readonly maxEmbeddingsPerCall = 1000;
  readonly supportsParallelCalls = true;

  private client: VoyageAIClient;
  private config: VoyageMultimodalEmbeddingConfig;

  constructor(config: VoyageMultimodalEmbeddingConfig) {
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
   * Generate embeddings for multimodal inputs
   *
   * @param args.values - Array of multimodal inputs, each containing interleaved content
   * @param args.providerOptions - Runtime options to override config
   * @returns Object containing embeddings array
   */
  async doEmbed(args: {
    values: VoyageMultimodalInput[];
    abortSignal?: AbortSignal;
    headers?: Record<string, string>;
    providerOptions?: VoyageProviderOptions;
  }): Promise<{ embeddings: number[][] }> {
    const { values, providerOptions } = args;

    // Merge config with runtime providerOptions
    const inputType = providerOptions?.voyage?.inputType ?? this.config.inputType;
    const truncation = providerOptions?.voyage?.truncation ?? this.config.truncation ?? true;

    // Convert inputs to SDK format
    const sdkInputs = values.map(toSdkInput);

    // Use the SDK's multimodalEmbed method
    // Note: The `as any` cast is necessary because the SDK's type definitions don't properly
    // type the flexible multimodal input structure. The SDK accepts mixed content types:
    // - strings for text content
    // - objects like { type: 'image_url', image_url: '...' } for images/video
    // Our internal `unknown[]` return type from toSdkInput needs to bridge to the SDK's
    // expected `any[][]` format for the multimodal inputs parameter.
    const response = await this.client.multimodalEmbed({
      inputs: sdkInputs as any,
      model: this.modelId,
      inputType: toSdkInputType(inputType),
      truncation: truncation,
    });

    // Extract embeddings from response
    const embeddings = response.data
      ?.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map(item => item.embedding ?? []) ?? [];

    return { embeddings };
  }

  /**
   * Generate a single embedding for a multimodal input
   *
   * @param input - Single multimodal input
   * @returns Single embedding vector
   */
  async embedOne(input: VoyageMultimodalInput): Promise<number[]> {
    const result = await this.doEmbed({ values: [input] });
    return result.embeddings[0] ?? [];
  }
}

/**
 * Create a VoyageAI multimodal embedding model
 *
 * @param config - Model configuration or model name string
 * @returns VoyageMultimodalEmbeddingModel instance
 *
 * @example
 * ```typescript
 * // With model name only
 * const model = createVoyageMultimodalEmbedding('voyage-multimodal-3.5');
 *
 * // With full config
 * const model = createVoyageMultimodalEmbedding({
 *   model: 'voyage-multimodal-3.5',
 *   inputType: 'document',
 * });
 *
 * // Embed text + image
 * const result = await model.doEmbed({
 *   values: [{
 *     content: [
 *       { type: 'text', text: 'Product description' },
 *       { type: 'image_base64', image_base64: base64ImageData }
 *     ]
 *   }]
 * });
 * ```
 */
export function createVoyageMultimodalEmbedding(
  config: VoyageMultimodalEmbeddingConfig | VoyageMultimodalModel,
): VoyageMultimodalEmbeddingModel {
  const normalizedConfig: VoyageMultimodalEmbeddingConfig =
    typeof config === 'string' ? { model: config } : config;
  return new VoyageMultimodalEmbeddingModel(normalizedConfig);
}
