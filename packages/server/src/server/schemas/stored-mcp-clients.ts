import z from 'zod';

import { paginationInfoSchema, createPagePaginationSchema, statusQuerySchema } from './common';

// ============================================================================
// Path Parameter Schemas
// ============================================================================

export const storedMCPClientIdPathParams = z.object({
  storedMCPClientId: z.string().describe('Unique identifier for the stored MCP client'),
});

// ============================================================================
// Query Parameter Schemas
// ============================================================================

const storageOrderBySchema = z.object({
  field: z.enum(['createdAt', 'updatedAt']).optional(),
  direction: z.enum(['ASC', 'DESC']).optional(),
});

export { statusQuerySchema };

export const listStoredMCPClientsQuerySchema = createPagePaginationSchema(100).extend({
  orderBy: storageOrderBySchema.optional(),
  status: z
    .enum(['draft', 'published', 'archived'])
    .optional()
    .default('published')
    .describe('Filter MCP clients by status (defaults to published)'),
  authorId: z.string().optional().describe('Filter MCP clients by author identifier'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Filter MCP clients by metadata key-value pairs'),
});

// ============================================================================
// Body Parameter Schemas
// ============================================================================

const mcpServerConfigSchema = z.object({
  type: z.enum(['stdio', 'http']).describe('Transport type: stdio for local processes, http for remote servers'),
  command: z.string().optional().describe('Command to run (stdio only)'),
  args: z.array(z.string()).optional().describe('Command arguments (stdio only)'),
  env: z.record(z.string(), z.string()).optional().describe('Environment variables (stdio only)'),
  url: z.string().optional().describe('Server URL (http only)'),
  timeout: z.number().optional().describe('Connection timeout in milliseconds'),
});

const snapshotConfigSchema = z.object({
  name: z.string().describe('Name of the MCP client'),
  description: z.string().optional().describe('Description of the MCP client'),
  servers: z.record(z.string(), mcpServerConfigSchema).describe('Map of server name to server configuration'),
});

export const createStoredMCPClientBodySchema = z
  .object({
    id: z.string().optional().describe('Unique identifier. If not provided, derived from name.'),
    authorId: z.string().optional().describe('Author identifier for multi-tenant filtering'),
    metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata for the MCP client'),
  })
  .merge(snapshotConfigSchema);

export const updateStoredMCPClientBodySchema = z
  .object({
    authorId: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .partial()
  .merge(snapshotConfigSchema.partial());

// ============================================================================
// Response Schemas
// ============================================================================

export const storedMCPClientSchema = z.object({
  id: z.string(),
  status: z.string().describe('MCP client status: draft, published, or archived'),
  activeVersionId: z.string().optional(),
  authorId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  name: z.string().describe('Name of the MCP client'),
  description: z.string().optional().describe('Description of the MCP client'),
  servers: z.record(z.string(), mcpServerConfigSchema).describe('Map of server name to server configuration'),
});

export const listStoredMCPClientsResponseSchema = paginationInfoSchema.extend({
  mcpClients: z.array(storedMCPClientSchema),
});

export const getStoredMCPClientResponseSchema = storedMCPClientSchema;
export const createStoredMCPClientResponseSchema = storedMCPClientSchema;

export const updateStoredMCPClientResponseSchema = z.union([
  z.object({
    id: z.string(),
    status: z.string(),
    activeVersionId: z.string().optional(),
    authorId: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  }),
  storedMCPClientSchema,
]);

export const deleteStoredMCPClientResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
