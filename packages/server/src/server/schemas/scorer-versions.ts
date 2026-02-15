import z from 'zod';
import { paginationInfoSchema, createPagePaginationSchema } from './common';

// ============================================================================
// Path Parameter Schemas
// ============================================================================

export const scorerVersionPathParams = z.object({
  scorerId: z.string().describe('Unique identifier for the stored scorer definition'),
});

export const scorerVersionIdPathParams = z.object({
  scorerId: z.string().describe('Unique identifier for the stored scorer definition'),
  versionId: z.string().describe('Unique identifier for the version (UUID)'),
});

// ============================================================================
// Query Parameter Schemas
// ============================================================================

const versionOrderBySchema = z.object({
  field: z.enum(['versionNumber', 'createdAt']).optional(),
  direction: z.enum(['ASC', 'DESC']).optional(),
});

export const listScorerVersionsQuerySchema = createPagePaginationSchema(20).extend({
  orderBy: versionOrderBySchema.optional(),
});

export const compareScorerVersionsQuerySchema = z.object({
  from: z.string().describe('Version ID (UUID) to compare from'),
  to: z.string().describe('Version ID (UUID) to compare to'),
});

// ============================================================================
// Body Parameter Schemas
// ============================================================================

export const createScorerVersionBodySchema = z.object({
  changeMessage: z.string().max(500).optional().describe('Optional message describing the changes'),
});

// ============================================================================
// Response Schemas
// ============================================================================

const samplingConfigSchema = z.union([
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('ratio'), rate: z.number().min(0).max(1) }),
]);

const modelConfigSchema = z
  .object({
    provider: z.string(),
    name: z.string(),
  })
  .passthrough();

const scorerTypeEnum = z.enum([
  'llm-judge',
  'answer-relevancy',
  'answer-similarity',
  'bias',
  'context-precision',
  'context-relevance',
  'faithfulness',
  'hallucination',
  'noise-sensitivity',
  'prompt-alignment',
  'tool-call-accuracy',
  'toxicity',
]);

export const scorerVersionSchema = z.object({
  id: z.string().describe('Unique identifier for the version (UUID)'),
  scorerDefinitionId: z.string().describe('ID of the scorer this version belongs to'),
  versionNumber: z.number().describe('Sequential version number (1, 2, 3, ...)'),
  // Snapshot config fields
  name: z.string().describe('Name of the scorer'),
  description: z.string().optional().describe('Description of the scorer'),
  type: scorerTypeEnum,
  model: modelConfigSchema.optional(),
  instructions: z.string().optional(),
  scoreRange: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .optional(),
  presetConfig: z.record(z.string(), z.unknown()).optional(),
  defaultSampling: samplingConfigSchema.optional(),
  // Version metadata
  changedFields: z.array(z.string()).optional().describe('Array of field names that changed from the previous version'),
  changeMessage: z.string().optional().describe('Optional message describing the changes'),
  createdAt: z.coerce.date().describe('When this version was created'),
});

export const listScorerVersionsResponseSchema = paginationInfoSchema.extend({
  versions: z.array(scorerVersionSchema),
});

export const getScorerVersionResponseSchema = scorerVersionSchema;

export const createScorerVersionResponseSchema = scorerVersionSchema.partial().merge(
  z.object({
    id: z.string(),
    scorerDefinitionId: z.string(),
    versionNumber: z.number(),
    createdAt: z.coerce.date(),
  }),
);

export const activateScorerVersionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  activeVersionId: z.string(),
});

export const restoreScorerVersionResponseSchema = scorerVersionSchema;

export const deleteScorerVersionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const versionDiffEntrySchema = z.object({
  field: z.string().describe('The field path that changed'),
  previousValue: z.unknown().describe('The value in the "from" version'),
  currentValue: z.unknown().describe('The value in the "to" version'),
});

export const compareScorerVersionsResponseSchema = z.object({
  diffs: z.array(versionDiffEntrySchema),
  fromVersion: scorerVersionSchema,
  toVersion: scorerVersionSchema,
});
