import { LRUCache } from 'lru-cache';

const DEFAULT_CACHE_MAX_SIZE = 1000;

/**
 * Global embedding cache shared across all SemanticRecall instances.
 * This ensures embeddings are cached and reused even when new processor
 * instances are created.
 *
 * Cache key format: `${indexName}:${contentHash}`
 * Cache value: embedding vector (number[])
 */
export const globalEmbeddingCache = new LRUCache<string, number[]>({
  max: DEFAULT_CACHE_MAX_SIZE,
});
