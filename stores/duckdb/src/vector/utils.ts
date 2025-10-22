/**
 * Utility functions for DuckDB vector operations
 */

/**
 * Validate vector dimensions
 */
export function validateVector(vector: number[], expectedDimension: number): void {
  if (!Array.isArray(vector)) {
    throw new Error('Vector must be an array of numbers');
  }

  if (vector.length !== expectedDimension) {
    throw new Error(`Vector dimension mismatch. Expected ${expectedDimension}, got ${vector.length}`);
  }

  for (let i = 0; i < vector.length; i++) {
    const value = vector[i];
    if (value === undefined || typeof value !== 'number' || !isFinite(value)) {
      throw new Error(`Invalid vector value at index ${i}: ${value}`);
    }
  }
}

/**
 * Normalize vector to unit length (for cosine similarity)
 */
export function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));

  if (magnitude === 0) {
    throw new Error('Cannot normalize zero vector');
  }

  return vector.map(val => val / magnitude);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    const aVal = a[i];
    const bVal = b[i];
    if (aVal === undefined || bVal === undefined) {
      throw new Error(`Invalid vector value at index ${i}`);
    }
    dotProduct += aVal * bVal;
    magnitudeA += aVal * aVal;
    magnitudeB += bVal * bVal;
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Calculate Euclidean distance between two vectors
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const aVal = a[i];
    const bVal = b[i];
    if (aVal === undefined || bVal === undefined) {
      throw new Error(`Invalid vector value at index ${i}`);
    }
    const diff = aVal - bVal;
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Calculate dot product between two vectors
 */
export function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let product = 0;
  for (let i = 0; i < a.length; i++) {
    const aVal = a[i];
    const bVal = b[i];
    if (aVal === undefined || bVal === undefined) {
      throw new Error(`Invalid vector value at index ${i}`);
    }
    product += aVal * bVal;
  }

  return product;
}

/**
 * Convert similarity score to distance
 */
export function similarityToDistance(similarity: number, metric: 'cosine' | 'euclidean' | 'dot'): number {
  switch (metric) {
    case 'cosine':
      // Cosine similarity ranges from -1 to 1, convert to distance [0, 2]
      return 1 - similarity;
    case 'euclidean':
      // Already a distance metric
      return similarity;
    case 'dot':
      // Dot product can be negative, convert to positive distance
      return -similarity;
    default:
      return similarity;
  }
}

/**
 * Chunk array into batches
 */
export function chunkArray<T>(array: T[], batchSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    chunks.push(array.slice(i, i + batchSize));
  }
  return chunks;
}

/**
 * Generate a unique ID
 */
export function generateId(prefix = 'vec'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
  } = {},
): Promise<T> {
  const { maxRetries = 3, initialDelay = 100, maxDelay = 5000, backoffFactor = 2 } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        throw lastError;
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Parse dimension from vector type string
 */
export function parseDimension(vectorType: string): number {
  const match = vectorType.match(/FLOAT\[(\d+)\]/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  throw new Error(`Invalid vector type: ${vectorType}`);
}

/**
 * Validate index name
 */
export function validateIndexName(name: string): void {
  if (!name || typeof name !== 'string') {
    throw new Error('Index name must be a non-empty string');
  }

  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    throw new Error(
      'Index name must start with a letter and contain only alphanumeric characters, underscores, and hyphens',
    );
  }

  if (name.length > 63) {
    throw new Error('Index name must be 63 characters or less');
  }
}

/**
 * Convert metadata object to JSON string with validation
 */
export function serializeMetadata(metadata: any): string {
  try {
    return JSON.stringify(metadata);
  } catch (error) {
    throw new Error(`Failed to serialize metadata: ${error}`);
  }
}

/**
 * Parse JSON metadata with error handling
 */
export function parseMetadata(metadataStr: string): any {
  if (!metadataStr) return {};

  try {
    return JSON.parse(metadataStr);
  } catch (error) {
    console.warn(`Failed to parse metadata: ${error}`);
    return {};
  }
}

/**
 * Check if value is a valid vector
 */
export function isValidVector(value: any): boolean {
  return Array.isArray(value) && value.length > 0 && value.every(v => typeof v === 'number' && isFinite(v));
}

/**
 * Calculate memory usage estimate for vectors
 */
export function estimateMemoryUsage(numVectors: number, dimension: number, includeIndex = true): number {
  // Each float is 4 bytes
  const vectorSize = dimension * 4;
  const totalVectorSize = numVectors * vectorSize;

  // Estimate metadata overhead (ID, metadata JSON, timestamps)
  const metadataOverhead = numVectors * 200; // ~200 bytes per record

  // HNSW index overhead (approximately 1.2x the vector data)
  const indexOverhead = includeIndex ? totalVectorSize * 0.2 : 0;

  return totalVectorSize + metadataOverhead + indexOverhead;
}

/**
 * Create batched executor for parallel processing
 */
export async function executeBatched<T, R>(
  items: T[],
  processor: (batch: T[]) => Promise<R[]>,
  options: {
    batchSize?: number;
    parallel?: boolean;
    onProgress?: (processed: number, total: number) => void;
  } = {},
): Promise<R[]> {
  const { batchSize = 1000, parallel = true, onProgress } = options;

  const batches = chunkArray(items, batchSize);
  const results: R[] = [];
  let processed = 0;

  if (parallel) {
    // Track completed items atomically to avoid race conditions
    let completedItems = 0;

    const batchResults = await Promise.all(
      batches.map(async batch => {
        const result = await processor(batch);

        // Increment completed items (Note: this is safe in Node.js single-threaded event loop,
        // but multiple promises may report progress in non-deterministic order)
        completedItems += batch.length;
        onProgress?.(completedItems, items.length);

        return result;
      }),
    );
    return batchResults.flat();
  } else {
    for (const batch of batches) {
      const batchResult = await processor(batch);
      results.push(...batchResult);
      processed += batch.length;
      onProgress?.(processed, items.length);
    }
    return results;
  }
}
