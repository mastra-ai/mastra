import { z } from 'zod';

// Path parameters
export const mcpServerIdPathParams = z.object({
  serverId: z.string().describe('MCP server ID'),
});

export const mcpServerDetailPathParams = z.object({
  id: z.string().describe('MCP server ID'),
});

// Query parameters
export const listMcpServersQuerySchema = z.object({
  limit: z.coerce.number().optional(),
  offset: z.coerce.number().optional(),
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
  package_canonical: z.string(),
  packages: z.array(z.unknown()),
  remotes: z.array(z.unknown()),
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
