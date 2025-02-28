import type { MastraVector, QueryResult, IndexStats } from '@mastra/core/vector';
import type { Context } from 'hono';

import { HTTPException } from 'hono/http-exception';

import { handleError } from './error';

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

export const getVector = (c: Context, vectorName: string): MastraVector => {
  const vector = c.get('mastra').getVector(vectorName);
  if (!vector) {
    throw new HTTPException(404, { message: `Vector store ${vectorName} not found` });
  }
  return vector;
};

// Upsert vectors
export async function upsertVectors(c: Context) {
  try {
    const vectorName = c.req.param('vectorName');
    const { indexName, vectors, metadata, ids } = await c.req.json<UpsertRequest>();

    if (!indexName || !vectors || !Array.isArray(vectors)) {
      throw new HTTPException(400, { message: 'Invalid request body. indexName and vectors array are required.' });
    }

    const vector = getVector(c, vectorName);
    const result = await vector.upsert({ indexName, vectors, metadata, ids });
    return c.json({ ids: result });
  } catch (error) {
    return handleError(error, 'Error upserting vectors');
  }
}

// Create index
export async function createIndex(c: Context) {
  try {
    const vectorName = c.req.param('vectorName');
    const { indexName, dimension, metric } = await c.req.json<CreateIndexRequest>();

    if (!indexName || typeof dimension !== 'number' || dimension <= 0) {
      throw new HTTPException(400, {
        message: 'Invalid request body. indexName and positive dimension number are required.',
      });
    }

    if (metric && !['cosine', 'euclidean', 'dotproduct'].includes(metric)) {
      throw new HTTPException(400, { message: 'Invalid metric. Must be one of: cosine, euclidean, dotproduct' });
    }

    const vector = getVector(c, vectorName);
    await vector.createIndex({ indexName, dimension, metric });
    return c.json({ success: true });
  } catch (error) {
    return handleError(error, 'Error creating index');
  }
}

// Query vectors
export async function queryVectors(c: Context) {
  try {
    const vectorName = c.req.param('vectorName');
    const { indexName, queryVector, topK = 10, filter, includeVector = false } = await c.req.json<QueryRequest>();

    if (!indexName || !queryVector || !Array.isArray(queryVector)) {
      throw new HTTPException(400, { message: 'Invalid request body. indexName and queryVector array are required.' });
    }

    const vector = getVector(c, vectorName);
    const results: QueryResult[] = await vector.query({ indexName, queryVector, topK, filter, includeVector });
    return c.json({ results });
  } catch (error) {
    return handleError(error, 'Error querying vectors');
  }
}

// List indexes
export async function listIndexes(c: Context) {
  try {
    const vectorName = c.req.param('vectorName');
    const vector = getVector(c, vectorName);

    const indexes = await vector.listIndexes();
    return c.json({ indexes: indexes.filter(Boolean) });
  } catch (error) {
    return handleError(error, 'Error listing indexes');
  }
}

// Describe index
export async function describeIndex(c: Context) {
  try {
    const vectorName = c.req.param('vectorName');
    const indexName = c.req.param('indexName');

    if (!indexName) {
      throw new HTTPException(400, { message: 'Index name is required' });
    }

    const vector = getVector(c, vectorName);
    const stats: IndexStats = await vector.describeIndex(indexName);

    return c.json({
      dimension: stats.dimension,
      count: stats.count,
      metric: stats.metric?.toLowerCase(),
    });
  } catch (error) {
    return handleError(error, 'Error describing index');
  }
}

// Delete index
export async function deleteIndex(c: Context) {
  try {
    const vectorName = c.req.param('vectorName');
    const indexName = c.req.param('indexName');

    if (!indexName) {
      throw new HTTPException(400, { message: 'Index name is required' });
    }

    const vector = getVector(c, vectorName);
    await vector.deleteIndex(indexName);
    return c.json({ success: true });
  } catch (error) {
    return handleError(error, 'Error deleting index');
  }
}
