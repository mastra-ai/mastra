export type IndexType = 'ivfflat' | 'hnsw' | 'flat';

/**
 * pgvector storage types for embeddings.
 * - 'vector': Full precision (4 bytes per dimension), max 2000 dimensions for indexes
 * - 'halfvec': Half precision (2 bytes per dimension), max 4000 dimensions for indexes
 * - 'bit': Binary vectors using PostgreSQL's native bit type, up to 64,000 dimensions for indexes
 * - 'sparsevec': Sparse vectors storing only non-zero elements (HNSW indexes limited to 1,000 non-zero elements at build time)
 *
 * Use 'halfvec' for large dimension models like text-embedding-3-large (3072 dimensions)
 * Use 'bit' for binary quantization (significantly reduces storage and improves search speed)
 * Use 'sparsevec' for BM25/TF-IDF representations and other sparse embeddings
 *
 * Note: 'halfvec', 'bit', and 'sparsevec' require pgvector >= 0.7.0
 */
export type VectorType = 'vector' | 'halfvec' | 'bit' | 'sparsevec';

/**
 * Extended metric types for pgvector.
 * In addition to standard metrics (cosine, euclidean, dotproduct), pgvector supports:
 * - 'hamming': Hamming distance for bit vectors (counts differing bits)
 * - 'jaccard': Jaccard distance for bit vectors (1 - intersection/union)
 *
 * Note: 'hamming' and 'jaccard' are only valid with vectorType 'bit'.
 * 'jaccard' requires HNSW index type (IVFFlat does not support Jaccard).
 */
export type PgMetric = 'cosine' | 'euclidean' | 'dotproduct' | 'hamming' | 'jaccard';

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

/**
 * All vector-type-specific operations consolidated into a single object.
 * Returned by `getVectorOps()` so call sites don't need to invoke 5 separate helpers.
 */
export interface VectorOps {
  /** Operator class for index creation, e.g. 'vector_cosine_ops', 'bit_hamming_ops' */
  operatorClass: string;
  /** Distance operator for queries, e.g. '<=>', '<~>', '<%>' */
  distanceOperator: string;
  /** Builds a score-normalization SQL expression from a raw distance expression */
  scoreExpr: (distanceExpr: string) => string;
  /** Formats a number[] into the SQL literal for this vector type */
  formatVector: (vector: number[], dimension?: number) => string;
  /** Parses a PostgreSQL embedding string back into a number[] */
  parseEmbedding: (embedding: string) => number[];
}
