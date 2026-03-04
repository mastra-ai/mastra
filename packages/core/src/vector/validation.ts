/**
 * Shared validation helpers for vector store implementations
 *
 * These helpers provide consistent validation across all vector stores,
 * reducing code duplication and ensuring uniform error handling.
 */

import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import { createVectorErrorId } from '../storage';

/**
 * Validates upsert input parameters
 *
 * @param storeName - Name of the vector store (e.g., 'PG', 'CHROMA')
 * @param vectors - Array of vectors to upsert
 * @param metadata - Optional metadata array
 * @param ids - Optional ids array
 * @throws MastraError if validation fails
 */
export function validateUpsertInput(
  storeName: string,
  vectors: number[][] | undefined | null,
  metadata?: Record<string, any>[] | null,
  ids?: string[] | null,
): void {
  // Validate vectors array is not empty
  if (!vectors || vectors.length === 0) {
    throw new MastraError({
      id: createVectorErrorId(storeName, 'UPSERT', 'EMPTY_VECTORS'),
      domain: ErrorDomain.MASTRA_VECTOR,
      category: ErrorCategory.USER,
      details: {
        message: 'Vectors array cannot be empty',
      },
    });
  }

  // Validate metadata length matches vectors length (skip if metadata is empty/not provided)
  if (metadata && metadata.length > 0 && metadata.length !== vectors.length) {
    throw new MastraError({
      id: createVectorErrorId(storeName, 'UPSERT', 'METADATA_LENGTH_MISMATCH'),
      domain: ErrorDomain.MASTRA_VECTOR,
      category: ErrorCategory.USER,
      details: {
        message: 'Metadata array length must match vectors array length',
        vectorsLength: vectors.length,
        metadataLength: metadata.length,
      },
    });
  }

  // Validate ids length matches vectors length
  if (ids && ids.length !== vectors.length) {
    throw new MastraError({
      id: createVectorErrorId(storeName, 'UPSERT', 'IDS_LENGTH_MISMATCH'),
      domain: ErrorDomain.MASTRA_VECTOR,
      category: ErrorCategory.USER,
      details: {
        message: 'IDs array length must match vectors array length',
        vectorsLength: vectors.length,
        idsLength: ids.length,
      },
    });
  }
}

/**
 * Validates topK parameter for queries
 *
 * @param storeName - Name of the vector store (e.g., 'PG', 'CHROMA')
 * @param topK - Number of results to return
 * @throws MastraError if topK is not a positive integer
 */
export function validateTopK(storeName: string, topK: number): void {
  if (!Number.isInteger(topK) || topK <= 0) {
    throw new MastraError({
      id: createVectorErrorId(storeName, 'QUERY', 'INVALID_TOP_K'),
      domain: ErrorDomain.MASTRA_VECTOR,
      category: ErrorCategory.USER,
      details: {
        message: 'topK must be a positive integer',
        topK,
      },
    });
  }
}

/**
 * Validates vector components for NaN/Infinity values
 *
 * @param storeName - Name of the vector store (e.g., 'PG', 'CHROMA')
 * @param vectors - Array of vectors to validate
 * @throws MastraError if any vector contains NaN, Infinity, null, or undefined
 */
export function validateVectorValues(storeName: string, vectors: number[][]): void {
  for (let i = 0; i < vectors.length; i++) {
    const vector = vectors[i];

    if (!vector) {
      throw new MastraError({
        id: createVectorErrorId(storeName, 'UPSERT', 'INVALID_VECTOR'),
        domain: ErrorDomain.MASTRA_VECTOR,
        category: ErrorCategory.USER,
        details: {
          message: `Vector at index ${i} is null or undefined`,
          vectorIndex: i,
        },
      });
    }

    for (let j = 0; j < vector.length; j++) {
      const value = vector[j];

      if (value === null || value === undefined || !Number.isFinite(value)) {
        throw new MastraError({
          id: createVectorErrorId(storeName, 'UPSERT', 'INVALID_VECTOR_VALUE'),
          domain: ErrorDomain.MASTRA_VECTOR,
          category: ErrorCategory.USER,
          details: {
            message: `Vector contains invalid value (null, undefined, NaN, or Infinity) at position [${i}][${j}]`,
            vectorIndex: i,
            componentIndex: j,
            value: String(value),
          },
        });
      }
    }
  }
}

/**
 * Validates all upsert inputs including vector values
 * Combines validateUpsertInput and validateVectorValues
 *
 * @param storeName - Name of the vector store (e.g., 'PG', 'CHROMA')
 * @param vectors - Array of vectors to upsert
 * @param metadata - Optional metadata array
 * @param ids - Optional ids array
 * @param validateValues - Whether to validate vector values for NaN/Infinity (default: false)
 * @throws MastraError if validation fails
 */
export function validateUpsert(
  storeName: string,
  vectors: number[][] | undefined | null,
  metadata?: Record<string, any>[] | null,
  ids?: string[] | null,
  validateValues = false,
): void {
  validateUpsertInput(storeName, vectors, metadata, ids);

  if (validateValues && vectors) {
    validateVectorValues(storeName, vectors);
  }
}
