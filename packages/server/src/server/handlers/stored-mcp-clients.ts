import { HTTPException } from '../http-exception';
import {
  storedMCPClientIdPathParams,
  statusQuerySchema,
  listStoredMCPClientsQuerySchema,
  createStoredMCPClientBodySchema,
  updateStoredMCPClientBodySchema,
  listStoredMCPClientsResponseSchema,
  getStoredMCPClientResponseSchema,
  createStoredMCPClientResponseSchema,
  updateStoredMCPClientResponseSchema,
  deleteStoredMCPClientResponseSchema,
} from '../schemas/stored-mcp-clients';
import { createRoute } from '../server-adapter/routes/route-builder';
import { toSlug } from '../utils';

import { handleError } from './error';
import { handleAutoVersioning, MCP_CLIENT_SNAPSHOT_CONFIG_FIELDS } from './version-helpers';
import type { VersionedStoreInterface } from './version-helpers';

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * GET /stored/mcp-clients - List all stored MCP clients
 */
export const LIST_STORED_MCP_CLIENTS_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/mcp-clients',
  responseType: 'json',
  queryParamSchema: listStoredMCPClientsQuerySchema,
  responseSchema: listStoredMCPClientsResponseSchema,
  summary: 'List stored MCP clients',
  description: 'Returns a paginated list of all MCP client configurations stored in the database',
  tags: ['Stored MCP Clients'],
  requiresAuth: true,
  handler: async ({ mastra, page, perPage, orderBy, status, authorId, metadata }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const mcpClientStore = await storage.getStore('mcpClients');
      if (!mcpClientStore) {
        throw new HTTPException(500, { message: 'MCP clients storage domain is not available' });
      }

      const result = await mcpClientStore.listResolved({
        page,
        perPage,
        orderBy,
        status,
        authorId,
        metadata,
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error listing stored MCP clients');
    }
  },
});

/**
 * GET /stored/mcp-clients/:storedMCPClientId - Get a stored MCP client by ID
 */
export const GET_STORED_MCP_CLIENT_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/mcp-clients/:storedMCPClientId',
  responseType: 'json',
  pathParamSchema: storedMCPClientIdPathParams,
  queryParamSchema: statusQuerySchema,
  responseSchema: getStoredMCPClientResponseSchema,
  summary: 'Get stored MCP client by ID',
  description:
    'Returns a specific MCP client from storage by its unique identifier. Use ?status=draft to resolve with the latest (draft) version, or ?status=published (default) for the active published version.',
  tags: ['Stored MCP Clients'],
  requiresAuth: true,
  handler: async ({ mastra, storedMCPClientId, status }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const mcpClientStore = await storage.getStore('mcpClients');
      if (!mcpClientStore) {
        throw new HTTPException(500, { message: 'MCP clients storage domain is not available' });
      }

      const mcpClient = await mcpClientStore.getByIdResolved(storedMCPClientId, { status });

      if (!mcpClient) {
        throw new HTTPException(404, { message: `Stored MCP client with id ${storedMCPClientId} not found` });
      }

      return mcpClient;
    } catch (error) {
      return handleError(error, 'Error getting stored MCP client');
    }
  },
});

/**
 * POST /stored/mcp-clients - Create a new stored MCP client
 */
export const CREATE_STORED_MCP_CLIENT_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/mcp-clients',
  responseType: 'json',
  bodySchema: createStoredMCPClientBodySchema,
  responseSchema: createStoredMCPClientResponseSchema,
  summary: 'Create stored MCP client',
  description: 'Creates a new MCP client configuration in storage with the provided servers',
  tags: ['Stored MCP Clients'],
  requiresAuth: true,
  handler: async ({ mastra, id: providedId, authorId, metadata, name, description, servers }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const mcpClientStore = await storage.getStore('mcpClients');
      if (!mcpClientStore) {
        throw new HTTPException(500, { message: 'MCP clients storage domain is not available' });
      }

      // Derive ID from name if not explicitly provided
      const id = providedId || toSlug(name);

      if (!id) {
        throw new HTTPException(400, {
          message: 'Could not derive MCP client ID from name. Please provide an explicit id.',
        });
      }

      // Check if MCP client with this ID already exists
      const existing = await mcpClientStore.getById(id);
      if (existing) {
        throw new HTTPException(409, { message: `MCP client with id ${id} already exists` });
      }

      await mcpClientStore.create({
        mcpClient: {
          id,
          authorId,
          metadata,
          name,
          description,
          servers,
        },
      });

      // Return the resolved MCP client (thin record + version config)
      // Use draft status since newly created entities start as drafts
      const resolved = await mcpClientStore.getByIdResolved(id, { status: 'draft' });
      if (!resolved) {
        throw new HTTPException(500, { message: 'Failed to resolve created MCP client' });
      }

      return resolved;
    } catch (error) {
      return handleError(error, 'Error creating stored MCP client');
    }
  },
});

/**
 * PATCH /stored/mcp-clients/:storedMCPClientId - Update a stored MCP client
 */
export const UPDATE_STORED_MCP_CLIENT_ROUTE = createRoute({
  method: 'PATCH',
  path: '/stored/mcp-clients/:storedMCPClientId',
  responseType: 'json',
  pathParamSchema: storedMCPClientIdPathParams,
  bodySchema: updateStoredMCPClientBodySchema,
  responseSchema: updateStoredMCPClientResponseSchema,
  summary: 'Update stored MCP client',
  description: 'Updates an existing MCP client in storage with the provided fields',
  tags: ['Stored MCP Clients'],
  requiresAuth: true,
  handler: async ({
    mastra,
    storedMCPClientId,
    // Metadata-level fields
    authorId,
    metadata,
    // Config fields (snapshot-level)
    name,
    description,
    servers,
  }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const mcpClientStore = await storage.getStore('mcpClients');
      if (!mcpClientStore) {
        throw new HTTPException(500, { message: 'MCP clients storage domain is not available' });
      }

      // Check if MCP client exists
      const existing = await mcpClientStore.getById(storedMCPClientId);
      if (!existing) {
        throw new HTTPException(404, { message: `Stored MCP client with id ${storedMCPClientId} not found` });
      }

      // Update the MCP client with both metadata-level and config-level fields
      const updatedMCPClient = await mcpClientStore.update({
        id: storedMCPClientId,
        authorId,
        metadata,
        name,
        description,
        servers,
      });

      // Build the snapshot config for auto-versioning comparison
      const configFields = { name, description, servers };

      // Filter out undefined values to get only the config fields that were provided
      const providedConfigFields = Object.fromEntries(Object.entries(configFields).filter(([_, v]) => v !== undefined));

      // Handle auto-versioning with retry logic for race conditions
      // This creates a new version if there are meaningful config changes.
      // It does NOT update activeVersionId — the version stays as a draft until explicitly published.
      await handleAutoVersioning(
        mcpClientStore as unknown as VersionedStoreInterface,
        storedMCPClientId,
        'mcpClientId',
        MCP_CLIENT_SNAPSHOT_CONFIG_FIELDS,
        existing,
        updatedMCPClient,
        providedConfigFields,
      );

      // Return the resolved MCP client with the latest (draft) version so the UI sees its edits
      const resolved = await mcpClientStore.getByIdResolved(storedMCPClientId, { status: 'draft' });
      if (!resolved) {
        throw new HTTPException(500, { message: 'Failed to resolve updated MCP client' });
      }

      return resolved;
    } catch (error) {
      return handleError(error, 'Error updating stored MCP client');
    }
  },
});

/**
 * DELETE /stored/mcp-clients/:storedMCPClientId - Delete a stored MCP client
 */
export const DELETE_STORED_MCP_CLIENT_ROUTE = createRoute({
  method: 'DELETE',
  path: '/stored/mcp-clients/:storedMCPClientId',
  responseType: 'json',
  pathParamSchema: storedMCPClientIdPathParams,
  responseSchema: deleteStoredMCPClientResponseSchema,
  summary: 'Delete stored MCP client',
  description: 'Deletes an MCP client from storage by its unique identifier',
  tags: ['Stored MCP Clients'],
  requiresAuth: true,
  handler: async ({ mastra, storedMCPClientId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const mcpClientStore = await storage.getStore('mcpClients');
      if (!mcpClientStore) {
        throw new HTTPException(500, { message: 'MCP clients storage domain is not available' });
      }

      // Check if MCP client exists
      const existing = await mcpClientStore.getById(storedMCPClientId);
      if (!existing) {
        throw new HTTPException(404, { message: `Stored MCP client with id ${storedMCPClientId} not found` });
      }

      await mcpClientStore.delete(storedMCPClientId);

      return {
        success: true,
        message: `MCP client ${storedMCPClientId} deleted successfully`,
      };
    } catch (error) {
      return handleError(error, 'Error deleting stored MCP client');
    }
  },
});
