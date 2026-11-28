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

const sequenceTime = z.iso.datetime({ offset: true });
const sequenceItemType = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);

export const knowledgeSequenceQuerySchema = z.object({
  since: sequenceTime
    .optional()
    .describe('Items that happened at or after this ISO 8601 date-time; timeline sequences only'),
  until: sequenceTime
    .optional()
    .describe('Items that happened before this ISO 8601 date-time; timeline sequences only'),
  order: z
    .enum(['desc', 'asc'])
    .optional()
    .describe(
      'Along the sequence order: newest first on a timeline and first position first on a position sequence by default',
    ),
  parent: z
    .string()
    .min(1)
    .max(512)
    .optional()
    .describe("One parent item's externalId: that item and the items under it"),
  type: z
    .union([sequenceItemType, z.array(sequenceItemType)])
    .transform(value => (Array.isArray(value) ? value : [value]))
    .pipe(z.array(sequenceItemType).min(1).max(20))
    .optional()
    .describe('Only items of these types; repeat the param for each, at most 20'),
  untyped: z
    .enum(['true', 'false'])
    .transform(value => value === 'true')
    .optional()
    .describe('Only untyped items, or with type also the untyped ones'),
  q: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe(
      'Keywords to match in item titles, bodies, link titles and property values; results are ranked, not paged',
    ),
  cursor: z
    .string()
    .refine(value => {
      // Reject malformed cursors at the HTTP boundary without requiring a newer Core value export.
      const time = /^t(-?\d+)_(.+)$/.exec(value);
      if (time) return Number.isSafeInteger(Number(time[1]));
      return /^p[0-9a-z]+_.+$/.test(value);
    }, 'Invalid sequence cursor')
    .optional(),
  limit,
});

const pageIds = z
  .union([z.string(), z.array(z.string())])
  .transform(value => (Array.isArray(value) ? value : [value]))
  .pipe(z.array(pageId).min(1).max(200));

export const knowledgeLinkCountsQuerySchema = z.object({
  pageId: pageIds.describe('Pages to count links for; repeat the param for each, at most 200'),
});

export const knowledgePageLinksQuerySchema = z.object({
  direction: z.enum(['in', 'out', 'both']).optional().describe('Links into the page, out of it, or both (default)'),
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
export const knowledgeLinkCountsResponseSchema = z.object({
  counts: z.record(z.string(), z.object({ in: z.number(), out: z.number() })),
});
export const knowledgePageLinksResponseSchema = z.object({
  edges: z.array(
    z.object({ fromPageId: z.string(), toPageId: z.string(), kind: z.enum(['body', 'note']), count: z.number() }),
  ),
  pages: z.array(payload),
  truncated: z.boolean(),
});
export const knowledgeActivityResponseSchema = payload;
export const knowledgeSequenceResponseSchema = z.object({
  items: z.array(payload),
  nextCursor: z.string().nullable(),
});
export const knowledgeEventsResponseSchema = z.object({
  kind: z.enum(['scope', 'page', 'note', 'pin']),
  op: z.string(),
  pageId: z.string().optional(),
  scopeId: z.string().optional(),
  at: z.string(),
});
