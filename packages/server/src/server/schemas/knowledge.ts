import { z } from 'zod/v4';

export const knowledgePathParams = z.object({
  knowledgeKey: z.string().describe('Application key the Knowledge instance is registered under'),
});

export const knowledgePagePathParams = knowledgePathParams.extend({
  pageId: z.string().min(1).max(512).describe('Knowledge page id'),
});

const pageId = z.string().min(1).max(512);
const limit = z.coerce.number().int().min(1).max(100).optional();

export const knowledgeTreeQuerySchema = z.object({
  parentId: pageId.optional().describe('Page whose children to list; omit for the root scopes'),
  cursor: z.string().optional(),
  limit,
});

export const knowledgePageQuerySchema = z.object({
  noteCursor: z.string().optional(),
  noteLimit: limit,
});

export const knowledgeGraphQuerySchema = z.object({
  rootId: pageId.optional().describe('Page to walk from; omit to walk every root scope'),
  maxPages: z.coerce.number().int().min(1).max(500).optional(),
});

// A repeated param (`?scopeId=a&scopeId=b`) arrives as an array, a lone one as a string.
const scopeIds = z
  .union([z.string(), z.array(z.string())])
  .transform(value => (Array.isArray(value) ? value : [value]))
  .pipe(z.array(pageId).max(20));

export const knowledgeSearchQuerySchema = z.object({
  q: z.string().min(1).max(200).describe('Text to match in page names, synopses, bodies and notes'),
  scopeId: scopeIds.optional().describe('Only pages within these scopes'),
  limit,
});

export const knowledgeActivityQuerySchema = z.object({
  scopeId: pageId.optional(),
  pageId: pageId.optional(),
  cursor: z.string().optional(),
  limit,
});

// Payloads come from the @mastra/core/knowledge page readers; the UI package owns their TypeScript shapes.
const payload = z.record(z.string(), z.unknown());

export const listKnowledgeResponseSchema = z.object({
  instances: z.array(z.object({ key: z.string(), id: z.string() })),
});
export const knowledgeTreeResponseSchema = payload;
export const knowledgePageResponseSchema = payload;
export const knowledgeGraphResponseSchema = payload;
export const knowledgeSearchResponseSchema = z.object({ results: z.array(payload) });
export const knowledgeActivityResponseSchema = payload;
export const knowledgeEventsResponseSchema = z.object({
  kind: z.enum(['scope', 'page', 'note', 'pin']),
  op: z.string(),
  pageId: z.string().optional(),
  scopeId: z.string().optional(),
  at: z.string(),
});
