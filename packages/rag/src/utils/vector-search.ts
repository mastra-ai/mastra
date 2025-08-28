import type { MastraVector, MastraEmbeddingModel, QueryResult, QueryVectorParams } from '@mastra/core/vector';
import { embedV1, embedV2 } from '@mastra/core/vector';
import type { VectorFilter } from '@mastra/core/vector/filter';
import type { DatabaseConfig, ProviderOptions } from '../tools/types';

type VectorQuerySearchParams = {
  indexName: string;
  vectorStore: MastraVector;
  queryText: string;
  model: MastraEmbeddingModel<string>;
  queryFilter?: VectorFilter;
  topK: number;
  includeVectors?: boolean;
  maxRetries?: number;
  /** Database-specific configuration options */
  databaseConfig?: DatabaseConfig;
} & ProviderOptions;

interface VectorQuerySearchResult {
  results: QueryResult[];
  queryEmbedding: number[];
}

enum DatabaseType {
  Pinecone = 'pinecone',
  PgVector = 'pgvector',
  Chroma = 'chroma',
}

const DATABASE_TYPE_MAP = Object.keys(DatabaseType);

// Helper function to handle vector query search
export const vectorQuerySearch = async ({
  indexName,
  vectorStore,
  queryText,
  model,
  queryFilter,
  topK,
  includeVectors = false,
  maxRetries = 2,
  databaseConfig = {},
  providerOptions,
}: VectorQuerySearchParams): Promise<VectorQuerySearchResult> => {
  let embeddingResult;

  if (model.specificationVersion === 'v2') {
    embeddingResult = await embedV2({
      model: model,
      value: queryText,
      maxRetries,
      ...(providerOptions && { providerOptions }),
    });
  } else {
    embeddingResult = await embedV1({
      value: queryText,
      model: model,
      maxRetries,
    });
  }

  const embedding = embeddingResult.embedding;

  // Build query parameters with database-specific configurations
  const queryParams: QueryVectorParams = {
    indexName,
    queryVector: embedding,
    topK,
    filter: queryFilter,
    includeVector: includeVectors,
  };

  // Get relevant chunks from the vector database
  const results = await vectorStore.query({ ...queryParams, ...databaseSpecificParams(databaseConfig) });

  return { results, queryEmbedding: embedding };
};

const databaseSpecificParams = (databaseConfig: DatabaseConfig) => {
  const databaseSpecificParams: DatabaseConfig = {};

  // Apply database-specific configurations
  if (databaseConfig) {
    // Pinecone-specific configurations
    if (databaseConfig.pinecone) {
      if (databaseConfig.pinecone.namespace) {
        databaseSpecificParams.namespace = databaseConfig.pinecone.namespace;
      }
      if (databaseConfig.pinecone.sparseVector) {
        databaseSpecificParams.sparseVector = databaseConfig.pinecone.sparseVector;
      }
    }

    // pgVector-specific configurations
    if (databaseConfig.pgvector) {
      if (databaseConfig.pgvector.minScore !== undefined) {
        databaseSpecificParams.minScore = databaseConfig.pgvector.minScore;
      }
      if (databaseConfig.pgvector.ef !== undefined) {
        databaseSpecificParams.ef = databaseConfig.pgvector.ef;
      }
      if (databaseConfig.pgvector.probes !== undefined) {
        databaseSpecificParams.probes = databaseConfig.pgvector.probes;
      }
    }

    // Chroma-specific configurations
    if (databaseConfig.chroma) {
      if (databaseConfig.chroma.where) {
        databaseSpecificParams.where = databaseConfig.chroma.where;
      }
      if (databaseConfig.chroma.whereDocument) {
        databaseSpecificParams.whereDocument = databaseConfig.chroma.whereDocument;
      }
    }

    // Handle any additional database configs
    Object.keys(databaseConfig).forEach(dbName => {
      if (!DATABASE_TYPE_MAP.includes(dbName)) {
        // For unknown database types, merge the config directly
        const config = databaseConfig[dbName];
        if (config && typeof config === 'object') {
          Object.assign(databaseSpecificParams, config);
        }
      }
    });
  }

  return databaseSpecificParams;
};
