import z from 'zod';
import { successResponseSchema } from './common';

// Path parameter schemas
export const vectorNamePathParams = z.object({
  vectorName: z.string().describe('Name of the vector store'),
});

export const vectorIndexPathParams = vectorNamePathParams.extend({
  indexName: z.string().describe('Name of the index'),
});

// Body schemas
// Base schema for operations that require an index name
const indexBodyBaseSchema = z.object({
  indexName: z.string(),
});

export const upsertVectorsBodySchema = indexBodyBaseSchema.extend({
  vectors: z.array(z.array(z.number())),
  metadata: z.array(z.record(z.string(), z.any())).optional(),
  ids: z.array(z.string()).optional(),
});

export const createIndexBodySchema = indexBodyBaseSchema.extend({
  dimension: z.number(),
  metric: z.enum(['cosine', 'euclidean', 'dotproduct']).optional(),
});

export const queryVectorsBodySchema = indexBodyBaseSchema.extend({
  queryVector: z.array(z.number()),
  topK: z.number().optional(),
  filter: z.record(z.string(), z.any()).optional(),
  includeVector: z.boolean().optional(),
});

// Response schemas
export const upsertVectorsResponseSchema = z.object({
  ids: z.array(z.string()),
});

export const createIndexResponseSchema = successResponseSchema;

export const queryVectorsResponseSchema = z.array(z.unknown()); // QueryResult[]

export const listIndexesResponseSchema = z.array(z.string());

export const describeIndexResponseSchema = z.object({
  dimension: z.number(),
  count: z.number(),
  metric: z.string().optional(),
});

export const deleteIndexResponseSchema = successResponseSchema;
