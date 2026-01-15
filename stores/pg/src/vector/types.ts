export type IndexType = 'ivfflat' | 'hnsw' | 'flat';

/**
 * pgvector storage types for embeddings.
 * - 'vector': Full precision (4 bytes per dimension), max 2000 dimensions for indexes
 * - 'halfvec': Half precision (2 bytes per dimension), max 4000 dimensions for indexes
 * - 'bit': Binary vectors (1 bit per dimension), max 64,000 dimensions for indexes
 * - 'sparsevec': Sparse vectors with variable storage, max 1,000 non-zero elements for indexes
 *
 * Use 'halfvec' for large dimension models like text-embedding-3-large (3072 dimensions)
 * Use 'bit' for binary embeddings (e.g., from binary quantization)
 * Use 'sparsevec' for very high-dimensional but sparse vectors
 *
 * Note: 'halfvec', 'bit', and 'sparsevec' require pgvector >= 0.7.0
 */
export type VectorType = 'vector' | 'halfvec' | 'bit' | 'sparsevec';

/**
 * Distance metrics for bit vectors.
 * - 'hamming': Hamming distance (<~> operator), counts bit differences
 * - 'jaccard': Jaccard distance (<%> operator), set similarity
 */
export type BitDistanceMetric = 'hamming' | 'jaccard';

/**
 * Distance metrics for sparse vectors.
 * - 'l2': Euclidean distance (<-> operator)
 * - 'cosine': Cosine distance (<=> operator)
 * - 'inner_product': Inner product (<#> operator, negative for similarity)
 */
export type SparsevecDistanceMetric = 'l2' | 'cosine' | 'inner_product';

/**
 * Maximum dimensions for indexed vectors by type.
 * Note: These limits apply to indexed vectors; non-indexed vectors can have more.
 */
export const MAX_INDEX_DIMENSIONS: Record<VectorType, number> = {
  vector: 2000,
  halfvec: 4000,
  bit: 64000,
  sparsevec: 0, // sparsevec uses element count, not dimension count
};

/**
 * Maximum non-zero elements for indexed sparsevec.
 * sparsevec indexes have a limit on non-zero elements, not dimensions.
 */
export const MAX_SPARSEVEC_ELEMENTS = 1000;

interface IVFConfig {
  lists?: number;
}

interface HNSWConfig {
  m?: number; // Max number of connections (default: 16)
  efConstruction?: number; // Build-time complexity (default: 64)
}

export interface IndexConfig {
  type?: IndexType;
  ivf?: IVFConfig;
  hnsw?: HNSWConfig;
}
