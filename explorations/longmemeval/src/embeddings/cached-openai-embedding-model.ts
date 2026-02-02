import { EmbeddingModelV2, TooManyEmbeddingValuesForCallError } from '@ai-sdk/provider';
import { xxh3 } from '@node-rs/xxhash';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { OpenAIEmbedding } from '@ai-sdk/openai';
import { Mutex } from 'async-mutex';

// Global cache statistics
export const embeddingCacheStats = {
  cacheHits: 0,
  cacheMisses: 0,
  cacheWrites: 0,
  reset() {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.cacheWrites = 0;
  },
};

export class CachedOpenAIEmbeddingModel implements EmbeddingModelV2<string> {
  readonly specificationVersion = 'v2';
  readonly modelId: string;
  readonly maxEmbeddingsPerCall = 2048;
  readonly supportsParallelCalls = true;

  private readonly cacheDir: string;
  private readonly delegate: EmbeddingModelV2<string>;
  private memoryCache: Map<string, number[]> = new Map();
  private readonly fileOperationMutex = new Mutex();

  get provider(): string {
    return this.delegate.provider;
  }

  constructor(delegate: EmbeddingModelV2<string>, cacheDir: string = './embedding-cache') {
    this.delegate = delegate;
    this.modelId = delegate.modelId;
    this.cacheDir = cacheDir;

    // Ensure cache directory exists
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }

    // Load existing cache into memory
    this.loadMemoryCache();
  }

  private getCacheKey(value: string): string {
    // Use XXHash3 for ultra-fast hashing
    const combined = `${this.modelId}:${value}`;
    const hash = xxh3.xxh128(combined).toString(16).padStart(32, '0');
    return hash;
  }

  private getCachePath(key: string): string {
    // Split cache files into subdirectories to avoid too many files in one directory
    const subdir = key.substring(0, 2);
    const dir = join(this.cacheDir, subdir);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    return join(dir, `${key}.json`);
  }

  private loadMemoryCache(): void {
    // This could be optimized to load lazily or with a size limit
    // console.log('Loading embedding cache into memory...');
  }

  private async getCachedEmbedding(value: string): Promise<number[] | null> {
    const key = this.getCacheKey(value);

    // Check memory cache first
    if (this.memoryCache.has(key)) {
      embeddingCacheStats.cacheHits++;
      return this.memoryCache.get(key)!;
    }

    // Check file cache with mutex
    const cachePath = this.getCachePath(key);
    const embedding = await this.fileOperationMutex.runExclusive(async () => {
      // Double-check memory cache in case another thread loaded it
      if (this.memoryCache.has(key)) {
        return this.memoryCache.get(key)!;
      }

      if (existsSync(cachePath)) {
        try {
          const content = readFileSync(cachePath, 'utf-8');
          const cached = JSON.parse(content);
          return cached.embedding;
        } catch (e) {
          // If JSON is corrupted, delete the file
          console.warn(`Corrupted cache file ${cachePath}, deleting...`);
          try {
            require('fs').unlinkSync(cachePath);
          } catch (deleteError) {
            // Ignore delete errors
          }
          return null;
        }
      }
      return null;
    });

    if (embedding) {
      this.memoryCache.set(key, embedding);
      embeddingCacheStats.cacheHits++;
      return embedding;
    }

    embeddingCacheStats.cacheMisses++;
    return null;
  }

  private cacheEmbedding(value: string, embedding: number[]): void {
    const key = this.getCacheKey(value);

    // Store in memory cache immediately
    this.memoryCache.set(key, embedding);
    embeddingCacheStats.cacheWrites++;

    // Store in file cache asynchronously with mutex (fire and forget)
    this.fileOperationMutex
      .runExclusive(async () => {
        const cachePath = this.getCachePath(key);
        try {
          const data = JSON.stringify({
            value: value,
            embedding: embedding,
            modelId: this.modelId,
            timestamp: new Date().toISOString(),
          });

          // Write to temp file first, then rename (atomic operation)
          const tempPath = `${cachePath}.tmp`;
          writeFileSync(tempPath, data);
          require('fs').renameSync(tempPath, cachePath);
        } catch (e) {
          // console.warn(`Failed to cache embedding for ${key}:`, e);
          // Clean up temp file if it exists
          try {
            require('fs').unlinkSync(`${cachePath}.tmp`);
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
        }
      })
      .catch(() => {
        // Ignore write errors
      });
  }

  async doEmbed({
    values,
    headers,
    abortSignal,
    providerOptions,
  }: Parameters<EmbeddingModelV2<string>['doEmbed']>[0]): Promise<
    Awaited<ReturnType<EmbeddingModelV2<string>['doEmbed']>>
  > {
    if (values.length > this.maxEmbeddingsPerCall) {
      throw new TooManyEmbeddingValuesForCallError({
        provider: this.provider,
        modelId: this.modelId,
        maxEmbeddingsPerCall: this.maxEmbeddingsPerCall,
        values,
      });
    }

    const embeddings: number[][] = [];
    const uncachedValues: string[] = [];
    const uncachedIndices: number[] = [];

    // Check cache for each value
    for (let i = 0; i < values.length; i++) {
      const cached = await this.getCachedEmbedding(values[i]);
      if (cached) {
        embeddings[i] = cached;
      } else {
        uncachedValues.push(values[i]);
        uncachedIndices.push(i);
      }
    }

    let usage = { tokens: 0 };
    let responseHeaders: Record<string, string> = {};
    let rawValue: any = {};

    // If we have uncached values, fetch them from the API
    if (uncachedValues.length > 0) {
      // console.log(`Fetching ${uncachedValues.length} uncached embeddings (${values.length - uncachedValues.length} cached)`);

      const result = await this.delegate.doEmbed({
        values: uncachedValues,
        headers,
        abortSignal,
        providerOptions,
      });

      // Cache the new embeddings and add them to our results
      for (let i = 0; i < uncachedValues.length; i++) {
        const value = uncachedValues[i];
        const embedding = result.embeddings[i];
        const originalIndex = uncachedIndices[i];

        this.cacheEmbedding(value, embedding);
        embeddings[originalIndex] = embedding;
      }

      usage = result.usage || { tokens: 0 };
      responseHeaders = result.response?.headers || {};
      rawValue = result.response?.body || {};
    } else {
      // console.log(`All ${values.length} embeddings served from cache`);
      // Yield to prevent blocking when everything is cached
      await new Promise(resolve => setImmediate(resolve));
    }

    return {
      embeddings,
      usage,
      response: { headers: responseHeaders, body: rawValue },
    };
  }
}
