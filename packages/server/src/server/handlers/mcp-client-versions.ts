import { HTTPException } from '../http-exception';
import {
  mcpClientVersionPathParams,
  mcpClientVersionIdPathParams,
  listMCPClientVersionsQuerySchema,
  createMCPClientVersionBodySchema,
  compareMCPClientVersionsQuerySchema,
  listMCPClientVersionsResponseSchema,
  getMCPClientVersionResponseSchema,
  createMCPClientVersionResponseSchema,
  activateMCPClientVersionResponseSchema,
  restoreMCPClientVersionResponseSchema,
  deleteMCPClientVersionResponseSchema,
  compareMCPClientVersionsResponseSchema,
} from '../schemas/mcp-client-versions';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';
import {
  extractConfigFromVersion,
  calculateChangedFields,
  computeVersionDiffs,
  createVersionWithRetry,
  enforceRetentionLimit,
  MCP_CLIENT_SNAPSHOT_CONFIG_FIELDS,
} from './version-helpers';
import type { VersionedStoreInterface } from './version-helpers';

/**
 * GET /stored/mcp-clients/:mcpClientId/versions - List all versions for an MCP client
 */
export const LIST_MCP_CLIENT_VERSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/mcp-clients/:mcpClientId/versions',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: mcpClientVersionPathParams,
  queryParamSchema: listMCPClientVersionsQuerySchema,
  responseSchema: listMCPClientVersionsResponseSchema,
  summary: 'List MCP client versions',
  description: 'Returns a paginated list of all versions for a stored MCP client',
  tags: ['MCP Client Versions'],
  handler: async ({ mastra, mcpClientId, page, perPage, orderBy }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const mcpClientStore = await storage.getStore('mcpClients');
      if (!mcpClientStore) {
        throw new HTTPException(500, { message: 'MCP clients storage domain is not available' });
      }

      const mcpClient = await mcpClientStore.getById(mcpClientId);
      if (!mcpClient) {
        throw new HTTPException(404, { message: `MCP client with id ${mcpClientId} not found` });
      }

      const result = await mcpClientStore.listVersions({
        mcpClientId,
        page,
        perPage,
        orderBy,
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error listing MCP client versions');
    }
  },
});

/**
 * POST /stored/mcp-clients/:mcpClientId/versions - Create a new version snapshot
 */
export const CREATE_MCP_CLIENT_VERSION_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/mcp-clients/:mcpClientId/versions',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: mcpClientVersionPathParams,
  bodySchema: createMCPClientVersionBodySchema,
  responseSchema: createMCPClientVersionResponseSchema,
  summary: 'Create MCP client version',
  description: 'Creates a new version snapshot of the current MCP client configuration',
  tags: ['MCP Client Versions'],
  handler: async ({ mastra, mcpClientId, changeMessage }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const mcpClientStore = await storage.getStore('mcpClients');
      if (!mcpClientStore) {
        throw new HTTPException(500, { message: 'MCP clients storage domain is not available' });
      }

      const mcpClient = await mcpClientStore.getById(mcpClientId);
      if (!mcpClient) {
        throw new HTTPException(404, { message: `MCP client with id ${mcpClientId} not found` });
      }

      let currentConfig: Record<string, unknown> = {};
      if (mcpClient.activeVersionId) {
        const activeVersion = await mcpClientStore.getVersion(mcpClient.activeVersionId);
        if (activeVersion) {
          currentConfig = extractConfigFromVersion(
            activeVersion as unknown as Record<string, unknown>,
            MCP_CLIENT_SNAPSHOT_CONFIG_FIELDS,
          );
        }
      }

      const latestVersion = await mcpClientStore.getLatestVersion(mcpClientId);

      // If no activeVersionId, fall back to latest version config
      if (!mcpClient.activeVersionId && latestVersion) {
        currentConfig = extractConfigFromVersion(
          latestVersion as unknown as Record<string, unknown>,
          MCP_CLIENT_SNAPSHOT_CONFIG_FIELDS,
        );
      }
      const previousConfig = latestVersion
        ? extractConfigFromVersion(
            latestVersion as unknown as Record<string, unknown>,
            MCP_CLIENT_SNAPSHOT_CONFIG_FIELDS,
          )
        : null;

      const changedFields = calculateChangedFields(previousConfig, currentConfig);

      const { versionId } = await createVersionWithRetry(
        mcpClientStore as unknown as VersionedStoreInterface,
        mcpClientId,
        'mcpClientId',
        currentConfig,
        changedFields,
        { changeMessage },
      );

      const version = await mcpClientStore.getVersion(versionId);
      if (!version) {
        throw new HTTPException(500, { message: 'Failed to retrieve created version' });
      }

      await enforceRetentionLimit(
        mcpClientStore as unknown as VersionedStoreInterface,
        mcpClientId,
        'mcpClientId',
        mcpClient.activeVersionId,
      );

      return version;
    } catch (error) {
      return handleError(error, 'Error creating MCP client version');
    }
  },
});

/**
 * GET /stored/mcp-clients/:mcpClientId/versions/:versionId - Get a specific version
 */
export const GET_MCP_CLIENT_VERSION_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/mcp-clients/:mcpClientId/versions/:versionId',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: mcpClientVersionIdPathParams,
  responseSchema: getMCPClientVersionResponseSchema,
  summary: 'Get MCP client version',
  description: 'Returns a specific version of an MCP client by its version ID',
  tags: ['MCP Client Versions'],
  handler: async ({ mastra, mcpClientId, versionId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const mcpClientStore = await storage.getStore('mcpClients');
      if (!mcpClientStore) {
        throw new HTTPException(500, { message: 'MCP clients storage domain is not available' });
      }

      const version = await mcpClientStore.getVersion(versionId);

      if (!version) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found` });
      }

      if (version.mcpClientId !== mcpClientId) {
        throw new HTTPException(404, {
          message: `Version with id ${versionId} not found for MCP client ${mcpClientId}`,
        });
      }

      return version;
    } catch (error) {
      return handleError(error, 'Error getting MCP client version');
    }
  },
});

/**
 * POST /stored/mcp-clients/:mcpClientId/versions/:versionId/activate - Set a version as active
 */
export const ACTIVATE_MCP_CLIENT_VERSION_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/mcp-clients/:mcpClientId/versions/:versionId/activate',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: mcpClientVersionIdPathParams,
  responseSchema: activateMCPClientVersionResponseSchema,
  summary: 'Activate MCP client version',
  description: 'Sets a specific version as the active version for the MCP client',
  tags: ['MCP Client Versions'],
  handler: async ({ mastra, mcpClientId, versionId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const mcpClientStore = await storage.getStore('mcpClients');
      if (!mcpClientStore) {
        throw new HTTPException(500, { message: 'MCP clients storage domain is not available' });
      }

      const mcpClient = await mcpClientStore.getById(mcpClientId);
      if (!mcpClient) {
        throw new HTTPException(404, { message: `MCP client with id ${mcpClientId} not found` });
      }

      const version = await mcpClientStore.getVersion(versionId);
      if (!version) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found` });
      }
      if (version.mcpClientId !== mcpClientId) {
        throw new HTTPException(404, {
          message: `Version with id ${versionId} not found for MCP client ${mcpClientId}`,
        });
      }

      await mcpClientStore.update({
        id: mcpClientId,
        activeVersionId: versionId,
        status: 'published',
      });

      // Clear the editor cache so subsequent requests see the new active version
      mastra.getEditor()?.mcp.clearCache(mcpClientId);

      return {
        success: true,
        message: `Version ${version.versionNumber} is now active`,
        activeVersionId: versionId,
      };
    } catch (error) {
      return handleError(error, 'Error activating MCP client version');
    }
  },
});

/**
 * POST /stored/mcp-clients/:mcpClientId/versions/:versionId/restore - Restore MCP client to a version
 */
export const RESTORE_MCP_CLIENT_VERSION_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/mcp-clients/:mcpClientId/versions/:versionId/restore',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: mcpClientVersionIdPathParams,
  responseSchema: restoreMCPClientVersionResponseSchema,
  summary: 'Restore MCP client version',
  description: 'Restores the MCP client configuration from a version, creating a new version',
  tags: ['MCP Client Versions'],
  handler: async ({ mastra, mcpClientId, versionId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const mcpClientStore = await storage.getStore('mcpClients');
      if (!mcpClientStore) {
        throw new HTTPException(500, { message: 'MCP clients storage domain is not available' });
      }

      const mcpClient = await mcpClientStore.getById(mcpClientId);
      if (!mcpClient) {
        throw new HTTPException(404, { message: `MCP client with id ${mcpClientId} not found` });
      }

      const versionToRestore = await mcpClientStore.getVersion(versionId);
      if (!versionToRestore) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found` });
      }
      if (versionToRestore.mcpClientId !== mcpClientId) {
        throw new HTTPException(404, {
          message: `Version with id ${versionId} not found for MCP client ${mcpClientId}`,
        });
      }

      const restoredConfig = extractConfigFromVersion(
        versionToRestore as unknown as Record<string, unknown>,
        MCP_CLIENT_SNAPSHOT_CONFIG_FIELDS,
      );

      await mcpClientStore.update({
        id: mcpClientId,
        ...restoredConfig,
      });

      const latestVersion = await mcpClientStore.getLatestVersion(mcpClientId);
      const previousConfig = latestVersion
        ? extractConfigFromVersion(
            latestVersion as unknown as Record<string, unknown>,
            MCP_CLIENT_SNAPSHOT_CONFIG_FIELDS,
          )
        : null;

      const changedFields = calculateChangedFields(previousConfig, restoredConfig);

      const { versionId: newVersionId } = await createVersionWithRetry(
        mcpClientStore as unknown as VersionedStoreInterface,
        mcpClientId,
        'mcpClientId',
        restoredConfig,
        changedFields,
        {
          changeMessage: `Restored from version ${versionToRestore.versionNumber}`,
        },
      );

      const newVersion = await mcpClientStore.getVersion(newVersionId);
      if (!newVersion) {
        throw new HTTPException(500, { message: 'Failed to retrieve created version' });
      }

      await enforceRetentionLimit(
        mcpClientStore as unknown as VersionedStoreInterface,
        mcpClientId,
        'mcpClientId',
        mcpClient.activeVersionId,
      );

      // Clear the editor cache so subsequent requests see the updated config
      mastra.getEditor()?.mcp.clearCache(mcpClientId);

      return newVersion;
    } catch (error) {
      return handleError(error, 'Error restoring MCP client version');
    }
  },
});

/**
 * DELETE /stored/mcp-clients/:mcpClientId/versions/:versionId - Delete a version
 */
export const DELETE_MCP_CLIENT_VERSION_ROUTE = createRoute({
  method: 'DELETE',
  path: '/stored/mcp-clients/:mcpClientId/versions/:versionId',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: mcpClientVersionIdPathParams,
  responseSchema: deleteMCPClientVersionResponseSchema,
  summary: 'Delete MCP client version',
  description: 'Deletes a specific version (cannot delete the active version)',
  tags: ['MCP Client Versions'],
  handler: async ({ mastra, mcpClientId, versionId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const mcpClientStore = await storage.getStore('mcpClients');
      if (!mcpClientStore) {
        throw new HTTPException(500, { message: 'MCP clients storage domain is not available' });
      }

      const mcpClient = await mcpClientStore.getById(mcpClientId);
      if (!mcpClient) {
        throw new HTTPException(404, { message: `MCP client with id ${mcpClientId} not found` });
      }

      const version = await mcpClientStore.getVersion(versionId);
      if (!version) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found` });
      }
      if (version.mcpClientId !== mcpClientId) {
        throw new HTTPException(404, {
          message: `Version with id ${versionId} not found for MCP client ${mcpClientId}`,
        });
      }

      if (mcpClient.activeVersionId === versionId) {
        throw new HTTPException(400, {
          message: 'Cannot delete the active version. Activate a different version first.',
        });
      }

      await mcpClientStore.deleteVersion(versionId);

      // Clear the editor cache so subsequent requests see the updated config
      mastra.getEditor()?.mcp.clearCache(mcpClientId);

      return {
        success: true,
        message: `Version ${version.versionNumber} deleted successfully`,
      };
    } catch (error) {
      return handleError(error, 'Error deleting MCP client version');
    }
  },
});

/**
 * GET /stored/mcp-clients/:mcpClientId/versions/compare - Compare two versions
 */
export const COMPARE_MCP_CLIENT_VERSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/mcp-clients/:mcpClientId/versions/compare',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: mcpClientVersionPathParams,
  queryParamSchema: compareMCPClientVersionsQuerySchema,
  responseSchema: compareMCPClientVersionsResponseSchema,
  summary: 'Compare MCP client versions',
  description: 'Compares two versions and returns the differences between them',
  tags: ['MCP Client Versions'],
  handler: async ({ mastra, mcpClientId, from, to }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const mcpClientStore = await storage.getStore('mcpClients');
      if (!mcpClientStore) {
        throw new HTTPException(500, { message: 'MCP clients storage domain is not available' });
      }

      const fromVersion = await mcpClientStore.getVersion(from);
      if (!fromVersion) {
        throw new HTTPException(404, { message: `Version with id ${from} not found` });
      }
      if (fromVersion.mcpClientId !== mcpClientId) {
        throw new HTTPException(404, {
          message: `Version with id ${from} not found for MCP client ${mcpClientId}`,
        });
      }

      const toVersion = await mcpClientStore.getVersion(to);
      if (!toVersion) {
        throw new HTTPException(404, { message: `Version with id ${to} not found` });
      }
      if (toVersion.mcpClientId !== mcpClientId) {
        throw new HTTPException(404, {
          message: `Version with id ${to} not found for MCP client ${mcpClientId}`,
        });
      }

      const fromConfig = extractConfigFromVersion(
        fromVersion as unknown as Record<string, unknown>,
        MCP_CLIENT_SNAPSHOT_CONFIG_FIELDS,
      );
      const toConfig = extractConfigFromVersion(
        toVersion as unknown as Record<string, unknown>,
        MCP_CLIENT_SNAPSHOT_CONFIG_FIELDS,
      );

      const diffs = computeVersionDiffs(fromConfig, toConfig);

      return {
        diffs,
        fromVersion,
        toVersion,
      };
    } catch (error) {
      return handleError(error, 'Error comparing MCP client versions');
    }
  },
});
