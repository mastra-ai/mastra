import { z } from 'zod';
import {
  dateRangeSchema,
  dbTimestamps,
  environmentField,
  experimentIdField,
  organizationIdField,
  paginationArgsSchema,
  paginationInfoSchema,
  serviceNameField,
  sortDirectionSchema,
  userIdField,
} from '../shared';
import { spanIdField, traceIdField } from './tracing';

// ============================================================================
// Helper utilities
// ============================================================================

const createOmitKeys = <T extends z.ZodRawShape>(shape: T): { [K in keyof T]: true } =>
  Object.fromEntries(Object.keys(shape).map(k => [k, true])) as { [K in keyof T]: true };

const omitDbTimestamps = createOmitKeys(dbTimestamps);

// ============================================================================
// Field Schemas
// ============================================================================

const scorerNameField = z.string().describe('Name of the scorer (e.g., relevance, accuracy)');
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
    id: z.string().describe('Unique score record identifier'),
    timestamp: z.date().describe('When the score was recorded'),

    // Target
    traceId: traceIdField,
    spanId: spanIdField.nullish().describe('Span ID this score applies to'),

    // Score data
    scorerName: scorerNameField,
    score: scoreValueField,
    reason: scoreReasonField.nullish(),
    experimentId: experimentIdField.nullish(),

    // User-defined metadata (context fields stored here)
    metadata: z.record(z.unknown()).nullish().describe('User-defined metadata'),

    // Database timestamps
    ...dbTimestamps,
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
    scorerName: scorerNameField,
    score: scoreValueField,
    reason: scoreReasonField.optional(),
    metadata: z.record(z.unknown()).optional().describe('Additional scorer-specific metadata'),
    experimentId: experimentIdField.optional(),
  })
  .describe('User-provided score input');

/** User-facing score input type */
export type ScoreInput = z.infer<typeof scoreInputSchema>;

// ============================================================================
// Create Score Schemas
// ============================================================================

/** Schema for creating a score record (without db timestamps) */
export const createScoreRecordSchema = scoreRecordSchema.omit(omitDbTimestamps);

/** Score record for creation (excludes db timestamps) */
export type CreateScoreRecord = z.infer<typeof createScoreRecordSchema>;

/** Schema for createScore operation arguments */
export const createScoreArgsSchema = z
  .object({
    score: createScoreRecordSchema,
  })
  .describe('Arguments for creating a score');

/** Arguments for creating a score */
export type CreateScoreArgs = z.infer<typeof createScoreArgsSchema>;

// ============================================================================
// Score Filter Schema
// ============================================================================

/** Schema for filtering scores in list queries */
export const scoresFilterSchema = z
  .object({
    // Date range
    timestamp: dateRangeSchema.optional().describe('Filter by score timestamp range'),

    // Target filters
    traceId: z.string().optional().describe('Filter by trace ID'),
    spanId: z.string().optional().describe('Filter by span ID'),

    // Score filters
    scorerName: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe('Filter by scorer name(s)'),
    experimentId: z.string().optional().describe('Filter by experiment or eval run identifier'),

    // Multi-tenancy filters
    organizationId: organizationIdField.optional(),
    userId: userIdField.optional(),

    // Environment filters
    serviceName: serviceNameField.optional(),
    environment: environmentField.optional(),
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
    filters: scoresFilterSchema.optional().describe('Optional filters to apply'),
    pagination: paginationArgsSchema.default({}).describe('Pagination settings'),
    orderBy: scoresOrderBySchema.default({}).describe('Ordering configuration (defaults to timestamp desc)'),
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
