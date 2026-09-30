import type { z } from 'zod/v4';

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
  activateAgentVersionBodySchema,
  activateVersionResponseSchema,
  restoreVersionResponseSchema,
  deleteVersionResponseSchema,
  compareVersionsResponseSchema,
} from '../schemas/agent-versions';
import type { ServerRoute, RouteSchemas, InferParams } from '../server-adapter/routes';
import { createRoute } from '../server-adapter/routes/route-builder';
import { assertStoredResourceScope, getStoredResourceScope } from '../utils';

import { assertReadAccess, assertWriteAccess } from './authorship';
import { handleError } from './error';
import { validateAgentInstructionReferences } from './validate-agent-instructions';
import {
  extractConfigFromVersion,
  calculateChangedFields,
  computeVersionDiffs,
  createVersionWithRetry,
  enforceRetentionLimit,
} from './version-helpers';
import type { VersionedStoreInterface } from './version-helpers';
import { createVersionLabelApiError, handleVersionLabelError, VERSION_LABEL_PATTERN } from './version-label-errors';

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

/**
 * Serializes production moves made through this server process. The frozen
 * agents-store update contract is unconditional, so cross-process atomic CAS
 * requires a future storage primitive rather than a stronger handler lock.
 */
const activationQueues = new WeakMap<object, Map<string, Promise<void>>>();

async function withAgentActivationLock<T>(storage: object, agentId: string, operation: () => Promise<T>): Promise<T> {
  let queues = activationQueues.get(storage);
  if (!queues) {
    queues = new Map();
    activationQueues.set(storage, queues);
  }

  const previous = queues.get(agentId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(resolve => {
    release = resolve;
  });
  queues.set(agentId, current);

  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (queues.get(agentId) === current) {
      queues.delete(agentId);
      if (queues.size === 0) activationQueues.delete(storage);
    }
  }
}

function throwVersionLabelIntegrityError(input: { agentId: string; label: string; versionId?: string }): never {
  throw createVersionLabelApiError('VERSION_LABEL_INTEGRITY_ERROR', 'The version label points to an invalid version.', {
    entityId: input.agentId,
    label: input.label,
    ...(input.versionId ? { versionId: input.versionId } : {}),
  });
}

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
  requiresPermission: 'stored-agents:read',
  responseType: 'json',
  pathParamSchema: agentVersionPathParams,
  queryParamSchema: listVersionsQuerySchema,
  responseSchema: listVersionsResponseSchema,
  summary: 'List agent versions',
  description: 'Returns a paginated list of all versions for a stored agent',
  tags: ['Agent Versions'],
  handler: async ({ mastra, agentId, page, perPage, orderBy, requestContext }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const agentsStore = await storage.getStore('agents');
      if (!agentsStore) {
        throw new HTTPException(500, { message: 'Agents storage domain is not available' });
      }

      // Verify agent exists in code or storage
      const storedAgent = await agentsStore.getById(agentId);
      let codeAgentExists = false;
      try {
        mastra.getAgentById(agentId);
        codeAgentExists = true;
      } catch {
        // Agent not registered in code
      }

      if (!storedAgent && !codeAgentExists) {
        throw createVersionLabelApiError('ENTITY_NOT_FOUND', `Agent with id ${agentId} not found`, { agentId });
      }
      if (storedAgent) {
        try {
          assertStoredResourceScope(storedAgent, await getStoredResourceScope(mastra, requestContext));
          assertReadAccess({
            requestContext,
            resource: 'stored-agents',
            resourceId: agentId,
            record: storedAgent,
          });
        } catch (error) {
          if (error instanceof HTTPException && error.status === 404) {
            throw createVersionLabelApiError('ENTITY_NOT_FOUND', `Agent with id ${agentId} not found`, { agentId });
          }
          throw error;
        }
      }

      const result = await agentsStore.listVersions({
        agentId,
        page,
        perPage,
        orderBy,
      });

      const versionsById = new Map(result.versions.map(version => [version.id, version]));
      const labelsByVersion = new Map(result.versions.map(version => [version.id, new Set<string>()]));
      const customLabelsPromise = agentsStore.versionLabels
        ?.list({ entityType: 'agent', entityId: agentId, page: 0, perPage: false })
        .catch(error => {
          // Source-controlled agents and adapters without custom-label support
          // still expose computed production/latest badges in version history.
          if (error instanceof Error && (error as { id?: unknown }).id === 'VERSION_LABELS_UNSUPPORTED') {
            return undefined;
          }
          throw error;
        });
      const [latestVersion, activeVersion, customResult] = await Promise.all([
        agentsStore.getLatestVersion(agentId),
        storedAgent?.activeVersionId ? agentsStore.getVersion(storedAgent.activeVersionId) : Promise.resolve(null),
        customLabelsPromise ?? Promise.resolve(undefined),
      ]);

      if (storedAgent?.activeVersionId) {
        if (!activeVersion || activeVersion.agentId !== agentId) {
          throwVersionLabelIntegrityError({
            agentId,
            label: 'production',
            versionId: storedAgent.activeVersionId,
          });
        }
        labelsByVersion.get(storedAgent.activeVersionId)?.add('production');
      }

      if (latestVersion) {
        if (latestVersion.agentId !== agentId) {
          throwVersionLabelIntegrityError({ agentId, label: 'latest', versionId: latestVersion.id });
        }
        labelsByVersion.get(latestVersion.id)?.add('latest');
      }

      const seenCustomLabels = new Set<string>();
      const customPointers = [...(customResult?.labels ?? [])].sort((left, right) =>
        left.label === right.label ? 0 : left.label < right.label ? -1 : 1,
      );
      for (const pointer of customPointers) {
        if (
          pointer.entityType !== 'agent' ||
          pointer.entityId !== agentId ||
          !VERSION_LABEL_PATTERN.test(pointer.label) ||
          pointer.label === 'production' ||
          pointer.label === 'latest' ||
          seenCustomLabels.has(pointer.label)
        ) {
          throwVersionLabelIntegrityError({ agentId, label: pointer.label, versionId: pointer.versionId });
        }
        seenCustomLabels.add(pointer.label);

        const pageTarget = versionsById.get(pointer.versionId);
        if (pageTarget && pageTarget.agentId === agentId) {
          labelsByVersion.get(pointer.versionId)?.add(pointer.label);
        }
      }

      return {
        ...result,
        versions: result.versions.map(version => ({
          ...version,
          labels: [...(labelsByVersion.get(version.id) ?? [])],
        })),
      };
    } catch (error) {
      return handleVersionLabelError(error, 'Error listing agent versions');
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
  handler: async ({ mastra, agentId, changeMessage, requestContext }) => {
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
      assertStoredResourceScope(agent, await getStoredResourceScope(mastra, requestContext));

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
  handler: async ({ mastra, agentId, versionId, requestContext }) => {
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
      const agent = await agentsStore.getById(agentId);
      assertStoredResourceScope(agent, await getStoredResourceScope(mastra, requestContext));

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
  requiresPermission: 'stored-agents:publish',
  responseType: 'json',
  pathParamSchema: versionIdPathParams,
  bodySchema: activateAgentVersionBodySchema,
  responseSchema: activateVersionResponseSchema,
  summary: 'Activate agent version',
  description: 'Sets a specific version as the active version for the agent',
  tags: ['Agent Versions'],
  handler: async ({ mastra, agentId, versionId, expectedActiveVersionId, requestContext }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const agentsStore = await storage.getStore('agents');
      if (!agentsStore) {
        throw new HTTPException(500, { message: 'Agents storage domain is not available' });
      }

      return await withAgentActivationLock(storage as object, agentId, async () => {
        // Verify agent exists and the caller can move its production pointer.
        const agent = await agentsStore.getById(agentId);
        if (!agent) {
          throw createVersionLabelApiError('ENTITY_NOT_FOUND', `Agent with id ${agentId} not found`, { agentId });
        }
        try {
          assertStoredResourceScope(agent, await getStoredResourceScope(mastra, requestContext));
          assertWriteAccess({
            requestContext,
            resource: 'stored-agents',
            resourceId: agentId,
            action: 'publish',
            record: agent,
          });
        } catch (error) {
          if (error instanceof HTTPException && error.status === 404) {
            throw createVersionLabelApiError('ENTITY_NOT_FOUND', `Agent with id ${agentId} not found`, { agentId });
          }
          throw error;
        }

        // Verify version exists and belongs to this agent.
        const version = await agentsStore.getVersion(versionId);
        if (!version || version.agentId !== agentId) {
          throw createVersionLabelApiError('VERSION_NOT_FOUND', `Version with id ${versionId} not found`, {
            agentId,
            versionId,
          });
        }

        const response = {
          success: true,
          message: `Version ${version.versionNumber} is now active`,
          activeVersionId: versionId,
        };
        const validateTargetReferences = () =>
          validateAgentInstructionReferences({
            instructions: version.instructions,
            mastra,
            requestContext,
          });

        // Desired-state idempotency takes precedence over a stale precondition.
        if (agent.activeVersionId === versionId) {
          await validateTargetReferences();
          return response;
        }

        const currentActiveVersionId = agent.activeVersionId ?? null;
        if (expectedActiveVersionId !== undefined && expectedActiveVersionId !== currentActiveVersionId) {
          throw createVersionLabelApiError('LABEL_MOVE_CONFLICT', 'Production changed after it was read.', {
            label: 'production',
            expectedActiveVersionId,
            currentActiveVersionId,
          });
        }

        await validateTargetReferences();

        // Update the agent's activeVersionId AND status to 'published'.
        await agentsStore.update({
          id: agentId,
          activeVersionId: versionId,
          status: 'published',
        });

        // Clear the editor cache so subsequent requests see the new active version.
        mastra.getEditor()?.agent.clearCache(agentId);
        return response;
      });
    } catch (error) {
      return handleVersionLabelError(error, 'Error activating agent version');
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
  handler: async ({ mastra, agentId, versionId, requestContext }) => {
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
      assertStoredResourceScope(agent, await getStoredResourceScope(mastra, requestContext));

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
  handler: async ({ mastra, agentId, versionId, requestContext }) => {
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
      assertStoredResourceScope(agent, await getStoredResourceScope(mastra, requestContext));

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
      return handleVersionLabelError(error, 'Error deleting agent version');
    }
  },
});

/**
 * GET /stored/agents/:agentId/versions/compare - Compare two versions
 */
export const COMPARE_AGENT_VERSIONS_ROUTE: ServerRoute<
  InferParams<typeof agentVersionPathParams, typeof compareVersionsQuerySchema, undefined>,
  z.infer<typeof compareVersionsResponseSchema>,
  'json',
  RouteSchemas<
    typeof agentVersionPathParams,
    typeof compareVersionsQuerySchema,
    undefined,
    typeof compareVersionsResponseSchema
  >,
  'GET',
  '/stored/agents/:agentId/versions/compare'
> = createRoute({
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
  handler: async ({ mastra, agentId, from, to, requestContext }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const agentsStore = await storage.getStore('agents');
      if (!agentsStore) {
        throw new HTTPException(500, { message: 'Agents storage domain is not available' });
      }
      const agent = await agentsStore.getById(agentId);
      assertStoredResourceScope(agent, await getStoredResourceScope(mastra, requestContext));

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
