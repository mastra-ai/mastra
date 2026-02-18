import z from 'zod';

import { paginationInfoSchema, createPagePaginationSchema, statusQuerySchema } from './common';
import { modelConfigSchema } from './stored-agents';

// ============================================================================
// Path Parameter Schemas
// ============================================================================

export const storedScorerIdPathParams = z.object({
  storedScorerId: z.string().describe('Unique identifier for the stored scorer definition'),
});

// ============================================================================
// Query Parameter Schemas
// ============================================================================

const storageOrderBySchema = z.object({
  field: z.enum(['createdAt', 'updatedAt']).optional(),
  direction: z.enum(['ASC', 'DESC']).optional(),
});

export { statusQuerySchema };

export const listStoredScorersQuerySchema = createPagePaginationSchema(100).extend({
  orderBy: storageOrderBySchema.optional(),
  status: z
    .enum(['draft', 'published', 'archived'])
    .optional()
    .default('published')
    .describe('Filter scorers by status (defaults to published)'),
  authorId: z.string().optional().describe('Filter scorers by author identifier'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Filter scorers by metadata key-value pairs'),
});

// ============================================================================
// Body Parameter Schemas
// ============================================================================

const samplingConfigSchema = z.union([
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('ratio'), rate: z.number().min(0).max(1) }),
]);

const scorerTypeEnum = z
  .enum([
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
  ])
  .describe('Scorer type: llm-judge for custom, or a preset type name');

const snapshotConfigSchema = z.object({
  name: z.string().describe('Name of the scorer'),
  description: z.string().optional().describe('Description of the scorer'),
  type: scorerTypeEnum,
  model: modelConfigSchema.optional().describe('Model configuration for LLM judge'),
  instructions: z.string().optional().describe('System instructions for the judge LLM (used when type is llm-judge)'),
  scoreRange: z
    .object({
      min: z.number().optional().describe('Minimum score value (default: 0)'),
      max: z.number().optional().describe('Maximum score value (default: 1)'),
    })
    .optional()
    .describe('Score range configuration (used when type is llm-judge)'),
  presetConfig: z.record(z.string(), z.unknown()).optional().describe('Serializable config options for preset scorers'),
  defaultSampling: samplingConfigSchema.optional().describe('Default sampling configuration'),
});

export const createStoredScorerBodySchema = z
  .object({
    id: z.string().optional().describe('Unique identifier. If not provided, derived from name.'),
    authorId: z.string().optional().describe('Author identifier for multi-tenant filtering'),
    metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata for the scorer'),
  })
  .merge(snapshotConfigSchema);

export const updateStoredScorerBodySchema = z
  .object({
    authorId: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .partial()
  .merge(snapshotConfigSchema.partial());

// ============================================================================
// Response Schemas
// ============================================================================

export const storedScorerSchema = z.object({
  id: z.string(),
  status: z.string().describe('Scorer status: draft, published, or archived'),
  activeVersionId: z.string().optional(),
  authorId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  name: z.string().describe('Name of the scorer'),
  description: z.string().optional().describe('Description of the scorer'),
  type: scorerTypeEnum,
  model: modelConfigSchema.optional(),
  instructions: z.string().optional().describe('System instructions for the judge LLM'),
  scoreRange: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .optional(),
  presetConfig: z.record(z.string(), z.unknown()).optional(),
  defaultSampling: samplingConfigSchema.optional(),
});

export const listStoredScorersResponseSchema = paginationInfoSchema.extend({
  scorerDefinitions: z.array(storedScorerSchema),
});

export const getStoredScorerResponseSchema = storedScorerSchema;
export const createStoredScorerResponseSchema = storedScorerSchema;

export const updateStoredScorerResponseSchema = z.union([
  z.object({
    id: z.string(),
    status: z.string(),
    activeVersionId: z.string().optional(),
    authorId: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  }),
  storedScorerSchema,
]);

export const deleteStoredScorerResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
