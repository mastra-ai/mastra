import z from 'zod';
import { paginationInfoSchema, createPagePaginationSchema } from './common';

// ============================================================================
// Path Parameter Schemas
// ============================================================================

export const mcpClientVersionPathParams = z.object({
  mcpClientId: z.string().describe('Unique identifier for the stored MCP client'),
});

export const mcpClientVersionIdPathParams = z.object({
  mcpClientId: z.string().describe('Unique identifier for the stored MCP client'),
  versionId: z.string().describe('Unique identifier for the version (UUID)'),
});

// ============================================================================
// Query Parameter Schemas
// ============================================================================

const versionOrderBySchema = z.object({
  field: z.enum(['versionNumber', 'createdAt']).optional(),
  direction: z.enum(['ASC', 'DESC']).optional(),
});

export const listMCPClientVersionsQuerySchema = createPagePaginationSchema(20).extend({
  orderBy: versionOrderBySchema.optional(),
});

export const compareMCPClientVersionsQuerySchema = z.object({
  from: z.string().describe('Version ID (UUID) to compare from'),
  to: z.string().describe('Version ID (UUID) to compare to'),
});

// ============================================================================
// Body Parameter Schemas
// ============================================================================

export const createMCPClientVersionBodySchema = z.object({
  changeMessage: z.string().max(500).optional().describe('Optional message describing the changes'),
});

// ============================================================================
// Response Schemas
// ============================================================================

const mcpServerConfigSchema = z.object({
  type: z.enum(['stdio', 'http']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  url: z.string().optional(),
  timeout: z.number().optional(),
});

export const mcpClientVersionSchema = z.object({
  id: z.string().describe('Unique identifier for the version (UUID)'),
  mcpClientId: z.string().describe('ID of the MCP client this version belongs to'),
  versionNumber: z.number().describe('Sequential version number (1, 2, 3, ...)'),
  // Snapshot config fields
  name: z.string().describe('Name of the MCP client'),
  description: z.string().optional().describe('Description of the MCP client'),
  servers: z.record(z.string(), mcpServerConfigSchema),
  // Version metadata
  changedFields: z.array(z.string()).optional().describe('Array of field names that changed from the previous version'),
  changeMessage: z.string().optional().describe('Optional message describing the changes'),
  createdAt: z.coerce.date().describe('When this version was created'),
});

export const listMCPClientVersionsResponseSchema = paginationInfoSchema.extend({
  versions: z.array(mcpClientVersionSchema),
});

export const getMCPClientVersionResponseSchema = mcpClientVersionSchema;

export const createMCPClientVersionResponseSchema = mcpClientVersionSchema.partial().merge(
  z.object({
    id: z.string(),
    mcpClientId: z.string(),
    versionNumber: z.number(),
    createdAt: z.coerce.date(),
  }),
);

export const activateMCPClientVersionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  activeVersionId: z.string(),
});

export const restoreMCPClientVersionResponseSchema = mcpClientVersionSchema;

export const deleteMCPClientVersionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const versionDiffEntrySchema = z.object({
  field: z.string().describe('The field path that changed'),
  previousValue: z.unknown().describe('The value in the "from" version'),
  currentValue: z.unknown().describe('The value in the "to" version'),
});

export const compareMCPClientVersionsResponseSchema = z.object({
  diffs: z.array(versionDiffEntrySchema),
  fromVersion: mcpClientVersionSchema,
  toVersion: mcpClientVersionSchema,
});
