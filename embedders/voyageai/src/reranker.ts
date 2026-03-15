/**
 * VoyageAI Reranker
 *
 * Implements the RelevanceScoreProvider interface for use with Mastra's reranking system.
 * Uses VoyageAI's reranking models to score document relevance.
 */

import { VoyageAIClient } from 'voyageai';
import type {
  VoyageRerankerModel,
  VoyageRerankerConfig,
} from './types';

/**
 * RelevanceScoreProvider interface from @mastra/core
 * Defined here to avoid adding @mastra/core as a dependency
 */
export interface RelevanceScoreProvider {
  getRelevanceScore(text1: string, text2: string): Promise<number>;
}

/**
 * VoyageAI Relevance Scorer
 *
 * Implements RelevanceScoreProvider for use with Mastra's rerank() function.
 * Uses VoyageAI's dedicated reranking models which are optimized for
 * relevance scoring between queries and documents.
 *
 * @example
 * ```typescript
 * import { VoyageRelevanceScorer } from '@mastra/voyageai';
 * import { rerank } from '@mastra/rag';
 *
 * const scorer = new VoyageRelevanceScorer({ model: 'rerank-2.5' });
 *
 * // Use with Mastra's rerank function
 * const rerankedResults = await rerankWithScorer(
 *   vectorResults,
 *   'search query',
 *   scorer,
 *   { topK: 5 }
 * );
 * ```
 */
export class VoyageRelevanceScorer implements RelevanceScoreProvider {
  readonly modelId: string;

  private client: VoyageAIClient;
  private config: VoyageRerankerConfig;

  constructor(config: VoyageRerankerConfig) {
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
   * Get relevance score between a query and a document.
   *
   * @param query - The search query (text1)
   * @param document - The document to score (text2)
   * @returns Relevance score between 0 and 1
   */
  async getRelevanceScore(query: string, document: string): Promise<number> {
    const response = await this.client.rerank({
      query,
      documents: [document],
      model: this.modelId,
      topK: 1,
      truncation: this.config.truncation ?? true,
    });

    // Extract relevance score from response
    const result = response.data?.[0];
    if (!result || result.relevanceScore === undefined) {
      throw new Error('No relevance score found in VoyageAI response');
    }

    return result.relevanceScore;
  }

  /**
   * Rerank multiple documents against a query.
   *
   * This is more efficient than calling getRelevanceScore multiple times
   * as it makes a single API call for all documents.
   *
   * @param query - The search query
   * @param documents - Array of documents to rerank
   * @param topK - Optional number of top results to return
   * @returns Array of reranked results with scores
   */
  async rerankDocuments(
    query: string,
    documents: string[],
    topK?: number,
  ): Promise<Array<{ document: string; index: number; score: number }>> {
    const response = await this.client.rerank({
      query,
      documents,
      model: this.modelId,
      topK: topK,
      truncation: this.config.truncation ?? true,
    });

    // Map response to our format
    return (
      response.data?.map(item => ({
        document: documents[item.index ?? 0] ?? '',
        index: item.index ?? 0,
        score: item.relevanceScore ?? 0,
      })) ?? []
    );
  }
}

/**
 * Create a VoyageAI reranker/relevance scorer
 *
 * @param config - Reranker configuration or model name string
 * @returns VoyageRelevanceScorer instance
 *
 * @example
 * ```typescript
 * // With model name only
 * const reranker = createVoyageReranker('rerank-2.5');
 *
 * // With full config
 * const reranker = createVoyageReranker({
 *   model: 'rerank-2.5-lite',
 *   truncation: false,
 * });
 *
 * // Use with vector query tool
 * const tool = createVectorQueryTool({
 *   vectorStore,
 *   model: embedder,
 *   reranker: {
 *     model: reranker,
 *     options: { topK: 5 },
 *   },
 * });
 * ```
 */
export function createVoyageReranker(
  config: VoyageRerankerConfig | VoyageRerankerModel,
): VoyageRelevanceScorer {
  const normalizedConfig: VoyageRerankerConfig =
    typeof config === 'string' ? { model: config } : config;
  return new VoyageRelevanceScorer(normalizedConfig);
}

/**
 * Convenience alias for createVoyageReranker
 */
export const voyageReranker = createVoyageReranker;
