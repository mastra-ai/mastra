import z from 'zod';
import { paginationInfoSchema, createPagePaginationSchema } from './common';

// ============================================================================
// Path Parameter Schemas
// ============================================================================

/**
 * Path parameter for integration ID
 */
export const integrationIdPathParams = z.object({
  integrationId: z.string().describe('Unique identifier for the integration'),
});

/**
 * Path parameter for provider name
 */
export const providerPathParams = z.object({
  provider: z.string().describe('Integration provider type'),
});

/**
 * Path parameters for cached tool operations
 */
export const cachedToolPathParams = z.object({
  integrationId: z.string().describe('Unique identifier for the integration'),
  toolId: z.string().describe('Unique identifier for the cached tool'),
});

// ============================================================================
// Query Parameter Schemas
// ============================================================================

/**
 * Storage order by configuration for integrations
 */
const integrationOrderBySchema = z.object({
  field: z.enum(['createdAt', 'updatedAt']).optional(),
  direction: z.enum(['ASC', 'DESC']).optional(),
});

/**
 * GET /api/integrations - List integrations
 */
export const listIntegrationsQuerySchema = createPagePaginationSchema(100).extend({
  orderBy: integrationOrderBySchema.optional(),
  ownerId: z.string().optional().describe('Filter integrations by owner identifier'),
  provider: z.enum(['composio', 'arcade', 'mcp']).optional().describe('Filter by provider type'),
  enabled: z.coerce.boolean().optional().describe('Filter by enabled status'),
});

/**
 * GET /api/integrations/:provider/toolkits - List toolkits from provider
 */
export const listToolkitsQuerySchema = z.object({
  search: z.string().optional().describe('Search toolkits by name'),
  category: z.string().optional().describe('Filter by category'),
  limit: z.coerce.number().optional().default(50).describe('Number of results per page'),
  cursor: z.string().optional().describe('Pagination cursor'),
});

/**
 * GET /api/integrations/:provider/tools - List tools from provider
 */
export const listToolsQuerySchema = z.object({
  toolkitSlug: z.string().optional().describe('Filter by single toolkit slug'),
  toolkitSlugs: z.string().optional().describe('Filter by multiple toolkit slugs (comma-separated)'),
  search: z.string().optional().describe('Search tools by name'),
  limit: z.coerce.number().optional().default(50).describe('Number of results per page'),
  cursor: z.string().optional().describe('Pagination cursor'),
  // MCP-specific parameters (HTTP transport)
  url: z.string().optional().describe('MCP server URL (required for MCP HTTP transport)'),
  headers: z.string().optional().describe('MCP server auth headers as JSON string'),
  // MCP-specific parameters (Stdio transport)
  command: z.string().optional().describe('Command to execute (required for MCP Stdio transport)'),
  args: z.string().optional().describe('Arguments as JSON array string'),
  env: z.string().optional().describe('Environment variables as JSON object string'),
});

/**
 * POST /api/integrations/mcp/validate - Validate MCP connection
 *
 * Supports two transport types:
 * - HTTP: Remote MCP servers accessed via URL
 * - Stdio: Local MCP servers spawned as subprocesses
 */
export const validateMCPBodySchema = z
  .object({
    transport: z.enum(['http', 'stdio']).describe('Transport type: http for remote, stdio for local'),
    // HTTP transport fields
    url: z.string().url().optional().describe('MCP server URL (required for HTTP transport)'),
    headers: z.record(z.string(), z.string()).optional().describe('Optional authentication headers for HTTP'),
    // Stdio transport fields
    command: z.string().optional().describe('Command to execute (required for Stdio transport)'),
    args: z.array(z.string()).optional().describe('Arguments to pass to the command'),
    env: z.record(z.string(), z.string()).optional().describe('Environment variables for the subprocess'),
  })
  .refine(data => (data.transport === 'http' ? !!data.url : !!data.command), {
    message: 'URL is required for HTTP transport, command is required for Stdio transport',
  });

/**
 * Response for MCP validation
 */
export const validateMCPResponseSchema = z.object({
  valid: z.boolean(),
  toolCount: z.number(),
  error: z.string().optional(),
});

// ============================================================================
// Body Parameter Schemas
// ============================================================================

/**
 * Base integration schema (shared fields)
 */
const integrationBaseSchema = z.object({
  name: z.string().describe('Display name for the integration'),
  provider: z.enum(['composio', 'arcade', 'mcp']).describe('Integration provider type'),
  enabled: z.boolean().optional().default(true).describe('Whether the integration is active'),
  selectedToolkits: z.array(z.string()).describe('Array of toolkit slugs to expose'),
  selectedTools: z.array(z.string()).optional().describe('Array of specific tool slugs (for granular control)'),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Provider-specific settings (for MCP: { url, headers })'),
  ownerId: z.string().optional().describe('Owner identifier for multi-tenant filtering'),
});

/**
 * POST /api/integrations - Create integration body
 */
export const createIntegrationBodySchema = integrationBaseSchema.extend({
  id: z.string().optional().describe('Optional custom identifier (auto-generated if not provided)'),
});

/**
 * PATCH /api/integrations/:integrationId - Update integration body
 */
export const updateIntegrationBodySchema = integrationBaseSchema.partial();

/**
 * POST /api/integrations/:integrationId/refresh - Refresh integration tools
 */
export const refreshIntegrationBodySchema = z.object({}).optional();

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Integration object schema (full response)
 */
export const integrationSchema = z.object({
  id: z.string(),
  provider: z.enum(['composio', 'arcade', 'mcp']),
  name: z.string(),
  enabled: z.boolean(),
  selectedToolkits: z.array(z.string()),
  selectedTools: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  ownerId: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  toolCount: z.number().optional(), // Actual count of cached tools for this integration
  toolkitNames: z.array(z.string()).optional(), // Names of toolkits in this integration (e.g., ["hackernews"])
});

/**
 * Cached tool schema
 */
export const cachedToolSchema = z.object({
  id: z.string(),
  integrationId: z.string(),
  provider: z.enum(['composio', 'arcade', 'mcp']),
  toolkitSlug: z.string(),
  toolSlug: z.string(),
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.record(z.string(), z.unknown()).optional(),
  outputSchema: z.record(z.string(), z.unknown()).optional(),
  rawDefinition: z.record(z.string(), z.unknown()).optional(),
  cachedAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Provider status schema
 */
export const providerStatusSchema = z.object({
  provider: z.enum(['composio', 'arcade', 'mcp']),
  connected: z.boolean(),
  name: z.string(),
  description: z.string(),
  icon: z.string().optional(),
});

/**
 * Toolkit schema (from provider API)
 */
export const toolkitSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  category: z.string().optional(),
  toolCount: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Tool schema (from provider API)
 */
export const toolSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.record(z.string(), z.unknown()).optional(),
  outputSchema: z.record(z.string(), z.unknown()).optional(),
  toolkit: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Response for GET /api/integrations
 */
export const listIntegrationsResponseSchema = paginationInfoSchema.extend({
  integrations: z.array(integrationSchema),
});

/**
 * Response for GET /api/integrations/:integrationId
 */
export const getIntegrationResponseSchema = integrationSchema;

/**
 * Response for POST /api/integrations
 */
export const createIntegrationResponseSchema = integrationSchema;

/**
 * Response for PATCH /api/integrations/:integrationId
 */
export const updateIntegrationResponseSchema = integrationSchema;

/**
 * Response for DELETE /api/integrations/:integrationId
 */
export const deleteIntegrationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

/**
 * Response for GET /api/integrations/providers
 */
export const listProvidersResponseSchema = z.object({
  providers: z.array(providerStatusSchema),
});

/**
 * Response for GET /api/integrations/:provider/toolkits
 */
export const listToolkitsResponseSchema = z.object({
  toolkits: z.array(toolkitSchema),
  nextCursor: z.string().optional(),
  hasMore: z.boolean(),
});

/**
 * Response for GET /api/integrations/:provider/tools
 */
export const listToolsResponseSchema = z.object({
  tools: z.array(toolSchema),
  nextCursor: z.string().optional(),
  hasMore: z.boolean(),
});

/**
 * Response for POST /api/integrations/:integrationId/refresh
 */
export const refreshIntegrationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  toolsUpdated: z.number(),
});

/**
 * Response for DELETE /api/integrations/:integrationId/tools/:toolId
 */
export const deleteCachedToolResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
