import type { MastraVector, QueryResult, IndexStats } from '@mastra/core/vector';
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
    throw new HTTPException(400, { message: 'Vector name is required' });
  }

  const vector = mastra.getVector(vectorName);
  if (!vector) {
    throw new HTTPException(404, { message: `Vector store ${vectorName} not found` });
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
    if (!indexName || !vectors || !Array.isArray(vectors)) {
      throw new HTTPException(400, { message: 'Invalid request index. indexName and vectors array are required.' });
    }

    const vector = getVector(mastra, vectorName);
    const result = await vector.upsert({ indexName, vectors, metadata, ids });
    return { ids: result };
  } catch (error) {
    return handleError(error, 'Error upserting vectors');
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
    if (!indexName || typeof dimension !== 'number' || dimension <= 0) {
      throw new HTTPException(400, {
        message: 'Invalid request index, indexName and positive dimension number are required.',
      });
    }

    if (metric && !['cosine', 'euclidean', 'dotproduct'].includes(metric)) {
      throw new HTTPException(400, { message: 'Invalid metric. Must be one of: cosine, euclidean, dotproduct' });
    }

    const vector = getVector(mastra, vectorName);
    await vector.createIndex({ indexName, dimension, metric });
    return { success: true };
  } catch (error) {
    return handleError(error, 'Error creating index');
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
    if (!indexName || !queryVector || !Array.isArray(queryVector)) {
      throw new HTTPException(400, { message: 'Invalid request query. indexName and queryVector array are required.' });
    }

    const vector = getVector(mastra, vectorName);
    const results: QueryResult[] = await vector.query({ indexName, queryVector, topK, filter, includeVector });
    return results;
  } catch (error) {
    return handleError(error, 'Error querying vectors');
  }
}

// List indexes
export async function listIndexes({ mastra, vectorName }: Pick<VectorContext, 'mastra' | 'vectorName'>) {
  try {
    const vector = getVector(mastra, vectorName);

    const indexes = await vector.listIndexes();
    return indexes.filter(Boolean);
  } catch (error) {
    return handleError(error, 'Error listing indexes');
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
      throw new HTTPException(400, { message: 'Index name is required' });
    }

    const vector = getVector(mastra, vectorName);
    const stats: IndexStats = await vector.describeIndex({ indexName });

    return {
      dimension: stats.dimension,
      count: stats.count,
      metric: stats.metric?.toLowerCase(),
    };
  } catch (error) {
    return handleError(error, 'Error describing index');
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
      throw new HTTPException(400, { message: 'Index name is required' });
    }

    const vector = getVector(mastra, vectorName);
    await vector.deleteIndex({ indexName });
    return { success: true };
  } catch (error) {
    return handleError(error, 'Error deleting index');
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
  handler: async ({ mastra, vectorName, ...params }) => {
    try {
      const { indexName, vectors, metadata, ids } = params;

      if (!indexName || !vectors || !Array.isArray(vectors)) {
        throw new HTTPException(400, { message: 'Invalid request index. indexName and vectors array are required.' });
      }

      const vector = getVector(mastra, vectorName);
      const result = await vector.upsert({ indexName, vectors, metadata, ids });
      return { ids: result };
    } catch (error) {
      return handleError(error, 'Error upserting vectors');
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
  handler: async ({ mastra, vectorName, ...params }) => {
    try {
      const { indexName, dimension, metric } = params;

      if (!indexName || typeof dimension !== 'number' || dimension <= 0) {
        throw new HTTPException(400, {
          message: 'Invalid request index, indexName and positive dimension number are required.',
        });
      }

      if (metric && !['cosine', 'euclidean', 'dotproduct'].includes(metric)) {
        throw new HTTPException(400, { message: 'Invalid metric. Must be one of: cosine, euclidean, dotproduct' });
      }

      const vector = getVector(mastra, vectorName);
      await vector.createIndex({ indexName, dimension, metric });
      return { success: true };
    } catch (error) {
      return handleError(error, 'Error creating index');
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
  handler: async ({ mastra, vectorName, ...params }) => {
    try {
      const { indexName, queryVector, topK, filter, includeVector } = params;

      if (!indexName || !queryVector || !Array.isArray(queryVector)) {
        throw new HTTPException(400, {
          message: 'Invalid request query. indexName and queryVector array are required.',
        });
      }

      const vector = getVector(mastra, vectorName);
      const results: QueryResult[] = await vector.query({ indexName, queryVector, topK, filter, includeVector });
      return results;
    } catch (error) {
      return handleError(error, 'Error querying vectors');
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
  handler: async ({ mastra, vectorName }) => {
    try {
      const vector = getVector(mastra, vectorName);
      const indexes = await vector.listIndexes();
      return indexes.filter(Boolean);
    } catch (error) {
      return handleError(error, 'Error listing indexes');
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
  handler: async ({ mastra, vectorName, indexName }) => {
    try {
      if (!indexName) {
        throw new HTTPException(400, { message: 'Index name is required' });
      }

      const vector = getVector(mastra, vectorName);
      const stats: IndexStats = await vector.describeIndex({ indexName: indexName });

      return {
        dimension: stats.dimension,
        count: stats.count,
        metric: stats.metric?.toLowerCase(),
      };
    } catch (error) {
      return handleError(error, 'Error describing index');
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
  handler: async ({ mastra, vectorName, indexName }) => {
    try {
      if (!indexName) {
        throw new HTTPException(400, { message: 'Index name is required' });
      }

      const vector = getVector(mastra, vectorName);
      await vector.deleteIndex({ indexName: indexName });
      return { success: true };
    } catch (error) {
      return handleError(error, 'Error deleting index');
    }
  },
});
