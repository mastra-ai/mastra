import { z } from 'zod/v4';

export const knowledgePathParams = z.object({
  knowledgeKey: z.string().describe('Application key the Knowledge instance is registered under'),
});

export const knowledgeNodePathParams = knowledgePathParams.extend({
  nodeId: z.string().min(1).max(512).describe('Knowledge node id'),
});

// Query strings carry a repeated `scope` param (`?scope=org:a&scope=project:b`); a lone value arrives as a string.
const scopeTags = z
  .union([z.string(), z.array(z.string())])
  .transform(value => (Array.isArray(value) ? value : [value]))
  .pipe(z.array(z.string().min(1)).min(1).max(8))
  .describe('Scope tags the viewer holds. A record is visible when all of its tags are in this set.');

export const knowledgeViewQuerySchema = z.object({ scope: scopeTags });

export const knowledgeSearchQuerySchema = knowledgeViewQuerySchema.extend({
  q: z.string().max(200).describe('Case-insensitive name search; shorter than 2 characters returns nothing'),
});

export const knowledgeActivityQuerySchema = knowledgeViewQuerySchema.extend({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// Payloads are produced by @mastra/core/knowledge readers; the UI package owns their TypeScript shapes.
const payload = z.record(z.string(), z.unknown());

export const listKnowledgeResponseSchema = z.object({
  instances: z.array(z.object({ key: z.string(), id: z.string() })),
});
export const knowledgeGraphResponseSchema = payload;
export const knowledgeNodeResponseSchema = payload;
export const knowledgeSearchResponseSchema = z.object({
  results: z.array(payload),
  truncated: z.boolean(),
});
export const knowledgeActivityResponseSchema = payload;
