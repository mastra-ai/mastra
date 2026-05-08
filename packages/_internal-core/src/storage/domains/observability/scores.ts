import { z } from 'zod/v4';
import {
  aggregateResponseFields,
  aggregationIntervalSchema,
  aggregationTypeSchema,
  aggregatedValueField,
  bucketTimestampField,
  comparePeriodSchema,
  commonFilterFields,
  experimentIdField,
  contextFields,
  dimensionsField,
  entityTypeField,
  groupBySchema,
  paginationArgsSchema,
  paginationInfoSchema,
  percentileField,
  percentileBucketValueField,
  percentilesSchema,
  sortDirectionSchema,
  spanIdField,
  traceIdField,
} from '../shared';

// ============================================================================
// Field Schemas
// ============================================================================

const scorerIdField = z.string().describe('Identifier of the scorer (e.g., relevance, accuracy)');
const scorerNameField = z.string().describe('Display name of the scorer');
const scorerVersionField = z.string().describe('Version of the scorer');
const scoreSourceField = z.string().describe('How the score was produced (e.g., manual, automated, experiment)');
const scoreValueField = z.number().describe('Score value (range defined by scorer)');
const scoreReasonField = z.string().describe('Explanation for the score');

// ============================================================================
// ScoreRecord Schema (Storage Format)
// ============================================================================

/**
 * Schema for scores as stored in the database.
 * Includes all fields from ExportedScore plus storage-specific fields.
 */
export const scoreRecordSchema = z
  .object({
    scoreId: z.string().nullish().describe('Unique id for this score event'),
    timestamp: z.date().describe('When the score was recorded'),

    // Target
    traceId: traceIdField.nullish().describe('Trace that anchors the scored target when available'),
    spanId: spanIdField.nullish().describe('Span ID this score applies to'),

    // Score data
    scorerId: scorerIdField,
    scorerName: scorerNameField.nullish(),
    scorerVersion: scorerVersionField.nullish(),
    scoreSource: scoreSourceField.nullish(),
    /**
     * @deprecated Use `scoreSource` instead.
     */
    source: scoreSourceField.nullish(),
    score: scoreValueField,
    reason: scoreReasonField.nullish(),

    // Context (entity hierarchy, identity, correlation, deployment, experimentation)
    ...contextFields,

    /** Trace ID of the scoring run (links to trace that generated this score) */
    scoreTraceId: z.string().nullish().describe('Trace ID of the scoring run for debugging score generation'),

    // User-defined metadata (context fields stored here)
    metadata: z.record(z.string(), z.unknown()).nullish().describe('User-defined metadata'),
  })
  .describe('Score record as stored in the database');

/** Score record type for storage */
export type ScoreRecord = z.infer<typeof scoreRecordSchema>;

// ============================================================================
// ScoreInput Schema (User-Facing API)
// ============================================================================

/**
 * Schema for user-provided score input (minimal required fields).
 * The span/trace context adds traceId/spanId before emitting ExportedScore.
 */
export const scoreInputSchema = z
  .object({
    scorerId: scorerIdField,
    scorerName: scorerNameField.optional(),
    scorerVersion: scorerVersionField.optional(),
    scoreSource: scoreSourceField.optional(),
    /**
     * @deprecated Use `scoreSource` instead.
     */
    source: scoreSourceField.optional(),
    score: scoreValueField,
    reason: scoreReasonField.optional(),
    metadata: z.record(z.string(), z.unknown()).optional().describe('Additional scorer-specific metadata'),
    experimentId: experimentIdField.optional(),
    scoreTraceId: z.string().optional().describe('Trace ID of the scoring run for debugging score generation'),
    targetEntityType: entityTypeField.optional().describe('Entity type the scorer evaluated when known'),
  })
  .describe('User-provided score input');

/** User-facing score input type */
export type ScoreInput = z.infer<typeof scoreInputSchema>;

// ============================================================================
// Create Score Schemas
// ============================================================================

/** Schema for creating a score record */
export const createScoreRecordSchema = scoreRecordSchema;

/** Score record for creation */
export type CreateScoreRecord = z.infer<typeof createScoreRecordSchema>;

/** Schema for createScore operation arguments */
export const createScoreArgsSchema = z
  .object({
    score: createScoreRecordSchema,
  })
  .describe('Arguments for creating a score');

/** Arguments for creating a score */
export type CreateScoreArgs = z.infer<typeof createScoreArgsSchema>;

/** Schema for createScore operation body in client/server */
export const createScoreBodySchema = z
  .object({
    score: createScoreRecordSchema.omit({ timestamp: true }),
  })
  .describe('Arguments for creating a score');

/** Body for creating a score in client/server */
export type CreateScoreBody = z.infer<typeof createScoreBodySchema>;

/** Schema for createScore operation response */
export const createScoreResponseSchema = z.object({ success: z.boolean() }).describe('Response from creating a score');

/** Response from creating a score */
export type CreateScoreResponse = z.infer<typeof createScoreResponseSchema>;

/** Schema for batchCreateScores operation arguments */
export const batchCreateScoresArgsSchema = z
  .object({
    scores: z.array(createScoreRecordSchema),
  })
  .describe('Arguments for batch recording scores');

/** Arguments for batch creating scores */
export type BatchCreateScoresArgs = z.infer<typeof batchCreateScoresArgsSchema>;

// ============================================================================
// Score Filter Schema
// ============================================================================

/** Schema for filtering scores in list queries */
export const scoresFilterSchema = z
  .object({
    ...commonFilterFields,

    // Score-specific filters
    scorerId: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe('Filter by scorer ID(s)'),
    scoreSource: scoreSourceField.optional().describe('Filter by how the score was produced'),
    /**
     * @deprecated Use `scoreSource` instead.
     */
    source: scoreSourceField.optional().describe('Filter by how the score was produced'),
  })
  .describe('Filters for querying scores');

/** Filters for querying scores */
export type ScoresFilter = z.infer<typeof scoresFilterSchema>;

// ============================================================================
// List Scores Schemas
// ============================================================================

/** Fields available for ordering score results */
export const scoresOrderByFieldSchema = z
  .enum(['timestamp', 'score'])
  .describe("Field to order by: 'timestamp' | 'score'");

/** Order by configuration for score queries */
export const scoresOrderBySchema = z
  .object({
    field: scoresOrderByFieldSchema.default('timestamp').describe('Field to order by'),
    direction: sortDirectionSchema.default('DESC').describe('Sort direction'),
  })
  .describe('Order by configuration');

/** Schema for listScores operation arguments */
export const listScoresArgsSchema = z
  .object({
    filters: scoresFilterSchema.optional(),
    pagination: paginationArgsSchema.default({ page: 0, perPage: 10 }).describe('Pagination settings'),
    orderBy: scoresOrderBySchema
      .default({ field: 'timestamp', direction: 'DESC' })
      .describe('Ordering configuration (defaults to timestamp desc)'),
  })
  .describe('Arguments for listing scores');

/** Arguments for listing scores */
export type ListScoresArgs = z.input<typeof listScoresArgsSchema>;

/** Schema for listScores operation response */
export const listScoresResponseSchema = z.object({
  pagination: paginationInfoSchema,
  scores: z.array(scoreRecordSchema),
});

/** Response containing paginated scores */
export type ListScoresResponse = z.infer<typeof listScoresResponseSchema>;

// ============================================================================
// OLAP Query Schemas
// ============================================================================

export const getScoreAggregateArgsSchema = z
  .object({
    scorerId: scorerIdField,
    scoreSource: scoreSourceField.optional(),
    aggregation: aggregationTypeSchema,
    filters: scoresFilterSchema.optional(),
    comparePeriod: comparePeriodSchema.optional(),
  })
  .describe('Arguments for getting a score aggregate');

export type GetScoreAggregateArgs = z.infer<typeof getScoreAggregateArgsSchema>;

export const getScoreAggregateResponseSchema = z.object(aggregateResponseFields);

export type GetScoreAggregateResponse = z.infer<typeof getScoreAggregateResponseSchema>;

export const getScoreBreakdownArgsSchema = z
  .object({
    scorerId: scorerIdField,
    scoreSource: scoreSourceField.optional(),
    groupBy: groupBySchema,
    aggregation: aggregationTypeSchema,
    filters: scoresFilterSchema.optional(),
  })
  .describe('Arguments for getting a score breakdown');

export type GetScoreBreakdownArgs = z.infer<typeof getScoreBreakdownArgsSchema>;

export const getScoreBreakdownResponseSchema = z.object({
  groups: z.array(
    z.object({
      dimensions: dimensionsField,
      value: aggregatedValueField,
    }),
  ),
});

export type GetScoreBreakdownResponse = z.infer<typeof getScoreBreakdownResponseSchema>;

export const getScoreTimeSeriesArgsSchema = z
  .object({
    scorerId: scorerIdField,
    scoreSource: scoreSourceField.optional(),
    interval: aggregationIntervalSchema,
    aggregation: aggregationTypeSchema,
    filters: scoresFilterSchema.optional(),
    groupBy: groupBySchema.optional(),
  })
  .describe('Arguments for getting score time series');

export type GetScoreTimeSeriesArgs = z.infer<typeof getScoreTimeSeriesArgsSchema>;

export const getScoreTimeSeriesResponseSchema = z.object({
  series: z.array(
    z.object({
      name: z.string().describe('Series name (scorer ID or group key)'),
      points: z.array(
        z.object({
          timestamp: bucketTimestampField,
          value: aggregatedValueField,
        }),
      ),
    }),
  ),
});

export type GetScoreTimeSeriesResponse = z.infer<typeof getScoreTimeSeriesResponseSchema>;

export const getScorePercentilesArgsSchema = z
  .object({
    scorerId: scorerIdField,
    scoreSource: scoreSourceField.optional(),
    percentiles: percentilesSchema,
    interval: aggregationIntervalSchema,
    filters: scoresFilterSchema.optional(),
  })
  .describe('Arguments for getting score percentiles');

export type GetScorePercentilesArgs = z.infer<typeof getScorePercentilesArgsSchema>;

export const getScorePercentilesResponseSchema = z.object({
  series: z.array(
    z.object({
      percentile: percentileField,
      points: z.array(
        z.object({
          timestamp: bucketTimestampField,
          value: percentileBucketValueField,
        }),
      ),
    }),
  ),
});

export type GetScorePercentilesResponse = z.infer<typeof getScorePercentilesResponseSchema>;
