import { EMBEDDING_MODELS } from '@mastra/core/llm';
import type { MastraVector, QueryResult, IndexStats, VectorFilter } from '@mastra/core/vector';
import { SERVER_ERROR_CODES } from '../error-codes';
import { HTTPException } from '../http-exception';
import {
  vectorNamePathParams,
  vectorIndexPathParams,
  upsertVectorsBodySchema,
  upsertVectorsResponseSchema,
  createIndexBodySchema,
  createIndexResponseSchema,
  queryVectorsBodySchema,
  queryVectorsResponseSchema,
  listIndexesResponseSchema,
  describeIndexResponseSchema,
  deleteIndexResponseSchema,
  listVectorsResponseSchema,
  listEmbeddersResponseSchema,
} from '../schemas/vectors';
import { createRoute } from '../server-adapter/routes/route-builder';
import type { Context } from '../types';

import { handleError } from './error';

interface VectorContext extends Context {
  vectorName?: string;
}

interface UpsertRequest {
  indexName: string;
  vectors: number[][];
  metadata?: Record<string, any>[];
  ids?: string[];
}

interface CreateIndexRequest {
  indexName: string;
  dimension: number;
  metric?: 'cosine' | 'euclidean' | 'dotproduct';
}

interface QueryRequest {
  indexName: string;
  queryVector: number[];
  topK?: number;
  filter?: Record<string, any>;
  includeVector?: boolean;
}

function getVector(mastra: Context['mastra'], vectorName?: string): MastraVector {
  if (!vectorName) {
    throw new HTTPException(400, {
      message: 'Vector name is required',
      code: SERVER_ERROR_CODES.VECTOR_STORE_NAME_REQUIRED,
    });
  }

  const vector = mastra.getVector(vectorName);
  if (!vector) {
    throw new HTTPException(404, {
      message: `Vector store ${vectorName} not found`,
      code: SERVER_ERROR_CODES.VECTOR_STORE_NOT_FOUND,
      metadata: { vectorName },
    });
  }

  return vector;
}

// Upsert vectors
export async function upsertVectors({
  mastra,
  vectorName,
  indexName,
  vectors,
  metadata,
  ids,
}: VectorContext & UpsertRequest) {
  try {
    if (!indexName) {
      throw new HTTPException(400, {
        message: 'Invalid request index. indexName and vectors array are required.',
        code: SERVER_ERROR_CODES.VECTOR_INDEX_NAME_REQUIRED,
      });
    }

    if (!vectors || !Array.isArray(vectors)) {
      throw new HTTPException(400, {
        message: 'Invalid request index. indexName and vectors array are required.',
        code: SERVER_ERROR_CODES.VECTOR_VECTORS_REQUIRED,
      });
    }

    const vector = getVector(mastra, vectorName);
    const result = await vector.upsert({ indexName, vectors, metadata, ids });
    return { ids: result };
  } catch (error) {
    return handleError(error, { message: 'Error upserting vectors', code: SERVER_ERROR_CODES.VECTORS_UPSERT_FAILED });
  }
}

// Create index
export async function createIndex({
  mastra,
  vectorName,
  indexName,
  dimension,
  metric,
}: Pick<VectorContext, 'mastra' | 'vectorName'> & CreateIndexRequest) {
  try {
    if (!indexName) {
      throw new HTTPException(400, {
        message: 'Invalid request index, indexName and positive dimension number are required.',
        code: SERVER_ERROR_CODES.VECTOR_INDEX_NAME_REQUIRED,
      });
    }

    if (typeof dimension !== 'number' || dimension <= 0) {
      throw new HTTPException(400, {
        message: 'Invalid request index, indexName and positive dimension number are required.',
        code: SERVER_ERROR_CODES.VECTOR_INDEX_DIMENSION_INVALID,
      });
    }

    if (metric && !['cosine', 'euclidean', 'dotproduct'].includes(metric)) {
      throw new HTTPException(400, {
        message: 'Invalid metric. Must be one of: cosine, euclidean, dotproduct',
        code: SERVER_ERROR_CODES.VECTOR_INDEX_METRIC_INVALID,
      });
    }

    const vector = getVector(mastra, vectorName);
    await vector.createIndex({ indexName, dimension, metric });
    return { success: true };
  } catch (error) {
    return handleError(error, { message: 'Error creating index', code: SERVER_ERROR_CODES.VECTOR_INDEX_CREATE_FAILED });
  }
}

// Query vectors
export async function queryVectors({
  mastra,
  vectorName,
  indexName,
  queryVector,
  topK,
  filter,
  includeVector,
}: Pick<VectorContext, 'mastra' | 'vectorName'> & QueryRequest) {
  try {
    if (!indexName) {
      throw new HTTPException(400, {
        message: 'Invalid request query. indexName and queryVector array are required.',
        code: SERVER_ERROR_CODES.VECTOR_INDEX_NAME_REQUIRED,
      });
    }

    if (!queryVector || !Array.isArray(queryVector)) {
      throw new HTTPException(400, {
        message: 'Invalid request query. indexName and queryVector array are required.',
        code: SERVER_ERROR_CODES.VECTOR_QUERY_VECTOR_REQUIRED,
      });
    }

    const vector = getVector(mastra, vectorName);
    const results: QueryResult[] = await vector.query({ indexName, queryVector, topK, filter, includeVector });
    return results;
  } catch (error) {
    return handleError(error, { message: 'Error querying vectors', code: SERVER_ERROR_CODES.VECTORS_QUERY_FAILED });
  }
}

// List indexes
export async function listIndexes({ mastra, vectorName }: Pick<VectorContext, 'mastra' | 'vectorName'>) {
  try {
    const vector = getVector(mastra, vectorName);

    const indexes = await vector.listIndexes();
    return indexes.filter(Boolean);
  } catch (error) {
    return handleError(error, {
      message: 'Error listing indexes',
      code: SERVER_ERROR_CODES.VECTOR_INDEXES_LIST_FAILED,
    });
  }
}

// Describe index
export async function describeIndex({
  mastra,
  vectorName,
  indexName,
}: Pick<VectorContext, 'mastra' | 'vectorName'> & { indexName?: string }) {
  try {
    if (!indexName) {
      throw new HTTPException(400, {
        message: 'Index name is required',
        code: SERVER_ERROR_CODES.VECTOR_INDEX_NAME_REQUIRED,
      });
    }

    const vector = getVector(mastra, vectorName);
    const stats: IndexStats = await vector.describeIndex({ indexName });

    return {
      dimension: stats.dimension,
      count: stats.count,
      metric: stats.metric?.toLowerCase(),
    };
  } catch (error) {
    return handleError(error, {
      message: 'Error describing index',
      code: SERVER_ERROR_CODES.VECTOR_INDEX_DESCRIBE_FAILED,
    });
  }
}

// Delete index
export async function deleteIndex({
  mastra,
  vectorName,
  indexName,
}: Pick<VectorContext, 'mastra' | 'vectorName'> & { indexName?: string }) {
  try {
    if (!indexName) {
      throw new HTTPException(400, {
        message: 'Index name is required',
        code: SERVER_ERROR_CODES.VECTOR_INDEX_NAME_REQUIRED,
      });
    }

    const vector = getVector(mastra, vectorName);
    await vector.deleteIndex({ indexName });
    return { success: true };
  } catch (error) {
    return handleError(error, { message: 'Error deleting index', code: SERVER_ERROR_CODES.VECTOR_INDEX_DELETE_FAILED });
  }
}

// List available vector stores
export async function listVectorStores({ mastra }: Pick<VectorContext, 'mastra'>) {
  try {
    const vectors = mastra.listVectors();
    if (!vectors) {
      return { vectors: [] };
    }

    // Convert to array and extract metadata
    const vectorList = Object.entries(vectors).map(([name, vector]) => ({
      name,
      id: vector.id || name, // Use the key as fallback when vector has no id property
      type: vector.constructor.name,
      // Add any other metadata that might be useful
    }));

    return { vectors: vectorList };
  } catch (error) {
    return handleError(error, {
      message: 'Error listing vector stores',
      code: SERVER_ERROR_CODES.VECTOR_STORES_LIST_FAILED,
    });
  }
}

// ============================================================================
// Route Definitions (new pattern - handlers defined inline with createRoute)
// ============================================================================

export const UPSERT_VECTORS_ROUTE = createRoute({
  method: 'POST',
  path: '/vector/:vectorName/upsert',
  responseType: 'json',
  pathParamSchema: vectorNamePathParams,
  bodySchema: upsertVectorsBodySchema,
  responseSchema: upsertVectorsResponseSchema,
  summary: 'Upsert vectors',
  description: 'Inserts or updates vectors in the specified index',
  tags: ['Vectors'],
  requiresAuth: true,
  errors: [
    'VECTORS_UPSERT_FAILED',
    'VECTOR_INDEX_NAME_REQUIRED',
    'VECTOR_STORE_NAME_REQUIRED',
    'VECTOR_STORE_NOT_FOUND',
    'VECTOR_VECTORS_REQUIRED',
  ],
  handler: async ({ mastra, vectorName, ...params }) => {
    try {
      const { indexName, vectors, metadata, ids } = params;

      if (!indexName) {
        throw new HTTPException(400, {
          message: 'Invalid request index. indexName and vectors array are required.',
          code: SERVER_ERROR_CODES.VECTOR_INDEX_NAME_REQUIRED,
        });
      }

      if (!vectors || !Array.isArray(vectors)) {
        throw new HTTPException(400, {
          message: 'Invalid request index. indexName and vectors array are required.',
          code: SERVER_ERROR_CODES.VECTOR_VECTORS_REQUIRED,
        });
      }

      const vector = getVector(mastra, vectorName);
      const result = await vector.upsert({ indexName, vectors, metadata, ids });
      return { ids: result };
    } catch (error) {
      return handleError(error, { message: 'Error upserting vectors', code: SERVER_ERROR_CODES.VECTORS_UPSERT_FAILED });
    }
  },
});

export const CREATE_INDEX_ROUTE = createRoute({
  method: 'POST',
  path: '/vector/:vectorName/create-index',
  responseType: 'json',
  pathParamSchema: vectorNamePathParams,
  bodySchema: createIndexBodySchema,
  responseSchema: createIndexResponseSchema,
  summary: 'Create index',
  description: 'Creates a new vector index with the specified dimension and metric',
  tags: ['Vectors'],
  requiresAuth: true,
  errors: [
    'VECTOR_INDEX_CREATE_FAILED',
    'VECTOR_INDEX_DIMENSION_INVALID',
    'VECTOR_INDEX_METRIC_INVALID',
    'VECTOR_INDEX_NAME_REQUIRED',
    'VECTOR_STORE_NAME_REQUIRED',
    'VECTOR_STORE_NOT_FOUND',
  ],
  handler: async ({ mastra, vectorName, ...params }) => {
    try {
      const { indexName, dimension, metric } = params;

      if (!indexName) {
        throw new HTTPException(400, {
          message: 'Invalid request index, indexName and positive dimension number are required.',
          code: SERVER_ERROR_CODES.VECTOR_INDEX_NAME_REQUIRED,
        });
      }

      if (typeof dimension !== 'number' || dimension <= 0) {
        throw new HTTPException(400, {
          message: 'Invalid request index, indexName and positive dimension number are required.',
          code: SERVER_ERROR_CODES.VECTOR_INDEX_DIMENSION_INVALID,
        });
      }

      if (metric && !['cosine', 'euclidean', 'dotproduct'].includes(metric)) {
        throw new HTTPException(400, {
          message: 'Invalid metric. Must be one of: cosine, euclidean, dotproduct',
          code: SERVER_ERROR_CODES.VECTOR_INDEX_METRIC_INVALID,
        });
      }

      const vector = getVector(mastra, vectorName);
      await vector.createIndex({ indexName, dimension, metric });
      return { success: true };
    } catch (error) {
      return handleError(error, {
        message: 'Error creating index',
        code: SERVER_ERROR_CODES.VECTOR_INDEX_CREATE_FAILED,
      });
    }
  },
});

export const QUERY_VECTORS_ROUTE = createRoute({
  method: 'POST',
  path: '/vector/:vectorName/query',
  responseType: 'json',
  pathParamSchema: vectorNamePathParams,
  bodySchema: queryVectorsBodySchema,
  responseSchema: queryVectorsResponseSchema,
  summary: 'Query vectors',
  description: 'Performs a similarity search on the vector index',
  tags: ['Vectors'],
  requiresAuth: true,
  errors: [
    'VECTORS_QUERY_FAILED',
    'VECTOR_INDEX_NAME_REQUIRED',
    'VECTOR_QUERY_VECTOR_REQUIRED',
    'VECTOR_STORE_NAME_REQUIRED',
    'VECTOR_STORE_NOT_FOUND',
  ],
  handler: async ({ mastra, vectorName, ...params }) => {
    try {
      const { indexName, queryVector, topK, filter, includeVector } = params;

      if (!indexName) {
        throw new HTTPException(400, {
          message: 'Invalid request query. indexName and queryVector array are required.',
          code: SERVER_ERROR_CODES.VECTOR_INDEX_NAME_REQUIRED,
        });
      }

      if (!queryVector || !Array.isArray(queryVector)) {
        throw new HTTPException(400, {
          message: 'Invalid request query. indexName and queryVector array are required.',
          code: SERVER_ERROR_CODES.VECTOR_QUERY_VECTOR_REQUIRED,
        });
      }

      const vector = getVector(mastra, vectorName);
      const results: QueryResult[] = await vector.query({
        indexName,
        queryVector,
        topK,
        // Body schema is intentionally permissive; the store validates the filter shape.
        filter: filter as VectorFilter,
        includeVector,
      });
      return results;
    } catch (error) {
      return handleError(error, { message: 'Error querying vectors', code: SERVER_ERROR_CODES.VECTORS_QUERY_FAILED });
    }
  },
});

export const LIST_INDEXES_ROUTE = createRoute({
  method: 'GET',
  path: '/vector/:vectorName/indexes',
  responseType: 'json',
  pathParamSchema: vectorNamePathParams,
  responseSchema: listIndexesResponseSchema,
  summary: 'List indexes',
  description: 'Returns a list of all indexes in the vector store',
  tags: ['Vectors'],
  requiresAuth: true,
  errors: ['VECTOR_INDEXES_LIST_FAILED', 'VECTOR_STORE_NAME_REQUIRED', 'VECTOR_STORE_NOT_FOUND'],
  handler: async ({ mastra, vectorName }) => {
    try {
      const vector = getVector(mastra, vectorName);
      const indexes = await vector.listIndexes();
      return indexes.filter(Boolean);
    } catch (error) {
      return handleError(error, {
        message: 'Error listing indexes',
        code: SERVER_ERROR_CODES.VECTOR_INDEXES_LIST_FAILED,
      });
    }
  },
});

export const DESCRIBE_INDEX_ROUTE = createRoute({
  method: 'GET',
  path: '/vector/:vectorName/indexes/:indexName',
  responseType: 'json',
  pathParamSchema: vectorIndexPathParams,
  responseSchema: describeIndexResponseSchema,
  summary: 'Describe index',
  description: 'Returns statistics and metadata for a specific index',
  tags: ['Vectors'],
  requiresAuth: true,
  errors: [
    'VECTOR_INDEX_DESCRIBE_FAILED',
    'VECTOR_INDEX_NAME_REQUIRED',
    'VECTOR_STORE_NAME_REQUIRED',
    'VECTOR_STORE_NOT_FOUND',
  ],
  handler: async ({ mastra, vectorName, indexName }) => {
    try {
      if (!indexName) {
        throw new HTTPException(400, {
          message: 'Index name is required',
          code: SERVER_ERROR_CODES.VECTOR_INDEX_NAME_REQUIRED,
        });
      }

      const vector = getVector(mastra, vectorName);
      const stats: IndexStats = await vector.describeIndex({ indexName: indexName });

      return {
        dimension: stats.dimension,
        count: stats.count,
        metric: stats.metric?.toLowerCase(),
      };
    } catch (error) {
      return handleError(error, {
        message: 'Error describing index',
        code: SERVER_ERROR_CODES.VECTOR_INDEX_DESCRIBE_FAILED,
      });
    }
  },
});

export const DELETE_INDEX_ROUTE = createRoute({
  method: 'DELETE',
  path: '/vector/:vectorName/indexes/:indexName',
  responseType: 'json',
  pathParamSchema: vectorIndexPathParams,
  responseSchema: deleteIndexResponseSchema,
  summary: 'Delete index',
  description: 'Deletes a vector index and all its data',
  tags: ['Vectors'],
  requiresAuth: true,
  errors: [
    'VECTOR_INDEX_DELETE_FAILED',
    'VECTOR_INDEX_NAME_REQUIRED',
    'VECTOR_STORE_NAME_REQUIRED',
    'VECTOR_STORE_NOT_FOUND',
  ],
  handler: async ({ mastra, vectorName, indexName }) => {
    try {
      if (!indexName) {
        throw new HTTPException(400, {
          message: 'Index name is required',
          code: SERVER_ERROR_CODES.VECTOR_INDEX_NAME_REQUIRED,
        });
      }

      const vector = getVector(mastra, vectorName);
      await vector.deleteIndex({ indexName: indexName });
      return { success: true };
    } catch (error) {
      return handleError(error, {
        message: 'Error deleting index',
        code: SERVER_ERROR_CODES.VECTOR_INDEX_DELETE_FAILED,
      });
    }
  },
});

export const LIST_VECTORS_ROUTE = createRoute({
  method: 'GET',
  path: '/vectors',
  responseType: 'json',
  responseSchema: listVectorsResponseSchema,
  summary: 'List vector stores',
  description: 'Returns a list of all configured vector stores',
  tags: ['Vectors'],
  requiresAuth: true,
  errors: ['VECTOR_STORES_LIST_FAILED'],
  handler: async ({ mastra }) => {
    try {
      const vectors = mastra.listVectors();
      if (!vectors) {
        return { vectors: [] };
      }

      // Convert to array and extract metadata
      const vectorList = Object.entries(vectors).map(([name, vector]) => ({
        id: vector.id || name, // Use the key as the ID since vectors might not have their own id property
        name,
        type: vector.constructor.name,
      }));

      return { vectors: vectorList };
    } catch (error) {
      return handleError(error, {
        message: 'Error listing vector stores',
        code: SERVER_ERROR_CODES.VECTOR_STORES_LIST_FAILED,
      });
    }
  },
});

export const LIST_EMBEDDERS_ROUTE = createRoute({
  method: 'GET',
  path: '/embedders',
  responseType: 'json',
  responseSchema: listEmbeddersResponseSchema,
  summary: 'List available embedder models',
  description: 'Returns a list of all available embedding models',
  tags: ['Vectors'],
  requiresAuth: true,
  errors: ['EMBEDDERS_LIST_FAILED'],
  handler: async () => {
    try {
      const embeddersList = EMBEDDING_MODELS.map(model => ({
        id: `${model.provider}/${model.id}`,
        provider: model.provider,
        name: model.id,
        description: model.description || '',
        dimensions: model.dimensions,
        maxInputTokens: model.maxInputTokens,
      }));

      return { embedders: embeddersList };
    } catch (error) {
      return handleError(error, { message: 'Error listing embedders', code: SERVER_ERROR_CODES.EMBEDDERS_LIST_FAILED });
    }
  },
});
