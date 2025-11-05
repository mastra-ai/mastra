import z from 'zod';

// Path parameter schemas
export const vectorNamePathParams = z.object({
  vectorName: z.string().describe('Name of the vector store'),
});

export const vectorIndexPathParams = z.object({
  vectorName: z.string().describe('Name of the vector store'),
  indexName: z.string().describe('Name of the index'),
});

// Body schemas
export const upsertVectorsBodySchema = z.object({
  indexName: z.string(),
  vectors: z.array(z.array(z.number())),
  metadata: z.array(z.record(z.string(), z.any())).optional(),
  ids: z.array(z.string()).optional(),
});

export const createIndexBodySchema = z.object({
  indexName: z.string(),
  dimension: z.number(),
  metric: z.enum(['cosine', 'euclidean', 'dotproduct']).optional(),
});

export const queryVectorsBodySchema = z.object({
  indexName: z.string(),
  queryVector: z.array(z.number()),
  topK: z.number().optional(),
  filter: z.record(z.string(), z.any()).optional(),
  includeVector: z.boolean().optional(),
});

// Response schemas
export const upsertVectorsResponseSchema = z.object({
  ids: z.array(z.string()),
});

export const createIndexResponseSchema = z.object({
  success: z.boolean(),
});

export const queryVectorsResponseSchema = z.array(z.unknown()); // QueryResult[]

export const listIndexesResponseSchema = z.array(z.string());

export const describeIndexResponseSchema = z.object({
  dimension: z.number(),
  count: z.number(),
  metric: z.string().optional(),
});

export const deleteIndexResponseSchema = z.object({
  success: z.boolean(),
});
