import type { Tool } from '@mastra/core/tools';
import { z } from 'zod';
import { queryTextDescription, topKDescription, filterDescription } from './default-settings';

export const baseSchema = {
  queryText: z.string().describe(queryTextDescription),
  topK: z.coerce.number().describe(topKDescription),
};

// Output schema includes `sources`, which exposes the full set of retrieved chunks (QueryResult objects)
// Each source contains all information needed to reference
// the original document, chunk, and similarity score.
export const outputSchema = z.object({
  // Array of metadata or content for compatibility with prior usage
  relevantContext: z.any(),
  // Array of full retrieval result objects
  sources: z.array(
    z.object({
      id: z.string(), // Unique chunk/document identifier
      metadata: z.any(), // All metadata fields (document ID, etc.)
      vector: z.array(z.number()), // Embedding vector (if available)
      score: z.number(), // Similarity score for this retrieval
      document: z.string(), // Full chunk/document text (if available)
    }),
  ),
});

export const filterSchema = z.object({
  ...baseSchema,
  filter: z.coerce.string().describe(filterDescription),
});

export type RagTool<
  TInput extends z.ZodType<any, z.ZodTypeDef, any> | undefined,
  TOutput extends z.ZodType<any, z.ZodTypeDef, any> | undefined,
> = Tool<TInput, TOutput> & {
  execute: NonNullable<Tool<TInput, TOutput>['execute']>;
};
