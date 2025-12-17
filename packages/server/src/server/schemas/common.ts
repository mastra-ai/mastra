import z from 'zod';

// Path parameter schemas
export const runIdSchema = z.object({
  runId: z.string().describe('Unique identifier for the run'),
});

/**
 * Query parameter schema for runId (optional)
 * Used by create-run route where runId is optional
 */
export const optionalRunIdSchema = z.object({
  runId: z.string().optional(),
});

// ============================================================================
// Pagination Schemas
// ============================================================================

/**
 * Pagination response info
 * Used across all paginated endpoints
 */
export const paginationInfoSchema = z.object({
  total: z.number(),
  page: z.number(),
  perPage: z.union([z.number(), z.literal(false)]),
  hasMore: z.boolean(),
});

/**
 * Factory function for page/perPage pagination query params
 * @param defaultPerPage - Default value for perPage (omit for no default)
 */
export const createPagePaginationSchema = (defaultPerPage?: number) => {
  const baseSchema = {
    page: z.coerce.number().optional().default(0),
  };

  if (defaultPerPage !== undefined) {
    return z.object({
      ...baseSchema,
      perPage: z.coerce.number().optional().default(defaultPerPage),
    });
  } else {
    return z.object({
      ...baseSchema,
      perPage: z.coerce.number().optional(),
    });
  }
};

/**
 * Factory function for pagination that supports both page/perPage and limit/offset
 * Use this when you need backwards compatibility with older clients using limit/offset
 */
export const createCombinedPaginationSchema = () => {
  return z.object({
    page: z.coerce.number().optional(),
    perPage: z.coerce.number().optional(),
    /**
     * @deprecated Use page and perPage instead
     */
    offset: z.coerce.number().optional(),
    /**
     * @deprecated Use page and perPage instead
     */
    limit: z.coerce.number().optional(),
  });
};

// ============================================================================
// Observability Schemas
// ============================================================================

/**
 * Tracing options for observability
 * Used by agents and workflows
 */
export const tracingOptionsSchema = z.object({
  metadata: z.record(z.string(), z.unknown()).optional(),
  requestContextKeys: z.array(z.string()).optional(),
  traceId: z.string().optional(),
  parentSpanId: z.string().optional(),
});

// ============================================================================
// Message Schemas
// ============================================================================

/**
 * Core message schema from AI SDK
 * Represents messages exchanged with AI models
 * Content can be string, array of content parts, or object (for complex message types)
 */
export const coreMessageSchema = z.any();
// .object({
//   role: z.enum(['system', 'user', 'assistant', 'tool']),
//   content: z.union([
//     z.string(),
//     z.array(
//       z
//         .object({
//           type: z.enum(['text', 'image', 'file', 'tool-call', 'tool-result']),
//         })
//         .passthrough(), // Preserve additional fields like text, image, toolCall, etc.
//     ),
//     z.any(), // For complex message content objects
//   ]),
// })
// .passthrough();

// ============================================================================
// Common Response Schemas
// ============================================================================

/**
 * Standard success response schema
 * Used by operations that return only a success boolean
 */
export const successResponseSchema = z.object({
  success: z.boolean(),
});

/**
 * Standard message response schema
 * Used by operations that return only a message string
 */
export const messageResponseSchema = z.object({
  message: z.string(),
});

/**
 * Partial data query parameter schema
 * Used by list endpoints to return minimal data without schemas
 */
export const partialQuerySchema = z.object({
  partial: z.string().optional(),
});

// ============================================================================
// Logging Schemas
// ============================================================================

/**
 * Base log message schema
 */
export const baseLogMessageSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error', 'silent']),
  msg: z.string(),
  time: z.date(),
  context: z.record(z.string(), z.unknown()).optional(),
  runId: z.string().optional(),
  pid: z.number(),
  hostname: z.string(),
  name: z.string(),
});
