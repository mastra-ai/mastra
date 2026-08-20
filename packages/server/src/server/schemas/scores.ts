import { z } from 'zod/v4';
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
  source: z.enum(['code', 'stored', 'fs']),
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

// Shared flat query params for the unified score list/aggregate endpoints.
// HTTP query params must be flat; list values are comma-separated and
// `metadata` is a JSON-encoded object string.
const scoreListFilterQueryShape = {
  scorerIds: z.string().optional().describe('Comma-separated scorer IDs'),
  entityId: z.string().optional(),
  entityType: z.string().optional(),
  traceId: z.string().optional(),
  threadId: z.string().optional(),
  source: z.string().optional(),
  startDate: z.coerce.date().optional().describe('Inclusive lower bound on createdAt (ISO date)'),
  endDate: z.coerce.date().optional().describe('Inclusive upper bound on createdAt (ISO date)'),
  minScore: z.coerce.number().optional(),
  maxScore: z.coerce.number().optional(),
  metadata: z
    .string()
    .optional()
    .describe('JSON-encoded object of top-level metadata key/value filters (AND across keys)')
    .refine(
      value => {
        if (value === undefined) return true;
        try {
          const parsed = JSON.parse(value);
          return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
        } catch {
          return false;
        }
      },
      { message: 'metadata must be a JSON-encoded object' },
    ),
};

export const listScoresQuerySchema = z.object({
  ...scoreListFilterQueryShape,
  page: z.coerce.number().optional().default(0),
  perPage: z.coerce.number().optional().default(10),
});

export const aggregateScoresQuerySchema = z.object({
  ...scoreListFilterQueryShape,
  bucket: z.enum(['hour', 'day', 'week', 'month']).optional().describe('UTC time bucket for the aggregation'),
  groupBy: z
    .string()
    .optional()
    .describe("Comma-separated group-by dimensions: 'scorerId', 'entityId', or 'metadata:<key>'"),
  passThreshold: z.coerce.number().optional().describe('Scores >= this value count as passing (default 1)'),
});

export const aggregateScoresResponseSchema = z.object({
  rows: z.array(
    z.object({
      bucketStart: z.string().optional(),
      groups: z.array(z.string().nullable()).optional(),
      count: z.number(),
      avg: z.number(),
      p50: z.number(),
      p95: z.number(),
      passRate: z.number(),
    }),
  ),
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

// Thread scoring
export const scoreThreadsBodySchema = z.object({
  scorerName: z.string().min(1),
  targets: z
    .array(
      z.object({
        threadId: z.string().min(1),
        resourceId: z.string().optional(),
      }),
    )
    .min(1),
});

export const scoreThreadsResponseSchema = z.object({
  status: z.string(),
  message: z.string(),
  threadCount: z.number(),
});

export const scorerHealthResponseSchema = z.object({
  scorerId: z.string(),
  triggered: z.number(),
  sampled: z.number(),
  saved: z.number(),
  failed: z.number(),
  lastErrorMessage: z.string().optional(),
  lastErrorAt: z.number().optional(),
});

export const scoresMetadataKeysResponseSchema = z.object({
  keys: z.array(z.string()),
});
