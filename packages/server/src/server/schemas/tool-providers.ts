import z from 'zod';

// ============================================================================
// Path Parameter Schemas
// ============================================================================

export const toolProviderIdPathParams = z.object({
  providerId: z.string().describe('Unique identifier for the tool provider'),
});

export const toolSlugPathParams = toolProviderIdPathParams.extend({
  toolSlug: z.string().describe('Slug identifier for the tool'),
});

// ============================================================================
// Query Parameter Schemas
// ============================================================================

export const listToolProviderToolsQuerySchema = z.object({
  toolkit: z.string().optional().describe('Filter tools by toolkit slug'),
  search: z.string().optional().describe('Search tools by name or description'),
  page: z.coerce.number().optional().describe('Page number for pagination'),
  perPage: z.coerce.number().optional().describe('Number of items per page'),
});

// ============================================================================
// Response Schemas
// ============================================================================

const paginationSchema = z
  .object({
    total: z.number().optional(),
    page: z.number().optional(),
    perPage: z.number().optional(),
    hasMore: z.boolean(),
  })
  .optional();

export const listToolProvidersResponseSchema = z.object({
  providers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
    }),
  ),
});

export const listToolProviderToolkitsResponseSchema = z.object({
  data: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      description: z.string().optional(),
      icon: z.string().optional(),
    }),
  ),
  pagination: paginationSchema,
});

export const listToolProviderToolsResponseSchema = z.object({
  data: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      description: z.string().optional(),
      toolkit: z.string().optional(),
    }),
  ),
  pagination: paginationSchema,
});

export const getToolProviderToolSchemaResponseSchema = z.record(z.string(), z.unknown());
