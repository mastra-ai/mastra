import { z } from 'zod/v4';
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
  resumeData: z
    .unknown()
    .optional()
    .describe('Answer for a tool that reported `status: "suspended"`; 2026-07-28 servers only'),
  suspendPayload: z
    .unknown()
    .optional()
    .describe('The `suspendPayload` from the suspended response, echoed back with `resumeData`'),
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

export const mcpServerTransportSchema = z.enum(['streamable-http', 'sse']);

/** Protocol transports the Studio/REST API exposes for a registered MCP server. */
export type MCPServerTransport = z.infer<typeof mcpServerTransportSchema>;

export const serverInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  version_detail: versionDetailSchema,
  /** Omitted by servers that predate transport reporting; treat absence as `['streamable-http', 'sse']`. */
  transports: z.array(mcpServerTransportSchema).optional(),
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
  package_canonical: z.string().optional(),
  packages: z.array(z.unknown()).optional(),
  remotes: z.array(z.unknown()).optional(),
  /** Omitted by servers that predate transport reporting; treat absence as `['streamable-http', 'sse']`. */
  transports: z.array(mcpServerTransportSchema).optional(),
});

// Tool schemas
export const mcpToolInfoSchema = z.object({
  /** Tool id as registered on the server; present when the MCP server reports it. */
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.unknown(),
  outputSchema: z.unknown().optional(),
  toolType: z.string().optional(),
  _meta: z.record(z.string(), z.unknown()).optional(),
});

export const listMcpServerToolsResponseSchema = z.object({
  tools: z.array(mcpToolInfoSchema),
});

export const executeToolResponseSchema = z.union([
  z.object({
    result: z.unknown(),
  }),
  z.object({
    status: z.literal('suspended').describe('The tool paused and asked for input; it did not complete'),
    suspendPayload: z.unknown().describe('What the tool suspended with'),
    resumeSchema: z.unknown().optional().describe('JSON Schema of the input the tool needs to resume'),
  }),
]);

// Resource schemas
export const mcpServerResourcePathParams = z.object({
  serverId: z.string().describe('MCP server ID'),
});

export const readResourceBodySchema = z.object({
  uri: z.string().describe('Resource URI to read'),
});

export const resourceContentSchema = z.object({
  uri: z.string(),
  text: z.string().optional(),
  blob: z.string().optional(),
});

export const readResourceResponseSchema = z.object({
  contents: z.array(resourceContentSchema),
});

export const resourceInfoSchema = z.object({
  uri: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
  _meta: z.record(z.string(), z.unknown()).optional(),
});

export const listResourcesResponseSchema = z.object({
  resources: z.array(resourceInfoSchema),
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
