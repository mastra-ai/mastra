import type { MastraUnion } from '@mastra/core/action';
import type { RequestContext } from '@mastra/core/request-context';
import type { MastraVector, MastraEmbeddingModel } from '@mastra/core/vector';

import type { RerankConfig } from '../rerank';

/**
 * Context passed to dynamic vector store resolver functions.
 * Enables multi-tenant setups where the vector store is selected based on request context.
 */
export interface VectorStoreResolverContext {
  /** The request context containing tenant/schema information */
  requestContext?: RequestContext;
  /** The Mastra instance for accessing registered resources */
  mastra?: MastraUnion;
}

/**
 * A function that dynamically resolves a vector store based on the execution context.
 * Useful for multi-tenant applications where each tenant has a separate schema/database.
 *
 * @example
 * ```typescript
 * const vectorStoreResolver: VectorStoreResolver = async ({ requestContext }) => {
 *   const schemaId = requestContext?.get('schemaId');
 *   return new PgVector({
 *     connectionString: process.env.DATABASE_URL,
 *     schemaName: `tenant_${schemaId}`,
 *   });
 * };
 * ```
 */
export type VectorStoreResolver = (context: VectorStoreResolverContext) => MastraVector | Promise<MastraVector>;

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

// Chroma types
type LiteralValue = string | number | boolean;
type ListLiteralValue = LiteralValue[];
type LiteralNumber = number;
type LogicalOperator = '$and' | '$or';
type InclusionOperator = '$in' | '$nin';
type WhereOperator = '$gt' | '$gte' | '$lt' | '$lte' | '$ne' | '$eq';
type OperatorExpression = {
  [key in WhereOperator | InclusionOperator | LogicalOperator]?: LiteralValue | ListLiteralValue;
};
type BaseWhere = {
  [key: string]: LiteralValue | OperatorExpression;
};
type LogicalWhere = {
  [key in LogicalOperator]?: Where[];
};
type Where = BaseWhere | LogicalWhere;
type WhereDocumentOperator = '$contains' | '$not_contains' | LogicalOperator;
type WhereDocument = {
  [key in WhereDocumentOperator]?: LiteralValue | LiteralNumber | WhereDocument[];
};

export interface ChromaConfig {
  // Add Chroma-specific configs here if needed
  where?: Where;
  whereDocument?: WhereDocument;
}

// Union type for all database-specific configs
export type DatabaseConfig = {
  pinecone?: PineconeConfig;
  pgvector?: PgVectorConfig;
  chroma?: ChromaConfig;
  // Add other database configs as needed
  [key: string]: any; // Allow for future database extensions
};

/**
 * Configuration options for creating a vector query tool.
 *
 * This type uses a discriminated union pattern for vector store configuration,
 * allowing two mutually exclusive approaches:
 *
 * 1. **By name**: Use `vectorStoreName` to reference a vector store registered with Mastra
 * 2. **Direct instance**: Use `vectorStore` to provide a vector store instance or resolver function
 *
 * @example Using a named vector store (registered with Mastra)
 * ```typescript
 * const tool = createVectorQueryTool({
 *   vectorStoreName: 'myVectorStore',
 *   indexName: 'documents',
 *   model: openai.embedding('text-embedding-3-small'),
 * });
 * ```
 *
 * @example Using a direct vector store instance
 * ```typescript
 * const tool = createVectorQueryTool({
 *   vectorStore: new PgVector({ connectionString: '...' }),
 *   indexName: 'documents',
 *   model: openai.embedding('text-embedding-3-small'),
 * });
 * ```
 *
 * @example With filtering and reranking enabled
 * ```typescript
 * const tool = createVectorQueryTool({
 *   vectorStoreName: 'myVectorStore',
 *   indexName: 'documents',
 *   model: openai.embedding('text-embedding-3-small'),
 *   enableFilter: true,
 *   reranker: {
 *     model: cohere.rerank('rerank-v3.5'),
 *     options: { topK: 5 },
 *   },
 * });
 * ```
 */
export type VectorQueryToolOptions = {
  /** Custom tool ID. Defaults to `VectorQuery {storeName} {indexName} Tool` */
  id?: string;
  /** Custom tool description for the LLM */
  description?: string;
  /** Name of the index to query within the vector store */
  indexName: string;
  /** Embedding model used to convert query text into vectors */
  model: MastraEmbeddingModel<string>;
  /** When true, enables metadata filtering in queries. Adds a `filter` input to the tool schema */
  enableFilter?: boolean;
  /** When true, includes vector embeddings in the results. Defaults to false */
  includeVectors?: boolean;
  /** When true, includes source documents in the response. Defaults to true */
  includeSources?: boolean;
  /** Optional reranker configuration to improve result relevance */
  reranker?: RerankConfig;
  /** Database-specific configuration options */
  databaseConfig?: DatabaseConfig;
} & ProviderOptions &
  (
    | {
        /** Name of a vector store registered with Mastra */
        vectorStoreName: string;
      }
    | {
        vectorStoreName?: string;
        /**
         * The vector store instance or a resolver function for dynamic selection.
         *
         * For multi-tenant applications, pass a function that receives the request context
         * and returns the appropriate vector store for the current tenant/schema.
         *
         * @example Static vector store
         * ```typescript
         * vectorStore: new PgVector({ connectionString: '...' })
         * ```
         *
         * @example Dynamic resolver for multi-tenant
         * ```typescript
         * vectorStore: async ({ requestContext }) => {
         *   const schemaId = requestContext?.get('schemaId');
         *   return getVectorStoreForSchema(schemaId);
         * }
         * ```
         */
        vectorStore: MastraVector | VectorStoreResolver;
      }
  );

export type GraphRagToolOptions = {
  id?: string;
  description?: string;
  indexName: string;
  model: MastraEmbeddingModel<string>;
  enableFilter?: boolean;
  includeSources?: boolean;
  graphOptions?: {
    dimension?: number;
    randomWalkSteps?: number;
    restartProb?: number;
    threshold?: number;
  };
} & ProviderOptions &
  (
    | {
        vectorStoreName: string;
      }
    | {
        vectorStoreName?: string;
        /**
         * The vector store instance or a resolver function for dynamic selection.
         *
         * For multi-tenant applications, pass a function that receives the request context
         * and returns the appropriate vector store for the current tenant/schema.
         *
         * @example Static vector store
         * ```typescript
         * vectorStore: new PgVector({ connectionString: '...' })
         * ```
         *
         * @example Dynamic resolver for multi-tenant
         * ```typescript
         * vectorStore: async ({ requestContext }) => {
         *   const schemaId = requestContext?.get('schemaId');
         *   return getVectorStoreForSchema(schemaId);
         * }
         * ```
         */
        vectorStore: MastraVector | VectorStoreResolver;
      }
  );

export type ProviderOptions = {
  /**
   * Provider-specific options for the embedding model (e.g., outputDimensionality).
   *
   * ⚠️  **IMPORTANT**: `providerOptions` only work with AI SDK v2 models.
   *
   * **For v1 models**: Configure options when creating the model:
   * ✅ const model = openai.embedding('text-embedding-3-small', { dimensions: 512 });
   *
   * **For v2 models**: Use providerOptions:
   * ✅ providerOptions: { openai: { dimensions: 512 } }
   */
  providerOptions?: Record<string, Record<string, any>>;
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
