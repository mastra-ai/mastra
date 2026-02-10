export type IndexType = 'ivfflat' | 'hnsw' | 'flat';

/**
 * pgvector storage types for embeddings.
 * - 'vector': Full precision (4 bytes per dimension), max 2000 dimensions for indexes
 * - 'halfvec': Half precision (2 bytes per dimension), max 4000 dimensions for indexes
 * - 'bit': Binary vectors using PostgreSQL's native bit type, up to 64,000 dimensions for indexes
 * - 'sparsevec': Sparse vectors storing only non-zero elements, up to 1,000 non-zero elements for indexes
 *
 * Use 'halfvec' for large dimension models like text-embedding-3-large (3072 dimensions)
 * Use 'bit' for binary quantization (significantly reduces storage and improves search speed)
 * Use 'sparsevec' for BM25/TF-IDF representations and other sparse embeddings
 *
 * Note: 'halfvec', 'bit', and 'sparsevec' require pgvector >= 0.7.0
 */
export type VectorType = 'vector' | 'halfvec' | 'bit' | 'sparsevec';

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
