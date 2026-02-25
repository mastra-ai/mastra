import z from 'zod';

import { paginationInfoSchema, createPagePaginationSchema, statusQuerySchema } from './common';

// ============================================================================
// Path Parameter Schemas
// ============================================================================

export const storedMCPServerIdPathParams = z.object({
  storedMCPServerId: z.string().describe('Unique identifier for the stored MCP server'),
});

// ============================================================================
// Query Parameter Schemas
// ============================================================================

const storageOrderBySchema = z.object({
  field: z.enum(['createdAt', 'updatedAt']).optional(),
  direction: z.enum(['ASC', 'DESC']).optional(),
});

export { statusQuerySchema };

export const listStoredMCPServersQuerySchema = createPagePaginationSchema(100).extend({
  orderBy: storageOrderBySchema.optional(),
  status: z
    .enum(['draft', 'published', 'archived'])
    .optional()
    .default('published')
    .describe('Filter MCP servers by status (defaults to published)'),
  authorId: z.string().optional().describe('Filter MCP servers by author identifier'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Filter MCP servers by metadata key-value pairs'),
});

// ============================================================================
// Body Parameter Schemas
// ============================================================================

const snapshotConfigSchema = z.object({
  name: z.string().describe('Name of the MCP server'),
  version: z.string().describe('Version of the MCP server'),
  tools: z
    .record(z.string(), z.object({ description: z.string().optional() }))
    .optional()
    .describe('Map of tool IDs to optional config overrides'),
});

export const createStoredMCPServerBodySchema = z
  .object({
    id: z.string().optional().describe('Unique identifier. If not provided, derived from name.'),
    authorId: z.string().optional().describe('Author identifier for multi-tenant filtering'),
    metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata for the MCP server'),
  })
  .merge(snapshotConfigSchema);

export const updateStoredMCPServerBodySchema = z
  .object({
    authorId: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .partial()
  .merge(snapshotConfigSchema.partial());

// ============================================================================
// Response Schemas
// ============================================================================

export const storedMCPServerSchema = z.object({
  id: z.string(),
  status: z.string().describe('MCP server status: draft, published, or archived'),
  activeVersionId: z.string().optional(),
  authorId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  name: z.string().describe('Name of the MCP server'),
  version: z.string().describe('Version of the MCP server'),
  tools: z
    .record(z.string(), z.object({ description: z.string().optional() }))
    .optional()
    .describe('Map of tool IDs to optional config overrides'),
});

export const listStoredMCPServersResponseSchema = paginationInfoSchema.extend({
  mcpServers: z.array(storedMCPServerSchema),
});

export const getStoredMCPServerResponseSchema = storedMCPServerSchema;
export const createStoredMCPServerResponseSchema = storedMCPServerSchema;

export const updateStoredMCPServerResponseSchema = z.union([
  z.object({
    id: z.string(),
    status: z.string(),
    activeVersionId: z.string().optional(),
    authorId: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  }),
  storedMCPServerSchema,
]);

export const deleteStoredMCPServerResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
