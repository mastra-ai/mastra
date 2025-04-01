import type { MastraVector, QueryResult, IndexStats } from '@mastra/core/vector';
import { HTTPException } from '../http-exception';
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
export async function upsertVectors({ mastra, vectorName, index }: VectorContext & { index: UpsertRequest }) {
  try {
    if (!index?.indexName || !index?.vectors || !Array.isArray(index.vectors)) {
      throw new HTTPException(400, { message: 'Invalid request index. indexName and vectors array are required.' });
    }

    const vector = getVector(mastra, vectorName);
    const result = await vector.upsert(index);
    return { ids: result };
  } catch (error) {
    return handleError(error, 'Error upserting vectors');
  }
}

// Create index
export async function createIndex({
  mastra,
  vectorName,
  index,
}: Pick<VectorContext, 'mastra' | 'vectorName'> & { index: CreateIndexRequest }) {
  try {
    const { indexName, dimension, metric } = index;

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
  query,
}: Pick<VectorContext, 'mastra' | 'vectorName'> & { query: QueryRequest }) {
  try {
    if (!query?.indexName || !query?.queryVector || !Array.isArray(query.queryVector)) {
      throw new HTTPException(400, { message: 'Invalid request query. indexName and queryVector array are required.' });
    }

    const vector = getVector(mastra, vectorName);
    const results: QueryResult[] = await vector.query(query);
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
    const stats: IndexStats = await vector.describeIndex(indexName);

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
    await vector.deleteIndex(indexName);
    return { success: true };
  } catch (error) {
    return handleError(error, 'Error deleting index');
  }
}
