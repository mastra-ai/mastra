import type { MastraVector, MastraEmbeddingModel, QueryResult, QueryVectorParams } from '@mastra/core/vector';
import { embedV1, embedV2, embedV3 } from '@mastra/core/vector';
import type { VectorFilter } from '@mastra/core/vector/filter';
import { getGlobalMetricsCollector } from '@mastra/core/observability';
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
  const startTime = Date.now();
  let embedDurationMs: number | undefined;
  let vectorSearchDurationMs: number | undefined;
  let resultCount = 0;
  let success = false;
  let errorType: string | undefined;
  let embeddingDimension: number | undefined;
  let embeddingTokens: number | undefined;

  try {
    // Measure embedding time
    const embedStart = Date.now();
    let embeddingResult;

    if (model.specificationVersion === 'v3') {
      embeddingResult = await embedV3({
        model: model,
        value: queryText,
        maxRetries,
        ...(providerOptions && { providerOptions }),
      });
    } else if (model.specificationVersion === 'v2') {
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
    embedDurationMs = Date.now() - embedStart;

    const embedding = embeddingResult.embedding;
    embeddingDimension = embedding.length;
    // Extract token usage if available
    embeddingTokens = (embeddingResult as { usage?: { tokens?: number } })?.usage?.tokens;

    // Build query parameters with database-specific configurations
    const queryParams: QueryVectorParams = {
      indexName,
      queryVector: embedding,
      topK,
      filter: queryFilter,
      includeVector: includeVectors,
    };

    // Measure vector search time
    const vectorSearchStart = Date.now();
    // Get relevant chunks from the vector database
    const results = await vectorStore.query({ ...queryParams, ...databaseSpecificParams(databaseConfig) });
    vectorSearchDurationMs = Date.now() - vectorSearchStart;

    resultCount = results.length;
    success = true;

    return { results, queryEmbedding: embedding };
  } catch (error) {
    errorType = error instanceof Error ? error.name : 'UnknownError';
    throw error;
  } finally {
    // Record RAG query metrics
    const durationMs = Date.now() - startTime;
    const metrics = getGlobalMetricsCollector();
    metrics.recordRagQuery({
      indexName,
      topK,
      resultCount,
      durationMs,
      embedDurationMs,
      vectorSearchDurationMs,
      hasFilter: !!queryFilter,
      success,
      errorType,
    });

    // Record embedding metrics separately if we have the data
    if (embeddingDimension !== undefined && embedDurationMs !== undefined) {
      metrics.recordRagEmbed({
        model: model.modelId || 'unknown',
        inputTokens: embeddingTokens,
        dimension: embeddingDimension,
        durationMs: embedDurationMs,
        success,
        errorType: success ? undefined : errorType,
      });
    }

    // Record vector search metrics separately
    if (vectorSearchDurationMs !== undefined) {
      metrics.recordRagVectorSearch({
        indexName,
        topK,
        resultCount,
        durationMs: vectorSearchDurationMs,
        hasFilter: !!queryFilter,
        success,
        errorType: success ? undefined : errorType,
      });
    }
  }
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
