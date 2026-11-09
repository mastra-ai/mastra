import { ErrorDomain, MastraError } from '../../error';

export const EMBEDDING_DIMENSION_MISMATCH_ERROR_ID = 'MASTRA_MEMORY_EMBEDDING_DIMENSION_MISMATCH';

/**
 * Throws when a configured `embeddingDimension` does not match the length of a real embedding.
 * Index names come from the configured value, so a mismatch would otherwise create an index
 * named for one dimension that holds vectors of another and split recall across two indexes.
 */
export function assertEmbeddingDimension(configured: number | undefined, actual: number | undefined): void {
  if (configured === undefined || actual === undefined || configured === actual) return;
  throw new MastraError({
    id: EMBEDDING_DIMENSION_MISMATCH_ERROR_ID,
    domain: ErrorDomain.MASTRA_MEMORY,
    category: 'USER',
    text: `Memory is configured with embeddingDimension ${configured}, but the embedder returned ${actual}-dimensional embeddings. Set embeddingDimension to ${actual} or remove it.`,
    details: { configured, actual },
  });
}

export function isEmbeddingDimensionMismatchError(error: unknown): boolean {
  return error instanceof MastraError && error.id === EMBEDDING_DIMENSION_MISMATCH_ERROR_ID;
}
