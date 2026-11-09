import { LRUCache } from 'lru-cache';

const DEFAULT_CACHE_MAX_SIZE = 1000;

/**
 * Process-wide cache of text embeddings, shared by the `SemanticRecall` processor and `Memory`.
 * When both write the same message in one run, the second writer reuses the first one's
 * embedding instead of calling the embedder again.
 *
 * Cache key format: `${embedderObjectId}:${modelId}:${providerOptionsHash}:${textHash}`
 * Cache value: embedding vector (number[])
 */
export const globalEmbeddingCache = new LRUCache<string, number[]>({
  max: DEFAULT_CACHE_MAX_SIZE,
});
