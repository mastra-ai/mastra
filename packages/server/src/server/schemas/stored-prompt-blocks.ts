import z from 'zod';

import { paginationInfoSchema, createPagePaginationSchema, statusQuerySchema } from './common';

// ============================================================================
// Path Parameter Schemas
// ============================================================================

export const storedPromptBlockIdPathParams = z.object({
  storedPromptBlockId: z.string().describe('Unique identifier for the stored prompt block'),
});

// ============================================================================
// Query Parameter Schemas
// ============================================================================

const storageOrderBySchema = z.object({
  field: z.enum(['createdAt', 'updatedAt']).optional(),
  direction: z.enum(['ASC', 'DESC']).optional(),
});

export { statusQuerySchema };

export const listStoredPromptBlocksQuerySchema = createPagePaginationSchema(100).extend({
  orderBy: storageOrderBySchema.optional(),
  status: z
    .enum(['draft', 'published', 'archived'])
    .optional()
    .default('published')
    .describe('Filter prompt blocks by status (defaults to published)'),
  authorId: z.string().optional().describe('Filter prompt blocks by author identifier'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Filter prompt blocks by metadata key-value pairs'),
});

// ============================================================================
// Body Parameter Schemas
// ============================================================================

/**
 * Rule and RuleGroup schemas for conditional prompt block evaluation.
 */
const ruleSchema = z.object({
  field: z.string(),
  operator: z.enum([
    'equals',
    'not_equals',
    'contains',
    'not_contains',
    'greater_than',
    'less_than',
    'greater_than_or_equal',
    'less_than_or_equal',
    'in',
    'not_in',
    'exists',
    'not_exists',
  ]),
  value: z.unknown(),
});

/**
 * Rule group schema with a fixed nesting depth (3 levels) to avoid
 * infinite recursion when converting to JSON Schema / OpenAPI.
 */
const ruleGroupDepth2 = z.object({
  operator: z.enum(['AND', 'OR']),
  conditions: z.array(ruleSchema),
});

const ruleGroupDepth1 = z.object({
  operator: z.enum(['AND', 'OR']),
  conditions: z.array(z.union([ruleSchema, ruleGroupDepth2])),
});

const ruleGroupSchema = z.object({
  operator: z.enum(['AND', 'OR']),
  conditions: z.array(z.union([ruleSchema, ruleGroupDepth1])),
});

const snapshotConfigSchema = z.object({
  name: z.string().describe('Display name of the prompt block'),
  description: z.string().optional().describe('Purpose description'),
  content: z.string().describe('Template content with {{variable}} interpolation'),
  rules: ruleGroupSchema.optional().describe('Rules for conditional inclusion'),
});

export const createStoredPromptBlockBodySchema = z
  .object({
    id: z.string().optional().describe('Unique identifier. If not provided, derived from name.'),
    authorId: z.string().optional().describe('Author identifier for multi-tenant filtering'),
    metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata for the prompt block'),
  })
  .merge(snapshotConfigSchema);

export const updateStoredPromptBlockBodySchema = z
  .object({
    authorId: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .partial()
  .merge(snapshotConfigSchema.partial());

// ============================================================================
// Response Schemas
// ============================================================================

export const storedPromptBlockSchema = z.object({
  id: z.string(),
  status: z.string().describe('Prompt block status: draft, published, or archived'),
  activeVersionId: z.string().optional(),
  authorId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  name: z.string().describe('Display name of the prompt block'),
  description: z.string().optional().describe('Purpose description'),
  content: z.string().describe('Template content with {{variable}} interpolation'),
  rules: ruleGroupSchema.optional().describe('Rules for conditional inclusion'),
});

export const listStoredPromptBlocksResponseSchema = paginationInfoSchema.extend({
  promptBlocks: z.array(storedPromptBlockSchema),
});

export const getStoredPromptBlockResponseSchema = storedPromptBlockSchema;
export const createStoredPromptBlockResponseSchema = storedPromptBlockSchema;

export const updateStoredPromptBlockResponseSchema = z.union([
  z.object({
    id: z.string(),
    status: z.string(),
    activeVersionId: z.string().optional(),
    authorId: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  }),
  storedPromptBlockSchema,
]);

export const deleteStoredPromptBlockResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
