export type IndexType = 'ivfflat' | 'hnsw' | 'flat';

/**
 * pgvector storage types for embeddings.
 * - 'vector': Full precision (4 bytes per dimension), max 2000 dimensions for indexes
 * - 'halfvec': Half precision (2 bytes per dimension), max 4000 dimensions for indexes
 *
 * Use 'halfvec' for large dimension models like text-embedding-3-large (3072 dimensions)
 *
 * Note: 'halfvec' requires pgvector >= 0.7.0
 */
export type VectorType = 'vector' | 'halfvec';

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
