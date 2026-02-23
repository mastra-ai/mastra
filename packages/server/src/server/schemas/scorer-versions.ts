import z from 'zod';
import { modelConfigSchema } from './stored-agents';
import {
  listVersionsQuerySchema,
  compareVersionsQuerySchema,
  createVersionBodySchema,
  activateVersionResponseSchema,
  deleteVersionResponseSchema,
  versionDiffEntrySchema,
  createListVersionsResponseSchema,
  createCompareVersionsResponseSchema,
} from './version-common';

// Re-export shared schemas under domain-specific names
export const listScorerVersionsQuerySchema = listVersionsQuerySchema;
export const compareScorerVersionsQuerySchema = compareVersionsQuerySchema;
export const createScorerVersionBodySchema = createVersionBodySchema;

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
// Response Schemas
// ============================================================================

const samplingConfigSchema = z.union([
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('ratio'), rate: z.number().min(0).max(1) }),
]);

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

export const listScorerVersionsResponseSchema = createListVersionsResponseSchema(scorerVersionSchema);

export const getScorerVersionResponseSchema = scorerVersionSchema;

export const createScorerVersionResponseSchema = scorerVersionSchema.partial().merge(
  z.object({
    id: z.string(),
    scorerDefinitionId: z.string(),
    versionNumber: z.number(),
    createdAt: z.coerce.date(),
  }),
);

export const activateScorerVersionResponseSchema = activateVersionResponseSchema;

export const restoreScorerVersionResponseSchema = scorerVersionSchema;

export const deleteScorerVersionResponseSchema = deleteVersionResponseSchema;

export const compareScorerVersionsResponseSchema = createCompareVersionsResponseSchema(scorerVersionSchema);

export { versionDiffEntrySchema };
