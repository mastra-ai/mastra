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

const feedbackSourceField = z.string().describe("Source of feedback (e.g., 'user', 'system', 'manual')");
const feedbackTypeField = z.string().describe("Type of feedback (e.g., 'thumbs', 'rating', 'correction')");
const feedbackValueField = z
  .union([z.number(), z.string()])
  .describe('Feedback value (rating number or correction text)');
const feedbackCommentField = z.string().describe('Additional comment or context');
const feedbackUserIdField = z.string().describe('User who provided the feedback');

function normalizeLegacyFeedbackActor<T>(input: T): T {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return input;
  }

  const record = { ...(input as Record<string, unknown>) };
  if (typeof record.userId === 'string' && record.feedbackUserId == null) {
    record.feedbackUserId = record.userId;
    delete record.userId;
  }

  return record as T;
}

// ============================================================================
// FeedbackRecord Schema (Storage Format)
// ============================================================================

/**
 * Schema for feedback as stored in the database.
 * Includes all fields from ExportedFeedback plus storage-specific fields.
 */
const feedbackRecordObjectSchema = z.object({
  feedbackId: z.string().nullish().describe('Unique id for this feedback event'),
  timestamp: z.date().describe('When the feedback was recorded'),

  // Target
  traceId: traceIdField.nullish().describe('Trace that anchors the feedback target when available'),
  spanId: spanIdField.nullish().describe('Span ID this feedback applies to'),

  // Feedback data
  feedbackSource: feedbackSourceField.nullish(),
  /**
   * @deprecated Use `feedbackSource` instead.
   */
  source: feedbackSourceField.nullish(),
  feedbackType: feedbackTypeField,
  value: feedbackValueField,
  comment: feedbackCommentField.nullish(),

  // Feedback actor identity
  feedbackUserId: feedbackUserIdField.nullish(),

  // Context (entity hierarchy, identity, correlation, deployment, experimentation)
  ...contextFields,

  // Source linkage (e.g. dataset item result ID)
  sourceId: z
    .string()
    .nullish()
    .describe('ID of the source record this feedback is linked to (e.g. experiment result ID)'),

  // User-defined metadata (context fields stored here)
  metadata: z.record(z.string(), z.unknown()).nullish().describe('User-defined metadata'),
});

export const feedbackRecordSchema = z
  .object(feedbackRecordObjectSchema.shape)
  .describe('Feedback record as stored in the database');

/** Feedback record type for storage */
export type FeedbackRecord = z.infer<typeof feedbackRecordSchema>;

// ============================================================================
// FeedbackInput Schema (User-Facing API)
// ============================================================================

/**
 * Schema for user-provided feedback input (minimal required fields).
 * The span/trace context adds traceId/spanId before emitting ExportedFeedback.
 */
const feedbackInputObjectSchema = z.object({
  feedbackSource: feedbackSourceField.optional(),
  /**
   * @deprecated Use `feedbackSource` instead.
   */
  source: feedbackSourceField.optional(),
  feedbackType: feedbackTypeField,
  value: feedbackValueField,
  comment: feedbackCommentField.optional(),
  feedbackUserId: feedbackUserIdField.optional(),
  /**
   * @deprecated Use `feedbackUserId` instead.
   */
  userId: feedbackUserIdField.optional(),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional feedback-specific metadata'),
  experimentId: experimentIdField.optional(),
  sourceId: z.string().optional().describe('ID of the source record this feedback is linked to'),
});

export const feedbackInputSchema = z.object(feedbackInputObjectSchema.shape).describe('User-provided feedback input');

/** User-facing feedback input type */
export type FeedbackInput = z.infer<typeof feedbackInputSchema>;

// ============================================================================
// Create Feedback Schemas
// ============================================================================

/** Schema for creating a feedback record */
export const createFeedbackRecordSchema = feedbackRecordSchema;

/** Feedback record for creation */
export type CreateFeedbackRecord = z.infer<typeof createFeedbackRecordSchema>;

/** Schema for createFeedback operation arguments */
export const createFeedbackArgsSchema = z
  .object({
    feedback: z.preprocess(normalizeLegacyFeedbackActor, feedbackRecordObjectSchema),
  })
  .describe('Arguments for creating feedback');

/** Arguments for creating feedback */
export type CreateFeedbackArgs = z.infer<typeof createFeedbackArgsSchema>;

/** Schema for createFeedback operation body in client/server */
export const createFeedbackBodySchema = z
  .object({
    feedback: feedbackRecordObjectSchema.omit({ timestamp: true }),
  })
  .describe('Arguments for creating feedback');

/** Body for creating feedback in client/server */
export type CreateFeedbackBody = z.infer<typeof createFeedbackBodySchema>;

/** Schema for createFeedback operation response */
export const createFeedbackResponseSchema = z
  .object({ success: z.boolean() })
  .describe('Response from creating feedback');

/** Response from creating feedback */
export type CreateFeedbackResponse = z.infer<typeof createFeedbackResponseSchema>;

/** Schema for batchCreateFeedback operation arguments */
export const batchCreateFeedbackArgsSchema = z
  .object({
    feedbacks: z.array(z.preprocess(normalizeLegacyFeedbackActor, feedbackRecordObjectSchema)),
  })
  .describe('Arguments for batch recording feedback');

/** Arguments for batch creating feedback */
export type BatchCreateFeedbackArgs = z.infer<typeof batchCreateFeedbackArgsSchema>;

// ============================================================================
// Feedback Filter Schema
// ============================================================================

/** Schema for filtering feedback in list queries */
const feedbackFilterObjectSchema = z.object({
  ...commonFilterFields,

  // Feedback-specific filters
  feedbackType: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe('Filter by feedback type(s)'),
  feedbackSource: feedbackSourceField.optional(),
  /**
   * @deprecated Use `feedbackSource` instead.
   */
  source: feedbackSourceField.optional(),
  feedbackUserId: feedbackUserIdField.optional(),
});

export const feedbackFilterSchema = z
  .object(feedbackFilterObjectSchema.shape)
  .describe('Filters for querying feedback');

/** Filters for querying feedback */
export type FeedbackFilter = z.infer<typeof feedbackFilterSchema>;

// ============================================================================
// List Feedback Schemas
// ============================================================================

/** Fields available for ordering feedback results */
export const feedbackOrderByFieldSchema = z.enum(['timestamp']).describe("Field to order by: 'timestamp'");

/** Order by configuration for feedback queries */
export const feedbackOrderBySchema = z
  .object({
    field: feedbackOrderByFieldSchema.default('timestamp').describe('Field to order by'),
    direction: sortDirectionSchema.default('DESC').describe('Sort direction'),
  })
  .describe('Order by configuration');

/** Schema for listFeedback operation arguments */
export const listFeedbackArgsSchema = z
  .object({
    filters: z
      .preprocess(normalizeLegacyFeedbackActor, feedbackFilterObjectSchema)
      .optional()
      .describe('Optional filters to apply'),
    pagination: paginationArgsSchema.default({ page: 0, perPage: 10 }).describe('Pagination settings'),
    orderBy: feedbackOrderBySchema
      .default({ field: 'timestamp', direction: 'DESC' })
      .describe('Ordering configuration (defaults to timestamp desc)'),
  })
  .describe('Arguments for listing feedback');

/** Arguments for listing feedback */
export type ListFeedbackArgs = z.input<typeof listFeedbackArgsSchema>;

/** Schema for listFeedback operation response */
export const listFeedbackResponseSchema = z.object({
  pagination: paginationInfoSchema,
  feedback: z.array(feedbackRecordSchema),
});

/** Response containing paginated feedback */
export type ListFeedbackResponse = z.infer<typeof listFeedbackResponseSchema>;

// ============================================================================
// OLAP Query Schemas
// ============================================================================

export const getFeedbackAggregateArgsSchema = z
  .object({
    feedbackType: feedbackTypeField,
    feedbackSource: feedbackSourceField.optional(),
    aggregation: aggregationTypeSchema,
    filters: feedbackFilterSchema.optional(),
    comparePeriod: comparePeriodSchema.optional(),
  })
  .describe('Arguments for getting a feedback aggregate over numeric values');

export type GetFeedbackAggregateArgs = z.infer<typeof getFeedbackAggregateArgsSchema>;

export const getFeedbackAggregateResponseSchema = z.object(aggregateResponseFields);

export type GetFeedbackAggregateResponse = z.infer<typeof getFeedbackAggregateResponseSchema>;

export const getFeedbackBreakdownArgsSchema = z
  .object({
    feedbackType: feedbackTypeField,
    feedbackSource: feedbackSourceField.optional(),
    groupBy: groupBySchema,
    aggregation: aggregationTypeSchema,
    filters: feedbackFilterSchema.optional(),
  })
  .describe('Arguments for getting a feedback breakdown over numeric values');

export type GetFeedbackBreakdownArgs = z.infer<typeof getFeedbackBreakdownArgsSchema>;

export const getFeedbackBreakdownResponseSchema = z.object({
  groups: z.array(
    z.object({
      dimensions: dimensionsField,
      value: aggregatedValueField,
    }),
  ),
});

export type GetFeedbackBreakdownResponse = z.infer<typeof getFeedbackBreakdownResponseSchema>;

export const getFeedbackTimeSeriesArgsSchema = z
  .object({
    feedbackType: feedbackTypeField,
    feedbackSource: feedbackSourceField.optional(),
    interval: aggregationIntervalSchema,
    aggregation: aggregationTypeSchema,
    filters: feedbackFilterSchema.optional(),
    groupBy: groupBySchema.optional(),
  })
  .describe('Arguments for getting feedback time series over numeric values');

export type GetFeedbackTimeSeriesArgs = z.infer<typeof getFeedbackTimeSeriesArgsSchema>;

export const getFeedbackTimeSeriesResponseSchema = z.object({
  series: z.array(
    z.object({
      name: z.string().describe('Series name (feedback type or group key)'),
      points: z.array(
        z.object({
          timestamp: bucketTimestampField,
          value: aggregatedValueField,
        }),
      ),
    }),
  ),
});

export type GetFeedbackTimeSeriesResponse = z.infer<typeof getFeedbackTimeSeriesResponseSchema>;

export const getFeedbackPercentilesArgsSchema = z
  .object({
    feedbackType: feedbackTypeField,
    feedbackSource: feedbackSourceField.optional(),
    percentiles: percentilesSchema,
    interval: aggregationIntervalSchema,
    filters: feedbackFilterSchema.optional(),
  })
  .describe('Arguments for getting feedback percentiles over numeric values');

export type GetFeedbackPercentilesArgs = z.infer<typeof getFeedbackPercentilesArgsSchema>;

export const getFeedbackPercentilesResponseSchema = z.object({
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

export type GetFeedbackPercentilesResponse = z.infer<typeof getFeedbackPercentilesResponseSchema>;
