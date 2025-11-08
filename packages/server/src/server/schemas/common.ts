import z from 'zod';

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
  perPage: z.number(),
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
 * Factory function for offset/limit pagination query params
 * @param defaultLimit - Default value for limit (omit for no default)
 */
export const createOffsetPaginationSchema = (defaultLimit?: number) => {
  const baseSchema = {
    offset: z.coerce.number().optional().default(0),
  };

  if (defaultLimit !== undefined) {
    return z.object({
      ...baseSchema,
      limit: z.coerce.number().optional().default(defaultLimit),
    });
  } else {
    return z.object({
      ...baseSchema,
      limit: z.coerce.number().optional(),
    });
  }
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
export const coreMessageSchema = z
  .object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.union([
      z.string(),
      z.array(
        z
          .object({
            type: z.enum(['text', 'image', 'file', 'tool-call', 'tool-result']),
          })
          .passthrough(),
      ),
      z.object({}).passthrough(), // For complex message content objects
    ]),
  })
  .passthrough();

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

// ============================================================================
// Logging Schemas
// ============================================================================

/**
 * Base log message schema
 */
export const baseLogMessageSchema = z
  .object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
    message: z.string(),
    timestamp: z.date(),
    context: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();
