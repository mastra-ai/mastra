import z from 'zod';
import { paginationInfoSchema } from './common';

/**
 * Schema for sampling configuration
 * Using passthrough to allow various sampling config shapes
 */
const scoringSamplingConfigSchema = z.object({});

/**
 * Schema for MastraScorer config object
 */
const mastraScorerConfigSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string(),
  type: z.unknown().optional(),
  judge: z.unknown().optional(),
});

/**
 * Schema for MastraScorer
 * Only validates public config property, uses passthrough to allow class instance
 */
const mastraScorerSchema = z.object({
  config: mastraScorerConfigSchema,
});

/**
 * Schema for scorer entry with associations to agents and workflows
 */
export const scorerEntrySchema = z.object({
  scorer: mastraScorerSchema,
  sampling: scoringSamplingConfigSchema.optional(),
  agentIds: z.array(z.string()),
  agentNames: z.array(z.string()),
  workflowIds: z.array(z.string()),
  isRegistered: z.boolean(),
});

/**
 * Response schema for list scorers endpoint
 * Returns a record of scorer ID to scorer entry with associations
 */
export const listScorersResponseSchema = z.record(z.string(), scorerEntrySchema);

// Path parameter schemas
export const scorerIdPathParams = z.object({
  scorerId: z.string().describe('Unique identifier for the scorer'),
});

export const entityPathParams = z.object({
  entityType: z.string().describe('Type of the entity (AGENT or WORKFLOW)'),
  entityId: z.string().describe('Unique identifier for the entity'),
});

// Query parameter schemas
// HTTP query params must be flat (e.g., ?page=0&perPage=10)
// Adapters should transform these into nested pagination objects for handlers if needed

export const listScoresByRunIdQuerySchema = z.object({
  page: z.coerce.number().optional().default(0),
  perPage: z.coerce.number().optional().default(10),
});

export const listScoresByScorerIdQuerySchema = z.object({
  page: z.coerce.number().optional().default(0),
  perPage: z.coerce.number().optional().default(10),
  entityId: z.string().optional(),
  entityType: z.string().optional(),
});

export const listScoresByEntityIdQuerySchema = z.object({
  page: z.coerce.number().optional().default(0),
  perPage: z.coerce.number().optional().default(10),
});

// Body schema for saving scores
export const saveScoreBodySchema = z.object({
  score: z.unknown(), // ScoreRowData - complex type
});

// Response schemas
export const scoresWithPaginationResponseSchema = z.object({
  pagination: paginationInfoSchema,
  scores: z.array(z.unknown()), // Array of score records
});

export const saveScoreResponseSchema = z.object({
  score: z.unknown(), // ScoreRowData
});
