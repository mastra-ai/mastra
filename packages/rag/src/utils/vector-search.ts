import type { ObservabilityContext } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import type { MastraVector, MastraEmbeddingModel, QueryResult, QueryVectorParams } from '@mastra/core/vector';
import { embedV1, embedV2, embedV3 } from '@mastra/core/vector';
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
  /** Observability context for tracing nested operations */
  observabilityContext?: ObservabilityContext;
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
  observabilityContext,
}: VectorQuerySearchParams): Promise<VectorQuerySearchResult> => {
  const parentSpan = observabilityContext?.tracingContext?.currentSpan;

  // ----- Embed query -----
  const embedSpan = parentSpan?.createChildSpan({
    type: SpanType.RAG_EMBEDDING,
    name: `rag embed: query`,
    input: queryText,
    attributes: {
      mode: 'query',
      model: (model as any)?.modelId,
      provider: (model as any)?.provider,
      inputCount: 1,
    },
  });

  let embeddingResult;
  try {
    if (model.specificationVersion === 'v3') {
      embeddingResult = await embedV3({
        model: model,
        value: queryText,
        maxRetries,
        // Type assertion needed: providerOptions type is a union, but embedV3 expects specific version
        ...(providerOptions && {
          providerOptions: providerOptions as Parameters<typeof embedV3>[0]['providerOptions'],
        }),
      });
    } else if (model.specificationVersion === 'v2') {
      embeddingResult = await embedV2({
        model: model,
        value: queryText,
        maxRetries,
        // Type assertion needed: providerOptions type is a union, but embedV2 expects specific version
        ...(providerOptions && {
          providerOptions: providerOptions as Parameters<typeof embedV2>[0]['providerOptions'],
        }),
      });
    } else {
      embeddingResult = await embedV1({
        value: queryText,
        model: model,
        maxRetries,
      });
    }
  } catch (err) {
    embedSpan?.error({ error: err as Error, endSpan: true });
    throw err;
  }

  const embedding = embeddingResult.embedding;
  // `embedV*` returns provider-shaped results; `usage` is present on v2/v3.
  const embedUsage = (embeddingResult as any)?.usage;
  embedSpan?.end({
    attributes: {
      dimensions: embedding?.length,
      ...(embedUsage && {
        usage: {
          inputTokens: embedUsage.tokens ?? embedUsage.promptTokens ?? embedUsage.inputTokens,
        },
      }),
    },
    output: { dimensions: embedding?.length },
  });

  // ----- Vector store query -----
  const queryParams: QueryVectorParams = {
    indexName,
    queryVector: embedding,
    topK,
    filter: queryFilter,
    includeVector: includeVectors,
  };

  const querySpan = parentSpan?.createChildSpan({
    type: SpanType.RAG_VECTOR_OPERATION,
    name: `rag vector: query`,
    // Pass filter as-is; the observability layer's deepClean handles
    // size limits and sanitization centrally.
    input: { topK, filter: queryFilter },
    attributes: {
      operation: 'query',
      indexName,
      topK,
      dimensions: embedding?.length,
    },
  });

  let results: QueryResult[];
  try {
    results = await vectorStore.query({ ...queryParams, ...databaseSpecificParams(databaseConfig) });
  } catch (err) {
    querySpan?.error({ error: err as Error, endSpan: true });
    throw err;
  }

  querySpan?.end({
    output: { returned: results?.length ?? 0 },
  });

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
