/**
 * @mastra/voyageai - VoyageAI Embeddings Integration for Mastra
 *
 * Provides text, multimodal, and contextualized chunk embeddings using the official VoyageAI SDK.
 *
 * @example Text Embeddings
 * ```typescript
 * import { voyage, voyageEmbedding } from '@mastra/voyageai';
 *
 * // Use default model (voyage-3.5)
 * const result = await voyage.doEmbed({ values: ['Hello world'] });
 *
 * // Or use specific model with options
 * const model = voyageEmbedding({
 *   model: 'voyage-3-large',
 *   inputType: 'query',
 *   outputDimension: 512,
 * });
 * ```
 *
 * @example With Mastra Memory
 * ```typescript
 * import { Memory } from '@mastra/memory';
 * import { PgVector } from '@mastra/pg';
 * import { voyage } from '@mastra/voyageai';
 *
 * const memory = new Memory({
 *   vector: new PgVector(connectionString),
 *   embedder: voyage,
 *   options: { semanticRecall: { topK: 5 } },
 * });
 * ```
 *
 * @example Multimodal Embeddings
 * ```typescript
 * import { voyageMultimodalEmbedding } from '@mastra/voyageai';
 *
 * const multimodal = voyageMultimodalEmbedding('voyage-multimodal-3.5');
 * const result = await multimodal.doEmbed({
 *   values: [{
 *     content: [
 *       { type: 'text', text: 'A cat playing' },
 *       { type: 'image_url', image_url: 'https://example.com/cat.jpg' }
 *     ]
 *   }]
 * });
 * ```
 *
 * @example Contextualized Chunk Embeddings
 * ```typescript
 * import { voyageContextualizedEmbedding } from '@mastra/voyageai';
 *
 * const contextual = voyageContextualizedEmbedding('voyage-context-3');
 * const result = await contextual.doEmbed({
 *   values: [
 *     ['Doc 1 chunk 1...', 'Doc 1 chunk 2...'],
 *     ['Doc 2 chunk 1...']
 *   ],
 *   inputType: 'document',
 * });
 * ```
 */

// Re-export all types
export * from './types';

// Re-export VoyageAIClient for use in @mastra/core embedding-router
export { VoyageAIClient } from 'voyageai';

// Re-export embedding model classes
export {
  VoyageTextEmbeddingModelV2,
  VoyageTextEmbeddingModelV3,
  createVoyageTextEmbedding,
  createVoyageTextEmbeddingV2,
} from './text-embedding';

export {
  VoyageMultimodalEmbeddingModel,
  createVoyageMultimodalEmbedding,
} from './multimodal-embedding';

export {
  VoyageContextualizedEmbeddingModel,
  createVoyageContextualizedEmbedding,
} from './contextualized-embedding';

export {
  VoyageRelevanceScorer,
  createVoyageReranker,
  voyageReranker,
  type RelevanceScoreProvider,
} from './reranker';

// Import for convenience object
import {
  createVoyageTextEmbedding,
  createVoyageTextEmbeddingV2,
  VoyageTextEmbeddingModelV3,
  VoyageTextEmbeddingModelV2,
} from './text-embedding';
import {
  createVoyageMultimodalEmbedding,
  VoyageMultimodalEmbeddingModel,
} from './multimodal-embedding';
import {
  createVoyageContextualizedEmbedding,
  VoyageContextualizedEmbeddingModel,
} from './contextualized-embedding';
import {
  createVoyageReranker,
  VoyageRelevanceScorer,
} from './reranker';

// ============================================================================
// Convenience Factory Functions
// ============================================================================

/**
 * Create a VoyageAI text embedding model (V3)
 *
 * @param config - Model name or full configuration
 * @returns EmbeddingModelV3 compatible model
 */
export const voyageEmbedding = createVoyageTextEmbedding;

/**
 * Create a VoyageAI text embedding model (V2)
 *
 * @param config - Model name or full configuration
 * @returns EmbeddingModelV2 compatible model
 */
export const voyageEmbeddingV2 = createVoyageTextEmbeddingV2;

/**
 * Create a VoyageAI multimodal embedding model
 *
 * @param config - Model name or full configuration
 * @returns VoyageMultimodalEmbeddingModel instance
 */
export const voyageMultimodalEmbedding = createVoyageMultimodalEmbedding;

/**
 * Create a VoyageAI contextualized chunk embedding model
 *
 * @param config - Model name or full configuration
 * @returns VoyageContextualizedEmbeddingModel instance
 */
export const voyageContextualizedEmbedding = createVoyageContextualizedEmbedding;

// ============================================================================
// Convenience Object with Pre-configured Models
// ============================================================================

/**
 * Pre-configured VoyageAI embedding models
 *
 * Default export provides the voyage-3.5 model as the default.
 * Access specific models through named properties.
 *
 * @example
 * ```typescript
 * import { voyage } from '@mastra/voyageai';
 *
 * // Default model (voyage-3.5)
 * const result = await voyage.doEmbed({ values: ['Hello'] });
 *
 * // Specific models
 * const largeResult = await voyage.large.doEmbed({ values: ['Hello'] });
 * const codeResult = await voyage.code.doEmbed({ values: ['function foo() {}'] });
 *
 * // Multimodal
 * const multimodalResult = await voyage.multimodal.doEmbed({
 *   values: [{ content: [{ type: 'text', text: 'Hello' }] }]
 * });
 *
 * // Contextualized
 * const contextResult = await voyage.contextualized.doEmbed({
 *   values: [['chunk1', 'chunk2']],
 *   inputType: 'document',
 * });
 * ```
 */
export const voyage: VoyageTextEmbeddingModelV3 & {
  // Text models (V3) - voyage-4 series
  v4large: VoyageTextEmbeddingModelV3;
  v4: VoyageTextEmbeddingModelV3;
  v4lite: VoyageTextEmbeddingModelV3;

  // Text models (V3) - voyage-3 series
  large: VoyageTextEmbeddingModelV3;
  v35: VoyageTextEmbeddingModelV3;
  v35lite: VoyageTextEmbeddingModelV3;
  code: VoyageTextEmbeddingModelV3;
  finance: VoyageTextEmbeddingModelV3;
  law: VoyageTextEmbeddingModelV3;

  // Text models (V2 for backward compatibility) - voyage-4 series
  v4largeV2: VoyageTextEmbeddingModelV2;
  v4V2: VoyageTextEmbeddingModelV2;
  v4liteV2: VoyageTextEmbeddingModelV2;

  // Text models (V2 for backward compatibility) - voyage-3 series
  largeV2: VoyageTextEmbeddingModelV2;
  v35V2: VoyageTextEmbeddingModelV2;
  v35liteV2: VoyageTextEmbeddingModelV2;
  codeV2: VoyageTextEmbeddingModelV2;
  financeV2: VoyageTextEmbeddingModelV2;
  lawV2: VoyageTextEmbeddingModelV2;

  // Multimodal models
  multimodal: VoyageMultimodalEmbeddingModel;
  multimodal3: VoyageMultimodalEmbeddingModel;
  multimodal35: VoyageMultimodalEmbeddingModel;

  // Contextualized model
  contextualized: VoyageContextualizedEmbeddingModel;
  context3: VoyageContextualizedEmbeddingModel;

  // Reranker models
  reranker: VoyageRelevanceScorer;
  reranker25: VoyageRelevanceScorer;
  reranker25lite: VoyageRelevanceScorer;
  reranker2: VoyageRelevanceScorer;
  reranker2lite: VoyageRelevanceScorer;

  // Factory functions
  embedding: typeof createVoyageTextEmbedding;
  embeddingV2: typeof createVoyageTextEmbeddingV2;
  multimodalEmbedding: typeof createVoyageMultimodalEmbedding;
  contextualizedEmbedding: typeof createVoyageContextualizedEmbedding;
  createReranker: typeof createVoyageReranker;
} = Object.assign(createVoyageTextEmbedding('voyage-3.5'), {
  // Text models (V3) - voyage-4 series
  v4large: createVoyageTextEmbedding('voyage-4-large'),
  v4: createVoyageTextEmbedding('voyage-4'),
  v4lite: createVoyageTextEmbedding('voyage-4-lite'),

  // Text models (V3) - voyage-3 series
  large: createVoyageTextEmbedding('voyage-3-large'),
  v35: createVoyageTextEmbedding('voyage-3.5'),
  v35lite: createVoyageTextEmbedding('voyage-3.5-lite'),
  code: createVoyageTextEmbedding('voyage-code-3'),
  finance: createVoyageTextEmbedding('voyage-finance-2'),
  law: createVoyageTextEmbedding('voyage-law-2'),

  // Text models (V2) - voyage-4 series for AI SDK v5 compatibility
  v4largeV2: createVoyageTextEmbeddingV2('voyage-4-large'),
  v4V2: createVoyageTextEmbeddingV2('voyage-4'),
  v4liteV2: createVoyageTextEmbeddingV2('voyage-4-lite'),

  // Text models (V2) - voyage-3 series for AI SDK v5 compatibility
  largeV2: createVoyageTextEmbeddingV2('voyage-3-large'),
  v35V2: createVoyageTextEmbeddingV2('voyage-3.5'),
  v35liteV2: createVoyageTextEmbeddingV2('voyage-3.5-lite'),
  codeV2: createVoyageTextEmbeddingV2('voyage-code-3'),
  financeV2: createVoyageTextEmbeddingV2('voyage-finance-2'),
  lawV2: createVoyageTextEmbeddingV2('voyage-law-2'),

  // Multimodal models
  multimodal: createVoyageMultimodalEmbedding('voyage-multimodal-3.5'),
  multimodal3: createVoyageMultimodalEmbedding('voyage-multimodal-3'),
  multimodal35: createVoyageMultimodalEmbedding('voyage-multimodal-3.5'),

  // Contextualized model
  contextualized: createVoyageContextualizedEmbedding('voyage-context-3'),
  context3: createVoyageContextualizedEmbedding('voyage-context-3'),

  // Reranker models
  reranker: createVoyageReranker('rerank-2.5'),
  reranker25: createVoyageReranker('rerank-2.5'),
  reranker25lite: createVoyageReranker('rerank-2.5-lite'),
  reranker2: createVoyageReranker('rerank-2'),
  reranker2lite: createVoyageReranker('rerank-2-lite'),

  // Factory functions for custom configurations
  embedding: createVoyageTextEmbedding,
  embeddingV2: createVoyageTextEmbeddingV2,
  multimodalEmbedding: createVoyageMultimodalEmbedding,
  contextualizedEmbedding: createVoyageContextualizedEmbedding,
  createReranker: createVoyageReranker,
});

// Default export
export default voyage;
