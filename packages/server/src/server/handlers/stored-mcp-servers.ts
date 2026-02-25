import type { Mastra } from '@mastra/core';
import { HTTPException } from '../http-exception';
import {
  storedMCPServerIdPathParams,
  statusQuerySchema,
  listStoredMCPServersQuerySchema,
  createStoredMCPServerBodySchema,
  updateStoredMCPServerBodySchema,
  listStoredMCPServersResponseSchema,
  getStoredMCPServerResponseSchema,
  createStoredMCPServerResponseSchema,
  updateStoredMCPServerResponseSchema,
  deleteStoredMCPServerResponseSchema,
} from '../schemas/stored-mcp-servers';
import { createRoute } from '../server-adapter/routes/route-builder';
import { toSlug } from '../utils';

import { handleError } from './error';
import { handleAutoVersioning, MCP_SERVER_SNAPSHOT_CONFIG_FIELDS } from './version-helpers';
import type { VersionedStoreInterface } from './version-helpers';

// ============================================================================
// Helpers
// ============================================================================

async function getMcpServerStore(mastra: Mastra) {
  const storage = mastra.getStorage();
  if (!storage) {
    throw new HTTPException(500, { message: 'Storage is not configured' });
  }
  const mcpServerStore = await storage.getStore('mcpServers');
  if (!mcpServerStore) {
    throw new HTTPException(500, { message: 'MCP servers storage domain is not available' });
  }
  return mcpServerStore;
}

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * GET /stored/mcp-servers - List all stored MCP servers
 */
export const LIST_STORED_MCP_SERVERS_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/mcp-servers',
  responseType: 'json',
  queryParamSchema: listStoredMCPServersQuerySchema,
  responseSchema: listStoredMCPServersResponseSchema,
  summary: 'List stored MCP servers',
  description: 'Returns a paginated list of all MCP server configurations stored in the database',
  tags: ['Stored MCP Servers'],
  requiresAuth: true,
  handler: async ({ mastra, page, perPage, orderBy, status, authorId, metadata }) => {
    try {
      const mcpServerStore = await getMcpServerStore(mastra);

      const result = await mcpServerStore.listResolved({
        page,
        perPage,
        orderBy,
        status,
        authorId,
        metadata,
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error listing stored MCP servers');
    }
  },
});

/**
 * GET /stored/mcp-servers/:storedMCPServerId - Get a stored MCP server by ID
 */
export const GET_STORED_MCP_SERVER_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/mcp-servers/:storedMCPServerId',
  responseType: 'json',
  pathParamSchema: storedMCPServerIdPathParams,
  queryParamSchema: statusQuerySchema,
  responseSchema: getStoredMCPServerResponseSchema,
  summary: 'Get stored MCP server by ID',
  description:
    'Returns a specific MCP server from storage by its unique identifier. Use ?status=draft to resolve with the latest (draft) version, or ?status=published (default) for the active published version.',
  tags: ['Stored MCP Servers'],
  requiresAuth: true,
  handler: async ({ mastra, storedMCPServerId, status }) => {
    try {
      const mcpServerStore = await getMcpServerStore(mastra);

      const mcpServer = await mcpServerStore.getByIdResolved(storedMCPServerId, { status });

      if (!mcpServer) {
        throw new HTTPException(404, { message: `Stored MCP server with id ${storedMCPServerId} not found` });
      }

      return mcpServer;
    } catch (error) {
      return handleError(error, 'Error getting stored MCP server');
    }
  },
});

/**
 * POST /stored/mcp-servers - Create a new stored MCP server
 */
export const CREATE_STORED_MCP_SERVER_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/mcp-servers',
  responseType: 'json',
  bodySchema: createStoredMCPServerBodySchema,
  responseSchema: createStoredMCPServerResponseSchema,
  summary: 'Create stored MCP server',
  description: 'Creates a new MCP server configuration in storage with the provided tools',
  tags: ['Stored MCP Servers'],
  requiresAuth: true,
  handler: async ({ mastra, id: providedId, authorId, metadata, name, version, tools }) => {
    try {
      const mcpServerStore = await getMcpServerStore(mastra);

      // Derive ID from name if not explicitly provided
      const id = providedId || toSlug(name);

      if (!id) {
        throw new HTTPException(400, {
          message: 'Could not derive MCP server ID from name. Please provide an explicit id.',
        });
      }

      // Check if MCP server with this ID already exists
      const existing = await mcpServerStore.getById(id);
      if (existing) {
        throw new HTTPException(409, { message: `MCP server with id ${id} already exists` });
      }

      await mcpServerStore.create({
        mcpServer: {
          id,
          authorId,
          metadata,
          name,
          version,
          tools,
        },
      });

      // Return the resolved MCP server (thin record + version config)
      // Use draft status since newly created entities start as drafts
      const resolved = await mcpServerStore.getByIdResolved(id, { status: 'draft' });
      if (!resolved) {
        throw new HTTPException(500, { message: 'Failed to resolve created MCP server' });
      }

      return resolved;
    } catch (error) {
      return handleError(error, 'Error creating stored MCP server');
    }
  },
});

/**
 * PATCH /stored/mcp-servers/:storedMCPServerId - Update a stored MCP server
 */
export const UPDATE_STORED_MCP_SERVER_ROUTE = createRoute({
  method: 'PATCH',
  path: '/stored/mcp-servers/:storedMCPServerId',
  responseType: 'json',
  pathParamSchema: storedMCPServerIdPathParams,
  bodySchema: updateStoredMCPServerBodySchema,
  responseSchema: updateStoredMCPServerResponseSchema,
  summary: 'Update stored MCP server',
  description: 'Updates an existing MCP server in storage with the provided fields',
  tags: ['Stored MCP Servers'],
  requiresAuth: true,
  handler: async ({
    mastra,
    storedMCPServerId,
    // Metadata-level fields
    authorId,
    metadata,
    // Config fields (snapshot-level)
    name,
    version,
    tools,
  }) => {
    try {
      const mcpServerStore = await getMcpServerStore(mastra);

      // Check if MCP server exists
      const existing = await mcpServerStore.getById(storedMCPServerId);
      if (!existing) {
        throw new HTTPException(404, { message: `Stored MCP server with id ${storedMCPServerId} not found` });
      }

      // Update the MCP server with both metadata-level and config-level fields
      const updatedMCPServer = await mcpServerStore.update({
        id: storedMCPServerId,
        authorId,
        metadata,
        name,
        version,
        tools,
      });

      // Build the snapshot config for auto-versioning comparison
      const configFields = { name, version, tools };

      // Filter out undefined values to get only the config fields that were provided
      const providedConfigFields = Object.fromEntries(Object.entries(configFields).filter(([_, v]) => v !== undefined));

      // Handle auto-versioning with retry logic for race conditions
      // This creates a new version if there are meaningful config changes.
      // It does NOT update activeVersionId — the version stays as a draft until explicitly published.
      await handleAutoVersioning(
        mcpServerStore as unknown as VersionedStoreInterface,
        storedMCPServerId,
        'mcpServerId',
        MCP_SERVER_SNAPSHOT_CONFIG_FIELDS,
        existing,
        updatedMCPServer,
        providedConfigFields,
      );

      try {
        mastra.getEditor()?.mcpServer.clearCache(storedMCPServerId);
      } catch {
        // editor not configured
      }

      // Return the resolved MCP server with the latest (draft) version so the UI sees its edits
      const resolved = await mcpServerStore.getByIdResolved(storedMCPServerId, { status: 'draft' });
      if (!resolved) {
        throw new HTTPException(500, { message: 'Failed to resolve updated MCP server' });
      }

      return resolved;
    } catch (error) {
      return handleError(error, 'Error updating stored MCP server');
    }
  },
});

/**
 * DELETE /stored/mcp-servers/:storedMCPServerId - Delete a stored MCP server
 */
export const DELETE_STORED_MCP_SERVER_ROUTE = createRoute({
  method: 'DELETE',
  path: '/stored/mcp-servers/:storedMCPServerId',
  responseType: 'json',
  pathParamSchema: storedMCPServerIdPathParams,
  responseSchema: deleteStoredMCPServerResponseSchema,
  summary: 'Delete stored MCP server',
  description: 'Deletes an MCP server from storage by its unique identifier',
  tags: ['Stored MCP Servers'],
  requiresAuth: true,
  handler: async ({ mastra, storedMCPServerId }) => {
    try {
      const mcpServerStore = await getMcpServerStore(mastra);

      // Check if MCP server exists
      const existing = await mcpServerStore.getById(storedMCPServerId);
      if (!existing) {
        throw new HTTPException(404, { message: `Stored MCP server with id ${storedMCPServerId} not found` });
      }

      await mcpServerStore.delete(storedMCPServerId);

      return {
        success: true,
        message: `MCP server ${storedMCPServerId} deleted successfully`,
      };
    } catch (error) {
      return handleError(error, 'Error deleting stored MCP server');
    }
  },
});
