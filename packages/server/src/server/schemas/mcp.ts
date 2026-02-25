import { z } from 'zod';
import { createCombinedPaginationSchema } from './common';

// Path parameters
export const mcpServerIdPathParams = z.object({
  serverId: z.string().describe('MCP server ID'),
});

export const mcpServerDetailPathParams = z.object({
  id: z.string().describe('MCP server ID'),
});

export const mcpServerToolPathParams = z.object({
  serverId: z.string().describe('MCP server ID'),
  toolId: z.string().describe('Tool ID'),
});

export const executeToolBodySchema = z.object({
  data: z.unknown().optional(),
});

// Query parameters
// Supports both page/perPage and limit/offset for backwards compatibility
export const listMcpServersQuerySchema = createCombinedPaginationSchema();

export const getMcpServerDetailQuerySchema = z.object({
  version: z.string().optional(),
});

// Response schemas
export const versionDetailSchema = z.object({
  version: z.string(),
  release_date: z.string(),
  is_latest: z.boolean(),
});

export const serverInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  version_detail: versionDetailSchema,
  source: z.enum(['code', 'stored']).optional(),
});

export const listMcpServersResponseSchema = z.object({
  servers: z.array(serverInfoSchema),
  total_count: z.number(),
  next: z.string().nullable(),
});

export const serverDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version_detail: versionDetailSchema,
  source: z.enum(['code', 'stored']).optional(),
  package_canonical: z.string().optional(),
  packages: z.array(z.unknown()).optional(),
  remotes: z.array(z.unknown()).optional(),
});

// Tool schemas
export const mcpToolInfoSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.unknown(),
  outputSchema: z.unknown().optional(),
  toolType: z.string().optional(),
});

export const listMcpServerToolsResponseSchema = z.object({
  tools: z.array(mcpToolInfoSchema),
});

export const executeToolResponseSchema = z.object({
  result: z.unknown(),
});

// JSON-RPC error response schema
export const jsonRpcErrorSchema = z.object({
  jsonrpc: z.literal('2.0'),
  error: z.object({
    code: z.number(),
    message: z.string(),
  }),
  id: z.null(),
});
