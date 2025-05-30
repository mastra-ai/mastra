import type { EmbeddingModel } from 'ai';
import type { RerankConfig } from '../rerank';

export interface PineconeConfig {
  namespace?: string;
  sparseVector?: {
    indices: number[];
    values: number[];
  };
}

export interface PgVectorConfig {
  minScore?: number;
  ef?: number; // HNSW search parameter
  probes?: number; // IVFFlat probe parameter
}

export interface ChromaConfig {
  // Add Chroma-specific configs here if needed
  where?: Record<string, any>;
  whereDocument?: Record<string, any>;
}

// Union type for all database-specific configs
export type DatabaseConfig = {
  pinecone?: PineconeConfig;
  pgvector?: PgVectorConfig;
  chroma?: ChromaConfig;
  // Add other database configs as needed
  [key: string]: any; // Allow for future database extensions
};

export type VectorQueryToolOptions = {
  id?: string;
  description?: string;
  indexName: string;
  vectorStoreName: string;
  model: EmbeddingModel<string>;
  enableFilter?: boolean;
  includeVectors?: boolean;
  includeSources?: boolean;
  reranker?: RerankConfig;
  /** Database-specific configuration options */
  databaseConfig?: DatabaseConfig;
};

export type GraphRagToolOptions = {
  id?: string;
  description?: string;
  indexName: string;
  vectorStoreName: string;
  model: EmbeddingModel<string>;
  enableFilter?: boolean;
  includeSources?: boolean;
  graphOptions?: {
    dimension?: number;
    randomWalkSteps?: number;
    restartProb?: number;
    threshold?: number;
  };
};

/**
 * Default options for GraphRAG
 * @default
 * ```json
 * {
 *   "dimension": 1536,
 *   "randomWalkSteps": 100,
 *   "restartProb": 0.15,
 *   "threshold": 0.7
 * }
 * ```
 */
export const defaultGraphOptions = {
  dimension: 1536,
  randomWalkSteps: 100,
  restartProb: 0.15,
  threshold: 0.7,
};
