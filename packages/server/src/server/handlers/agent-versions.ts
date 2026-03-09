import { HTTPException } from '../http-exception';
import {
  agentVersionPathParams,
  versionIdPathParams,
  listVersionsQuerySchema,
  createVersionBodySchema,
  compareVersionsQuerySchema,
  listVersionsResponseSchema,
  getVersionResponseSchema,
  createVersionResponseSchema,
  activateVersionResponseSchema,
  restoreVersionResponseSchema,
  deleteVersionResponseSchema,
  compareVersionsResponseSchema,
} from '../schemas/agent-versions';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';
import {
  extractConfigFromVersion,
  calculateChangedFields,
  computeVersionDiffs,
  createVersionWithRetry,
  enforceRetentionLimit,
} from './version-helpers';
import type { VersionedStoreInterface } from './version-helpers';

/**
 * The config field names that live on version rows (StorageAgentSnapshotType fields).
 * Used to extract config from a version record for comparison and restoration.
 */
const SNAPSHOT_CONFIG_FIELDS = [
  'name',
  'description',
  'instructions',
  'model',
  'tools',
  'defaultOptions',
  'workflows',
  'agents',
  'integrationTools',
  'inputProcessors',
  'outputProcessors',
  'memory',
  'scorers',
  'requestContextSchema',
  'mcpClients',
] as const;

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * GET /stored/agents/:agentId/versions - List all versions for an agent
 */
export const LIST_AGENT_VERSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/agents/:agentId/versions',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: agentVersionPathParams,
  queryParamSchema: listVersionsQuerySchema,
  responseSchema: listVersionsResponseSchema,
  summary: 'List agent versions',
  description: 'Returns a paginated list of all versions for a stored agent',
  tags: ['Agent Versions'],
  handler: async ({ mastra, agentId, page, perPage, orderBy }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const agentsStore = await storage.getStore('agents');
      if (!agentsStore) {
        throw new HTTPException(500, { message: 'Agents storage domain is not available' });
      }

      // Verify agent exists
      const agent = await agentsStore.getById(agentId);
      if (!agent) {
        throw new HTTPException(404, { message: `Agent with id ${agentId} not found` });
      }

      const result = await agentsStore.listVersions({
        agentId,
        page,
        perPage,
        orderBy,
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error listing agent versions');
    }
  },
});

/**
 * POST /stored/agents/:agentId/versions - Create a new version snapshot
 */
export const CREATE_AGENT_VERSION_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/agents/:agentId/versions',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: agentVersionPathParams,
  bodySchema: createVersionBodySchema,
  responseSchema: createVersionResponseSchema,
  summary: 'Create agent version',
  description: 'Creates a new version snapshot of the current agent configuration',
  tags: ['Agent Versions'],
  handler: async ({ mastra, agentId, changeMessage }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const agentsStore = await storage.getStore('agents');
      if (!agentsStore) {
        throw new HTTPException(500, { message: 'Agents storage domain is not available' });
      }

      // Get the current agent to find its active version
      const agent = await agentsStore.getById(agentId);
      if (!agent) {
        throw new HTTPException(404, { message: `Agent with id ${agentId} not found` });
      }

      // Get the current active version to snapshot its config
      let currentConfig: Record<string, unknown> = {};
      if (agent.activeVersionId) {
        const activeVersion = await agentsStore.getVersion(agent.activeVersionId);
        if (activeVersion) {
          currentConfig = extractConfigFromVersion(
            activeVersion as unknown as Record<string, unknown>,
            SNAPSHOT_CONFIG_FIELDS,
          );
        }
      }

      // Get the latest version to calculate changed fields
      const latestVersion = await agentsStore.getLatestVersion(agentId);

      // If no activeVersionId, fall back to latest version config
      if (!agent.activeVersionId && latestVersion) {
        currentConfig = extractConfigFromVersion(
          latestVersion as unknown as Record<string, unknown>,
          SNAPSHOT_CONFIG_FIELDS,
        );
      }
      const previousConfig = latestVersion
        ? extractConfigFromVersion(latestVersion as unknown as Record<string, unknown>, SNAPSHOT_CONFIG_FIELDS)
        : null;

      const changedFields = calculateChangedFields(previousConfig, currentConfig);

      // Create the new version with retry logic to handle race conditions
      // Config fields are passed top-level
      const { versionId } = await createVersionWithRetry(
        agentsStore as unknown as VersionedStoreInterface,
        agentId,
        'agentId',
        currentConfig,
        changedFields,
        { changeMessage },
      );

      // Get the created version to return
      const version = await agentsStore.getVersion(versionId);
      if (!version) {
        throw new HTTPException(500, { message: 'Failed to retrieve created version' });
      }

      // Enforce retention limit - delete oldest versions if we exceed the max
      await enforceRetentionLimit(
        agentsStore as unknown as VersionedStoreInterface,
        agentId,
        'agentId',
        agent.activeVersionId,
      );

      return version;
    } catch (error) {
      return handleError(error, 'Error creating agent version');
    }
  },
});

/**
 * GET /stored/agents/:agentId/versions/:versionId - Get a specific version
 */
export const GET_AGENT_VERSION_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/agents/:agentId/versions/:versionId',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: versionIdPathParams,
  responseSchema: getVersionResponseSchema,
  summary: 'Get agent version',
  description: 'Returns a specific version of an agent by its version ID',
  tags: ['Agent Versions'],
  handler: async ({ mastra, agentId, versionId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const agentsStore = await storage.getStore('agents');
      if (!agentsStore) {
        throw new HTTPException(500, { message: 'Agents storage domain is not available' });
      }

      const version = await agentsStore.getVersion(versionId);

      if (!version) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found` });
      }

      // Verify the version belongs to the specified agent
      if (version.agentId !== agentId) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found for agent ${agentId}` });
      }

      return version;
    } catch (error) {
      return handleError(error, 'Error getting agent version');
    }
  },
});

/**
 * POST /stored/agents/:agentId/versions/:versionId/activate - Set a version as active
 */
export const ACTIVATE_AGENT_VERSION_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/agents/:agentId/versions/:versionId/activate',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: versionIdPathParams,
  responseSchema: activateVersionResponseSchema,
  summary: 'Activate agent version',
  description: 'Sets a specific version as the active version for the agent',
  tags: ['Agent Versions'],
  handler: async ({ mastra, agentId, versionId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const agentsStore = await storage.getStore('agents');
      if (!agentsStore) {
        throw new HTTPException(500, { message: 'Agents storage domain is not available' });
      }

      // Verify agent exists
      const agent = await agentsStore.getById(agentId);
      if (!agent) {
        throw new HTTPException(404, { message: `Agent with id ${agentId} not found` });
      }

      // Verify version exists and belongs to this agent
      const version = await agentsStore.getVersion(versionId);
      if (!version) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found` });
      }
      if (version.agentId !== agentId) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found for agent ${agentId}` });
      }

      // Update the agent's activeVersionId AND status to 'published'
      await agentsStore.update({
        id: agentId,
        activeVersionId: versionId,
        status: 'published',
      });

      // Clear the editor cache so subsequent requests see the new active version
      mastra.getEditor()?.agent.clearCache(agentId);

      return {
        success: true,
        message: `Version ${version.versionNumber} is now active`,
        activeVersionId: versionId,
      };
    } catch (error) {
      return handleError(error, 'Error activating agent version');
    }
  },
});

/**
 * POST /stored/agents/:agentId/versions/:versionId/restore - Restore agent to a version
 */
export const RESTORE_AGENT_VERSION_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/agents/:agentId/versions/:versionId/restore',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: versionIdPathParams,
  responseSchema: restoreVersionResponseSchema,
  summary: 'Restore agent version',
  description: 'Restores the agent configuration from a version, creating a new version',
  tags: ['Agent Versions'],
  handler: async ({ mastra, agentId, versionId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const agentsStore = await storage.getStore('agents');
      if (!agentsStore) {
        throw new HTTPException(500, { message: 'Agents storage domain is not available' });
      }

      // Verify agent exists
      const agent = await agentsStore.getById(agentId);
      if (!agent) {
        throw new HTTPException(404, { message: `Agent with id ${agentId} not found` });
      }

      // Get the version to restore
      const versionToRestore = await agentsStore.getVersion(versionId);
      if (!versionToRestore) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found` });
      }
      if (versionToRestore.agentId !== agentId) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found for agent ${agentId}` });
      }

      // Extract the config fields from the version to restore (top-level, no .snapshot)
      const restoredConfig = extractConfigFromVersion(
        versionToRestore as unknown as Record<string, unknown>,
        SNAPSHOT_CONFIG_FIELDS,
      );

      // Update the agent with the config from the version to restore
      await agentsStore.update({
        id: agentId,
        ...restoredConfig,
      });

      // Get the latest version to calculate changed fields
      const latestVersion = await agentsStore.getLatestVersion(agentId);
      const previousConfig = latestVersion
        ? extractConfigFromVersion(latestVersion as unknown as Record<string, unknown>, SNAPSHOT_CONFIG_FIELDS)
        : null;

      const changedFields = calculateChangedFields(previousConfig, restoredConfig);

      // Create a new version with retry logic to handle race conditions
      // Config fields are passed top-level
      const { versionId: newVersionId } = await createVersionWithRetry(
        agentsStore as unknown as VersionedStoreInterface,
        agentId,
        'agentId',
        restoredConfig,
        changedFields,
        {
          changeMessage: `Restored from version ${versionToRestore.versionNumber}`,
        },
      );

      // Do NOT auto-activate the restored version - user must explicitly activate it

      // Get the created version to return
      const newVersion = await agentsStore.getVersion(newVersionId);
      if (!newVersion) {
        throw new HTTPException(500, { message: 'Failed to retrieve created version' });
      }

      // Enforce retention limit - delete oldest versions if we exceed the max
      // Use the agent's existing activeVersionId
      await enforceRetentionLimit(
        agentsStore as unknown as VersionedStoreInterface,
        agentId,
        'agentId',
        agent.activeVersionId,
      );

      // Clear the editor cache so subsequent requests see the restored config
      mastra.getEditor()?.agent.clearCache(agentId);

      return newVersion;
    } catch (error) {
      return handleError(error, 'Error restoring agent version');
    }
  },
});

/**
 * DELETE /stored/agents/:agentId/versions/:versionId - Delete a version
 */
export const DELETE_AGENT_VERSION_ROUTE = createRoute({
  method: 'DELETE',
  path: '/stored/agents/:agentId/versions/:versionId',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: versionIdPathParams,
  responseSchema: deleteVersionResponseSchema,
  summary: 'Delete agent version',
  description: 'Deletes a specific version (cannot delete the active version)',
  tags: ['Agent Versions'],
  handler: async ({ mastra, agentId, versionId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const agentsStore = await storage.getStore('agents');
      if (!agentsStore) {
        throw new HTTPException(500, { message: 'Agents storage domain is not available' });
      }

      // Verify agent exists
      const agent = await agentsStore.getById(agentId);
      if (!agent) {
        throw new HTTPException(404, { message: `Agent with id ${agentId} not found` });
      }

      // Verify version exists and belongs to this agent
      const version = await agentsStore.getVersion(versionId);
      if (!version) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found` });
      }
      if (version.agentId !== agentId) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found for agent ${agentId}` });
      }

      // Check if this is the active version
      if (agent.activeVersionId === versionId) {
        throw new HTTPException(400, {
          message: 'Cannot delete the active version. Activate a different version first.',
        });
      }

      await agentsStore.deleteVersion(versionId);

      // Clear the editor cache in case the deleted version affected resolution
      mastra.getEditor()?.agent.clearCache(agentId);

      return {
        success: true,
        message: `Version ${version.versionNumber} deleted successfully`,
      };
    } catch (error) {
      return handleError(error, 'Error deleting agent version');
    }
  },
});

/**
 * GET /stored/agents/:agentId/versions/compare - Compare two versions
 */
export const COMPARE_AGENT_VERSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/agents/:agentId/versions/compare',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: agentVersionPathParams,
  queryParamSchema: compareVersionsQuerySchema,
  responseSchema: compareVersionsResponseSchema,
  summary: 'Compare agent versions',
  description: 'Compares two versions and returns the differences between them',
  tags: ['Agent Versions'],
  handler: async ({ mastra, agentId, from, to }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const agentsStore = await storage.getStore('agents');
      if (!agentsStore) {
        throw new HTTPException(500, { message: 'Agents storage domain is not available' });
      }

      // Get both versions
      const fromVersion = await agentsStore.getVersion(from);
      if (!fromVersion) {
        throw new HTTPException(404, { message: `Version with id ${from} not found` });
      }
      if (fromVersion.agentId !== agentId) {
        throw new HTTPException(404, { message: `Version with id ${from} not found for agent ${agentId}` });
      }

      const toVersion = await agentsStore.getVersion(to);
      if (!toVersion) {
        throw new HTTPException(404, { message: `Version with id ${to} not found` });
      }
      if (toVersion.agentId !== agentId) {
        throw new HTTPException(404, { message: `Version with id ${to} not found for agent ${agentId}` });
      }

      // Extract config fields from both versions (top-level, no .snapshot)
      const fromConfig = extractConfigFromVersion(
        fromVersion as unknown as Record<string, unknown>,
        SNAPSHOT_CONFIG_FIELDS,
      );
      const toConfig = extractConfigFromVersion(
        toVersion as unknown as Record<string, unknown>,
        SNAPSHOT_CONFIG_FIELDS,
      );

      // Compute diffs on the config fields
      const diffs = computeVersionDiffs(fromConfig, toConfig);

      return {
        diffs,
        fromVersion,
        toVersion,
      };
    } catch (error) {
      return handleError(error, 'Error comparing agent versions');
    }
  },
});
