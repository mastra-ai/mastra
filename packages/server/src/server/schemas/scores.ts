import z from 'zod';

/**
 * Schema for sampling configuration
 * Using passthrough to allow various sampling config shapes
 */
const scoringSamplingConfigSchema = z.object({}).passthrough();

/**
 * Schema for MastraScorer properties
 */
const mastraScorerSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.unknown().optional(), // Can be string or object with schemas
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

export const runIdPathParams = z.object({
  runId: z.string().describe('Unique identifier for the run'),
});

export const entityPathParams = z.object({
  entityType: z.string().describe('Type of the entity (AGENT or WORKFLOW)'),
  entityId: z.string().describe('Unique identifier for the entity'),
});

// Query parameter schemas
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
const paginationInfoSchema = z.object({
  total: z.number(),
  page: z.number(),
  perPage: z.number(),
  hasMore: z.boolean(),
});

export const scoresWithPaginationResponseSchema = z.object({
  pagination: paginationInfoSchema,
  scores: z.array(z.unknown()), // Array of score records
});

export const saveScoreResponseSchema = z.array(z.unknown());
