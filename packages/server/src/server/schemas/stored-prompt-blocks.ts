import z from 'zod';

import { paginationInfoSchema, createPagePaginationSchema, statusQuerySchema } from './common';
import { ruleGroupSchema } from './rule-group';

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
    .describe('Filter prompt blocks by status. When omitted, returns all prompt blocks regardless of status'),
  authorId: z.string().optional().describe('Filter prompt blocks by author identifier'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Filter prompt blocks by metadata key-value pairs'),
});

// ============================================================================
// Body Parameter Schemas
// ============================================================================

const snapshotConfigSchema = z.object({
  name: z.string().describe('Display name of the prompt block'),
  description: z.string().optional().describe('Purpose description'),
  content: z.string().describe('Template content with {{variable}} interpolation'),
  rules: ruleGroupSchema.optional().describe('Rules for conditional inclusion'),
  requestContextSchema: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('JSON Schema defining available variables for {{variableName}} interpolation and conditions'),
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
  .merge(snapshotConfigSchema.partial());

// ============================================================================
// Response Schemas
// ============================================================================

export const storedPromptBlockSchema = z.object({
  id: z.string(),
  status: z.string().describe('Prompt block status: draft, published, or archived'),
  activeVersionId: z.string().optional(),
  hasDraft: z.boolean().optional().describe('Whether the prompt block has unpublished draft changes'),
  authorId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  name: z.string().describe('Display name of the prompt block'),
  description: z.string().optional().describe('Purpose description'),
  content: z.string().describe('Template content with {{variable}} interpolation'),
  rules: ruleGroupSchema.optional().describe('Rules for conditional inclusion'),
  requestContextSchema: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('JSON Schema defining available variables for {{variableName}} interpolation and conditions'),
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
