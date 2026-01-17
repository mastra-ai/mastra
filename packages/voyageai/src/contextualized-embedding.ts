/**
 * VoyageAI Contextualized Chunk Embedding Model
 *
 * Embeds text chunks with document context, addressing the "context loss" problem
 * that occurs when documents are split into individual chunks.
 *
 * Each chunk receives an embedding that reflects both its independent meaning
 * AND its position within the broader document context.
 */

import { VoyageAIClient } from 'voyageai';
import type {
  VoyageContextModel,
  VoyageContextualizedEmbeddingConfig,
  VoyageProviderOptions,
  VoyageInputType,
  VoyageOutputDimension,
  VoyageOutputDtype,
} from './types';

/**
 * Convert our input type to VoyageAI SDK's expected format
 */
function toSdkInputType(inputType: VoyageInputType | undefined): 'query' | 'document' | undefined {
  if (inputType === null) return undefined;
  return inputType;
}

/**
 * VoyageAI Contextualized Chunk Embedding Model
 *
 * Note: This does NOT implement EmbeddingModelV2<string> because contextualized
 * inputs have a different structure (string[][] vs string[]).
 *
 * Input format: Nested lists where each inner list contains related chunks
 * from the same document. Example:
 * ```
 * [
 *   ['chunk1_from_doc1', 'chunk2_from_doc1'],  // Document 1 chunks
 *   ['chunk1_from_doc2', 'chunk2_from_doc2'],  // Document 2 chunks
 * ]
 * ```
 *
 * @example
 * ```typescript
 * const model = new VoyageContextualizedEmbeddingModel({ model: 'voyage-context-3' });
 *
 * // Embed document chunks with context
 * const docResult = await model.doEmbed({
 *   values: [
 *     ['Leafy Inc Q2 2024...', 'Revenue grew 15%...'],
 *     ['Acme Corp announced...', 'The merger will...']
 *   ],
 *   inputType: 'document',
 * });
 *
 * // Embed a query (single item per inner list)
 * const queryResult = await model.doEmbed({
 *   values: [['What was Leafy Inc revenue growth?']],
 *   inputType: 'query',
 * });
 * ```
 */
export class VoyageContextualizedEmbeddingModel {
  readonly provider = 'voyage' as const;
  readonly modelId: string;
  readonly maxEmbeddingsPerCall = 1000; // Max inputs
  readonly maxTotalChunks = 16000; // Max total chunks across all inputs
  readonly supportsParallelCalls = true;

  private client: VoyageAIClient;
  private config: VoyageContextualizedEmbeddingConfig;

  constructor(config: VoyageContextualizedEmbeddingConfig) {
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
   * Generate contextualized embeddings for grouped chunks
   *
   * @param args.values - Nested array where each inner array contains chunks from the same document
   * @param args.inputType - 'query' for search queries, 'document' for content being indexed
   * @param args.outputDimension - Output embedding dimension (256, 512, 1024, or 2048)
   * @param args.outputDtype - Output data type
   * @param args.providerOptions - Runtime options to override config
   * @returns Object containing flattened embeddings array (one per chunk across all documents)
   */
  async doEmbed(args: {
    values: string[][];
    inputType?: VoyageInputType;
    outputDimension?: VoyageOutputDimension;
    outputDtype?: VoyageOutputDtype;
    abortSignal?: AbortSignal;
    headers?: Record<string, string>;
    providerOptions?: VoyageProviderOptions;
  }): Promise<{ embeddings: number[][]; chunkCounts: number[] }> {
    const { values, providerOptions } = args;

    // Merge config with runtime options (runtime takes precedence)
    const inputType = args.inputType ?? providerOptions?.voyage?.inputType ?? this.config.inputType;
    const outputDimension =
      args.outputDimension ?? providerOptions?.voyage?.outputDimension ?? this.config.outputDimension;
    const outputDtype =
      args.outputDtype ?? providerOptions?.voyage?.outputDtype ?? this.config.outputDtype;

    // Use the SDK's contextualizedEmbed method
    const response = await this.client.contextualizedEmbed({
      inputs: values,
      model: this.modelId,
      inputType: toSdkInputType(inputType),
      outputDimension: outputDimension,
      outputDtype: outputDtype,
    });

    // The SDK returns data grouped by input document
    // Each data item has a nested 'data' array containing embeddings for each chunk
    // Structure: response.data[docIndex].data[chunkIndex].embedding
    const sortedData = [...(response.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    // Flatten all embeddings and track chunk counts per document
    const allEmbeddings: number[][] = [];
    const chunkCounts: number[] = [];

    for (const item of sortedData) {
      // Each document item has a nested 'data' property with chunk embeddings
      const chunkData = item.data ?? [];
      const docEmbeddings = chunkData.map(chunk => chunk.embedding ?? []);
      chunkCounts.push(docEmbeddings.length);
      allEmbeddings.push(...docEmbeddings);
    }

    return { embeddings: allEmbeddings, chunkCounts };
  }

  /**
   * Generate contextualized embeddings and return grouped by document
   *
   * @param args - Same as doEmbed
   * @returns Embeddings grouped by document
   */
  async doEmbedGrouped(args: {
    values: string[][];
    inputType?: VoyageInputType;
    outputDimension?: VoyageOutputDimension;
    outputDtype?: VoyageOutputDtype;
    abortSignal?: AbortSignal;
    headers?: Record<string, string>;
    providerOptions?: VoyageProviderOptions;
  }): Promise<{ embeddingsByDocument: number[][][] }> {
    const { values, providerOptions } = args;

    const inputType = args.inputType ?? providerOptions?.voyage?.inputType ?? this.config.inputType;
    const outputDimension =
      args.outputDimension ?? providerOptions?.voyage?.outputDimension ?? this.config.outputDimension;
    const outputDtype =
      args.outputDtype ?? providerOptions?.voyage?.outputDtype ?? this.config.outputDtype;

    const response = await this.client.contextualizedEmbed({
      inputs: values,
      model: this.modelId,
      inputType: toSdkInputType(inputType),
      outputDimension: outputDimension,
      outputDtype: outputDtype,
    });

    // Sort by index and extract grouped embeddings
    // Structure: response.data[docIndex].data[chunkIndex].embedding
    const sortedData = [...(response.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const embeddingsByDocument = sortedData.map(item => {
      const chunkData = item.data ?? [];
      return chunkData.map(chunk => chunk.embedding ?? []);
    });

    return { embeddingsByDocument };
  }

  /**
   * Generate a query embedding (contextualized with itself)
   *
   * @param query - The search query text
   * @returns Single embedding vector
   */
  async embedQuery(query: string): Promise<number[]> {
    const result = await this.doEmbed({
      values: [[query]],
      inputType: 'query',
    });
    return result.embeddings[0] ?? [];
  }

  /**
   * Generate document chunk embeddings with context
   *
   * @param chunks - Array of text chunks from the same document
   * @returns Array of embeddings, one per chunk
   */
  async embedDocumentChunks(chunks: string[]): Promise<number[][]> {
    const result = await this.doEmbed({
      values: [chunks],
      inputType: 'document',
    });
    return result.embeddings;
  }
}

/**
 * Create a VoyageAI contextualized chunk embedding model
 *
 * @param config - Model configuration or model name string
 * @returns VoyageContextualizedEmbeddingModel instance
 *
 * @example
 * ```typescript
 * // With model name only
 * const model = createVoyageContextualizedEmbedding('voyage-context-3');
 *
 * // With full config
 * const model = createVoyageContextualizedEmbedding({
 *   model: 'voyage-context-3',
 *   outputDimension: 512,
 * });
 *
 * // Embed document chunks with context
 * const result = await model.doEmbed({
 *   values: [
 *     ['First paragraph of doc 1...', 'Second paragraph...'],
 *     ['Content from doc 2...']
 *   ],
 *   inputType: 'document',
 * });
 * ```
 */
export function createVoyageContextualizedEmbedding(
  config: VoyageContextualizedEmbeddingConfig | VoyageContextModel,
): VoyageContextualizedEmbeddingModel {
  const normalizedConfig: VoyageContextualizedEmbeddingConfig =
    typeof config === 'string' ? { model: config } : config;
  return new VoyageContextualizedEmbeddingModel(normalizedConfig);
}
