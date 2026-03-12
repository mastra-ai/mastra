import z from 'zod';
import {
  listVersionsQuerySchema,
  compareVersionsQuerySchema,
  createVersionBodySchema,
  activateVersionResponseSchema,
  deleteVersionResponseSchema,
  versionDiffEntrySchema,
  createListVersionsResponseSchema,
  createCompareVersionsResponseSchema,
} from './version-common';

// Re-export shared schemas under domain-specific names
export const listMCPClientVersionsQuerySchema = listVersionsQuerySchema;
export const compareMCPClientVersionsQuerySchema = compareVersionsQuerySchema;
export const createMCPClientVersionBodySchema = createVersionBodySchema;

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

export const listMCPClientVersionsResponseSchema = createListVersionsResponseSchema(mcpClientVersionSchema);

export const getMCPClientVersionResponseSchema = mcpClientVersionSchema;

export const createMCPClientVersionResponseSchema = mcpClientVersionSchema.partial().merge(
  z.object({
    id: z.string(),
    mcpClientId: z.string(),
    versionNumber: z.number(),
    createdAt: z.coerce.date(),
  }),
);

export const activateMCPClientVersionResponseSchema = activateVersionResponseSchema;

export const restoreMCPClientVersionResponseSchema = mcpClientVersionSchema;

export const deleteMCPClientVersionResponseSchema = deleteVersionResponseSchema;

export const compareMCPClientVersionsResponseSchema = createCompareVersionsResponseSchema(mcpClientVersionSchema);

export { versionDiffEntrySchema };
