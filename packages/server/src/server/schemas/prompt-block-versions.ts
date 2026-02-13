import z from 'zod';
import { paginationInfoSchema, createPagePaginationSchema } from './common';

// ============================================================================
// Path Parameter Schemas
// ============================================================================

export const promptBlockVersionPathParams = z.object({
  promptBlockId: z.string().describe('Unique identifier for the stored prompt block'),
});

export const promptBlockVersionIdPathParams = z.object({
  promptBlockId: z.string().describe('Unique identifier for the stored prompt block'),
  versionId: z.string().describe('Unique identifier for the version (UUID)'),
});

// ============================================================================
// Query Parameter Schemas
// ============================================================================

const versionOrderBySchema = z.object({
  field: z.enum(['versionNumber', 'createdAt']).optional(),
  direction: z.enum(['ASC', 'DESC']).optional(),
});

export const listPromptBlockVersionsQuerySchema = createPagePaginationSchema(20).extend({
  orderBy: versionOrderBySchema.optional(),
});

export const comparePromptBlockVersionsQuerySchema = z.object({
  from: z.string().describe('Version ID (UUID) to compare from'),
  to: z.string().describe('Version ID (UUID) to compare to'),
});

// ============================================================================
// Body Parameter Schemas
// ============================================================================

export const createPromptBlockVersionBodySchema = z.object({
  changeMessage: z.string().max(500).optional().describe('Optional message describing the changes'),
});

// ============================================================================
// Response Schemas
// ============================================================================

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

export const promptBlockVersionSchema = z.object({
  id: z.string().describe('Unique identifier for the version (UUID)'),
  blockId: z.string().describe('ID of the prompt block this version belongs to'),
  versionNumber: z.number().describe('Sequential version number (1, 2, 3, ...)'),
  // Snapshot config fields
  name: z.string().describe('Display name of the prompt block'),
  description: z.string().optional().describe('Purpose description'),
  content: z.string().describe('Template content with {{variable}} interpolation'),
  rules: ruleGroupSchema.optional().describe('Rules for conditional inclusion'),
  // Version metadata
  changedFields: z.array(z.string()).optional().describe('Array of field names that changed from the previous version'),
  changeMessage: z.string().optional().describe('Optional message describing the changes'),
  createdAt: z.coerce.date().describe('When this version was created'),
});

export const listPromptBlockVersionsResponseSchema = paginationInfoSchema.extend({
  versions: z.array(promptBlockVersionSchema),
});

export const getPromptBlockVersionResponseSchema = promptBlockVersionSchema;

export const createPromptBlockVersionResponseSchema = promptBlockVersionSchema.partial().merge(
  z.object({
    id: z.string(),
    blockId: z.string(),
    versionNumber: z.number(),
    createdAt: z.coerce.date(),
  }),
);

export const activatePromptBlockVersionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  activeVersionId: z.string(),
});

export const restorePromptBlockVersionResponseSchema = promptBlockVersionSchema;

export const deletePromptBlockVersionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const versionDiffEntrySchema = z.object({
  field: z.string().describe('The field path that changed'),
  previousValue: z.unknown().describe('The value in the "from" version'),
  currentValue: z.unknown().describe('The value in the "to" version'),
});

export const comparePromptBlockVersionsResponseSchema = z.object({
  diffs: z.array(versionDiffEntrySchema),
  fromVersion: promptBlockVersionSchema,
  toVersion: promptBlockVersionSchema,
});
