import type { Mastra } from '@mastra/core';
import type { MCPServerBase as MastraMCPServerImplementation, ServerInfo } from '@mastra/core/mcp';
import { HTTPException } from '../http-exception';
import {
  mcpServerDetailPathParams,
  mcpServerToolPathParams,
  executeToolBodySchema,
  listMcpServersQuerySchema,
  getMcpServerDetailQuerySchema,
  listMcpServersResponseSchema,
  serverDetailSchema,
  mcpServerIdPathParams,
  listMcpServerToolsResponseSchema,
  mcpToolInfoSchema,
  executeToolResponseSchema,
} from '../schemas/mcp';
import type { ServerContext } from '../server-adapter';
import { createRoute } from '../server-adapter/routes/route-builder';

// ============================================================================
// Helpers
// ============================================================================

async function resolveServerWithSource(
  mastra: Mastra,
  serverId: string,
): Promise<{
  server: MastraMCPServerImplementation;
  storedServer: MastraMCPServerImplementation | undefined;
}> {
  const inMemory = mastra.getMCPServerById(serverId);
  let stored: MastraMCPServerImplementation | undefined;
  try {
    stored = (await mastra.getEditor()?.mcpServer.getById(serverId)) ?? undefined;
  } catch {
    /* editor not configured */
  }
  const server = inMemory ?? stored;
  if (!server) {
    throw new HTTPException(404, { message: `MCP server with ID '${serverId}' not found` });
  }
  return { server, storedServer: stored };
}

// ============================================================================
// Route Definitions (createRoute pattern for server adapters)
// ============================================================================

export const LIST_MCP_SERVERS_ROUTE = createRoute({
  method: 'GET',
  path: '/mcp/v0/servers',
  responseType: 'json',
  queryParamSchema: listMcpServersQuerySchema,
  responseSchema: listMcpServersResponseSchema,
  summary: 'List MCP servers',
  description: 'Returns a list of registered MCP servers with pagination support',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({
    mastra,
    routePrefix,
    page,
    perPage,
    limit,
    offset,
  }: ServerContext & { page?: number; perPage?: number; limit?: number; offset?: number }) => {
    if (!mastra || typeof mastra.listMCPServers !== 'function') {
      throw new HTTPException(500, { message: 'Mastra instance or listMCPServers method not available' });
    }

    const servers = mastra.listMCPServers();

    if (!servers) {
      return { servers: [], total_count: 0, next: null };
    }

    const serverList = Object.values(servers) as MastraMCPServerImplementation[];
    const totalCount = serverList.length;

    // Support both page/perPage and limit/offset for backwards compatibility
    // Detect which format user is using - prefer page/perPage if both provided
    const useLegacyFormat =
      (limit !== undefined || offset !== undefined) && page === undefined && perPage === undefined;

    // If perPage provided, use it; otherwise fall back to limit
    const finalPerPage = perPage ?? limit;
    // If page provided, use it; otherwise convert from offset
    let finalPage = page;
    if (finalPage === undefined && offset !== undefined && finalPerPage !== undefined && finalPerPage > 0) {
      finalPage = Math.floor(offset / finalPerPage);
    }

    // Calculate offset from page/perPage
    const actualOffset = finalPage !== undefined && finalPerPage !== undefined ? finalPage * finalPerPage : 0;

    // Apply pagination
    let paginatedServers = serverList;
    let nextUrl: string | null = null;

    if (finalPerPage !== undefined) {
      paginatedServers = serverList.slice(actualOffset, actualOffset + finalPerPage);

      // Calculate next URL if there are more results
      if (actualOffset + finalPerPage < totalCount) {
        const nextPage = (finalPage ?? 0) + 1;
        // Return next URL in same format as request (legacy limit/offset or page/perPage)
        const prefix = routePrefix ?? '';
        if (useLegacyFormat) {
          const nextOffset = actualOffset + finalPerPage;
          nextUrl = `${prefix}/mcp/v0/servers?limit=${finalPerPage}&offset=${nextOffset}`;
        } else {
          nextUrl = `${prefix}/mcp/v0/servers?perPage=${finalPerPage}&page=${nextPage}`;
        }
      }
    }

    // Collect stored server IDs so we can tag source correctly.
    // Stored servers may or may not be hydrated into the Mastra instance yet
    // (hydration is lazy, triggered by getById). We need the stored IDs to:
    // 1. Correctly tag already-hydrated servers that appear in listMCPServers()
    // 2. Add non-hydrated stored servers that aren't in listMCPServers() yet
    // We use status: 'draft' to always show the latest version (not active) for stored servers.
    let storedServerIds = new Set<string>();
    let storedServersMap = new Map<string, { id: string; name: string; version?: string; createdAt?: string | Date }>();
    try {
      const editor = mastra.getEditor();
      const storedResult = await editor?.mcpServer.listResolved({ status: 'draft' });
      if (storedResult?.mcpServers) {
        for (const s of storedResult.mcpServers) {
          storedServerIds.add(s.id);
          storedServersMap.set(s.id, s);
        }
      }
    } catch {
      // Silently ignore if editor/storage is not configured
    }

    // Get server info, tagging already-hydrated stored servers correctly
    const serverInfoList: ServerInfo[] = paginatedServers.map(server => {
      const info = {
        ...server.getServerInfo(),
        source: storedServerIds.has(server.id) ? ('stored' as const) : ('code' as const),
      };
      // For stored servers, override with latest draft data from storage
      // (the in-memory hydrated instance may be stale after edits)
      const storedData = storedServersMap.get(server.id);
      if (storedData) {
        info.name = storedData.name;
        info.version_detail = {
          version: (storedData as any).version ?? '1.0.0',
          release_date: storedData.createdAt ? new Date(storedData.createdAt).toISOString() : new Date().toISOString(),
          is_latest: true,
        };
      }
      return info;
    });

    // Add stored servers that haven't been hydrated yet (not in listMCPServers)
    const existingIds = new Set(serverInfoList.map(s => s.id));
    let storedServersAddedCount = 0;
    for (const [id, stored] of storedServersMap) {
      if (!existingIds.has(id)) {
        storedServersAddedCount++;
        serverInfoList.push({
          id: stored.id,
          name: stored.name,
          version_detail: {
            version: (stored as any).version ?? '1.0.0',
            release_date: stored.createdAt ? new Date(stored.createdAt).toISOString() : new Date().toISOString(),
            is_latest: true,
          },
          source: 'stored',
        });
      }
    }

    return {
      servers: serverInfoList,
      total_count: totalCount + storedServersAddedCount,
      next: nextUrl,
    };
  },
});

export const GET_MCP_SERVER_DETAIL_ROUTE = createRoute({
  method: 'GET',
  path: '/mcp/v0/servers/:id',
  responseType: 'json',
  pathParamSchema: mcpServerDetailPathParams,
  queryParamSchema: getMcpServerDetailQuerySchema,
  responseSchema: serverDetailSchema,
  summary: 'Get MCP server details',
  description: 'Returns detailed information about a specific MCP server',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({ mastra, id, version }: ServerContext & { id: string; version?: string }) => {
    if (!mastra || typeof mastra.getMCPServerById !== 'function') {
      throw new HTTPException(500, { message: 'Mastra instance or getMCPServerById method not available' });
    }

    const { server, storedServer } = await resolveServerWithSource(mastra, id);
    const serverSource: 'code' | 'stored' = storedServer ? 'stored' : 'code';

    // For stored servers, prefer the fresh instance from storage over the
    // potentially stale in-memory Mastra instance
    const serverDetail = (storedServer ?? server).getServerDetail();

    // If a specific version was requested, check if it matches
    if (version && serverDetail.version_detail.version !== version) {
      throw new HTTPException(404, {
        message: `MCP server with ID '${id}' found, but not version '${version}'. Available version: ${serverDetail.version_detail.version}`,
      });
    }

    return { ...serverDetail, source: serverSource };
  },
});

export const LIST_MCP_SERVER_TOOLS_ROUTE = createRoute({
  method: 'GET',
  path: '/mcp/:serverId/tools',
  responseType: 'json',
  pathParamSchema: mcpServerIdPathParams,
  responseSchema: listMcpServerToolsResponseSchema,
  summary: 'List MCP server tools',
  description: 'Returns a list of tools available on the specified MCP server',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({ mastra, serverId }: ServerContext & { serverId: string }) => {
    if (!mastra || typeof mastra.getMCPServerById !== 'function') {
      throw new HTTPException(500, { message: 'Mastra instance or getMCPServerById method not available' });
    }

    const { server, storedServer } = await resolveServerWithSource(mastra, serverId);

    if (typeof server.getToolListInfo !== 'function') {
      throw new HTTPException(501, { message: `Server '${serverId}' cannot list tools in this way.` });
    }

    return (storedServer ?? server).getToolListInfo();
  },
});

export const GET_MCP_SERVER_TOOL_DETAIL_ROUTE = createRoute({
  method: 'GET',
  path: '/mcp/:serverId/tools/:toolId',
  responseType: 'json',
  pathParamSchema: mcpServerToolPathParams,
  responseSchema: mcpToolInfoSchema,
  summary: 'Get MCP server tool details',
  description: 'Returns detailed information about a specific tool on the MCP server',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({ mastra, serverId, toolId }: ServerContext & { serverId: string; toolId: string }) => {
    if (!mastra || typeof mastra.getMCPServerById !== 'function') {
      throw new HTTPException(500, { message: 'Mastra instance or getMCPServerById method not available' });
    }

    const { server, storedServer } = await resolveServerWithSource(mastra, serverId);

    if (typeof server.getToolInfo !== 'function') {
      throw new HTTPException(501, { message: `Server '${serverId}' cannot provide tool details in this way.` });
    }

    const effectiveServer = storedServer ?? server;
    const toolInfo = effectiveServer.getToolInfo(toolId);
    if (!toolInfo) {
      throw new HTTPException(404, { message: `Tool with ID '${toolId}' not found on MCP server '${serverId}'` });
    }

    return toolInfo;
  },
});

export const EXECUTE_MCP_SERVER_TOOL_ROUTE = createRoute({
  method: 'POST',
  path: '/mcp/:serverId/tools/:toolId/execute',
  responseType: 'json',
  pathParamSchema: mcpServerToolPathParams,
  bodySchema: executeToolBodySchema,
  responseSchema: executeToolResponseSchema,
  summary: 'Execute MCP server tool',
  description: 'Executes a tool on the specified MCP server with the provided arguments',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({
    mastra,
    serverId,
    toolId,
    data,
  }: ServerContext & { serverId: string; toolId: string; data?: unknown }) => {
    if (!mastra || typeof mastra.getMCPServerById !== 'function') {
      throw new HTTPException(500, { message: 'Mastra instance or getMCPServerById method not available' });
    }

    const { server } = await resolveServerWithSource(mastra, serverId);

    if (typeof server.executeTool !== 'function') {
      throw new HTTPException(501, { message: `Server '${serverId}' cannot execute tools in this way.` });
    }

    const result = await server.executeTool(toolId, data);
    return { result };
  },
});

// ============================================================================
// MCP Transport Routes (Streamable HTTP and SSE)
// ============================================================================

/**
 * MCP transport options that can be passed to startHTTP() or startSSE().
 * Includes serverless mode for running in stateless environments like Cloudflare Workers or Vercel Edge.
 */
export interface MCPTransportOptions {
  /**
   * When true, runs in stateless mode without session management.
   * Ideal for serverless environments where you can't maintain persistent connections.
   */
  serverless?: boolean;
  /**
   * Custom session ID generator function.
   */
  sessionIdGenerator?: () => string;
}

/**
 * MCP HTTP Transport response type.
 * Adapters use this to set up the HTTP transport via MCPServer.startHTTP()
 */
export interface MCPHttpTransportResult {
  server: MastraMCPServerImplementation;
  httpPath: string;
  /**
   * Optional MCP transport options for this specific route.
   * These override any class-level mcpOptions configured on the adapter.
   */
  mcpOptions?: MCPTransportOptions;
}

/**
 * MCP SSE Transport response type.
 * Adapters use this to set up the SSE transport via MCPServer.startSSE() or startHonoSSE()
 *
 * Note: SSE transport is inherently stateful and doesn't support serverless mode.
 */
export interface MCPSseTransportResult {
  server: MastraMCPServerImplementation;
  ssePath: string;
  messagePath: string;
}

export const MCP_HTTP_TRANSPORT_ROUTE = createRoute({
  method: 'ALL',
  path: '/mcp/:serverId/mcp',
  responseType: 'mcp-http',
  pathParamSchema: mcpServerIdPathParams,
  summary: 'MCP HTTP Transport',
  description: 'Streamable HTTP transport endpoint for MCP protocol communication',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({ mastra, serverId }: ServerContext & { serverId: string }): Promise<MCPHttpTransportResult> => {
    if (!mastra || typeof mastra.getMCPServerById !== 'function') {
      throw new HTTPException(500, { message: 'Mastra instance or getMCPServerById method not available' });
    }

    const { server } = await resolveServerWithSource(mastra, serverId);

    return {
      server,
      httpPath: `/mcp/${serverId}/mcp`,
    };
  },
});

export const MCP_SSE_TRANSPORT_ROUTE = createRoute({
  method: 'ALL',
  path: '/mcp/:serverId/sse',
  responseType: 'mcp-sse',
  pathParamSchema: mcpServerIdPathParams,
  summary: 'MCP SSE Transport',
  description: 'SSE transport endpoint for MCP protocol communication',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({ mastra, serverId }: ServerContext & { serverId: string }): Promise<MCPSseTransportResult> => {
    if (!mastra || typeof mastra.getMCPServerById !== 'function') {
      throw new HTTPException(500, { message: 'Mastra instance or getMCPServerById method not available' });
    }

    const { server } = await resolveServerWithSource(mastra, serverId);

    return {
      server,
      ssePath: `/mcp/${serverId}/sse`,
      messagePath: `/mcp/${serverId}/messages`,
    };
  },
});

export const MCP_SSE_MESSAGES_ROUTE = createRoute({
  method: 'POST',
  path: '/mcp/:serverId/messages',
  responseType: 'mcp-sse',
  pathParamSchema: mcpServerIdPathParams,
  summary: 'MCP SSE Messages',
  description: 'Message endpoint for SSE transport (posts messages to active SSE streams)',
  tags: ['MCP'],
  requiresAuth: true,
  handler: MCP_SSE_TRANSPORT_ROUTE.handler,
});
