import type { Mastra } from '@mastra/core';
import type { MastraVector, QueryResult } from '@mastra/core/vector';
import {
  upsertVectors as getOriginalUpsertVectorsHandler,
  createIndex as getOriginalCreateIndexHandler,
  queryVectors as getOriginalQueryVectorsHandler,
  listIndexes as getOriginalListIndexesHandler,
  describeIndex as getOriginalDescribeIndexHandler,
  deleteIndex as getOriginalDeleteIndexHandler,
} from '@mastra/server/handlers/vector';
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
    const mastra: Mastra = c.get('mastra');
    const vectorName = c.req.param('vectorName');
    const body = await c.req.json<UpsertRequest>();

    const result = await getOriginalUpsertVectorsHandler({
      mastra,
      vectorName,
      index: body,
    });

    return c.json({ ids: result });
  } catch (error) {
    return handleError(error, 'Error upserting vectors');
  }
}

// Create index
export async function createIndex(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const vectorName = c.req.param('vectorName');
    const body = await c.req.json<CreateIndexRequest>();

    await getOriginalCreateIndexHandler({
      mastra,
      vectorName,
      index: body,
    });

    return c.json({ success: true });
  } catch (error) {
    return handleError(error, 'Error creating index');
  }
}

// Query vectors
export async function queryVectors(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const vectorName = c.req.param('vectorName');
    const { indexName, queryVector, topK = 10, filter, includeVector = false } = await c.req.json<QueryRequest>();

    const results: QueryResult[] = await getOriginalQueryVectorsHandler({
      mastra,
      vectorName,
      query: { indexName, queryVector, topK, filter, includeVector },
    });

    return c.json({ results });
  } catch (error) {
    return handleError(error, 'Error querying vectors');
  }
}

// List indexes
export async function listIndexes(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const vectorName = c.req.param('vectorName');

    const indexes = await getOriginalListIndexesHandler({
      mastra,
      vectorName,
    });

    return c.json({ indexes });
  } catch (error) {
    return handleError(error, 'Error listing indexes');
  }
}

// Describe index
export async function describeIndex(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const vectorName = c.req.param('vectorName');
    const indexName = c.req.param('indexName');

    if (!indexName) {
      throw new HTTPException(400, { message: 'Index name is required' });
    }

    const stats = await getOriginalDescribeIndexHandler({
      mastra,
      vectorName,
      indexName,
    });

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
    const mastra: Mastra = c.get('mastra');
    const vectorName = c.req.param('vectorName');
    const indexName = c.req.param('indexName');

    if (!indexName) {
      throw new HTTPException(400, { message: 'Index name is required' });
    }

    await getOriginalDeleteIndexHandler({
      mastra,
      vectorName,
      indexName,
    });

    return c.json({ success: true });
  } catch (error) {
    return handleError(error, 'Error deleting index');
  }
}
