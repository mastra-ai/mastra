import { deepEqual } from '@mastra/core/utils';
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

// Default maximum versions per agent (can be made configurable in the future)
export const DEFAULT_MAX_VERSIONS_PER_AGENT = 50;

// ============================================================================
// Helper Functions (exported for use in stored-agents.ts)
// ============================================================================

/**
 * Generates a unique ID for a version using crypto.randomUUID()
 */
export function generateVersionId(): string {
  return crypto.randomUUID();
}

/**
 * Compares two agent snapshots and returns an array of field names that changed.
 * Performs deep comparison for nested objects.
 */
export function calculateChangedFields(
  previous: Record<string, unknown> | null | undefined,
  current: Record<string, unknown>,
): string[] {
  if (!previous) {
    // If no previous version, all fields are "changed" (new)
    return Object.keys(current);
  }

  const changedFields: string[] = [];
  const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)]);

  for (const key of allKeys) {
    // Skip metadata fields that change on every save
    if (key === 'updatedAt' || key === 'createdAt') {
      continue;
    }

    const prevValue = previous[key];
    const currValue = current[key];

    if (!deepEqual(prevValue, currValue)) {
      changedFields.push(key);
    }
  }

  return changedFields;
}

/**
 * Computes detailed diffs between two agent snapshots.
 */
function computeVersionDiffs(
  fromSnapshot: Record<string, unknown>,
  toSnapshot: Record<string, unknown>,
): Array<{ field: string; previousValue: unknown; currentValue: unknown }> {
  const diffs: Array<{ field: string; previousValue: unknown; currentValue: unknown }> = [];
  const allKeys = new Set([...Object.keys(fromSnapshot), ...Object.keys(toSnapshot)]);

  for (const key of allKeys) {
    // Skip metadata fields
    if (key === 'updatedAt' || key === 'createdAt') {
      continue;
    }

    const prevValue = fromSnapshot[key];
    const currValue = toSnapshot[key];

    if (!deepEqual(prevValue, currValue)) {
      diffs.push({
        field: key,
        previousValue: prevValue,
        currentValue: currValue,
      });
    }
  }

  return diffs;
}

/**
 * Enforces version retention limit by deleting oldest versions that exceed the maximum.
 * Never deletes the active version.
 *
 * @param agentsStore - The agents storage domain
 * @param agentId - The agent ID to enforce retention for
 * @param activeVersionId - The active version ID (will never be deleted)
 * @param maxVersions - Maximum number of versions to keep (default: 50)
 */
export async function enforceRetentionLimit(
  agentsStore: {
    listVersions: (params: {
      agentId: string;
      page?: number;
      perPage?: number | false;
      orderBy?: { field?: 'versionNumber' | 'createdAt'; direction?: 'ASC' | 'DESC' };
    }) => Promise<{
      versions: Array<{ id: string; versionNumber: number }>;
      total: number;
    }>;
    deleteVersion: (id: string) => Promise<void>;
  },
  agentId: string,
  activeVersionId: string | undefined | null,
  maxVersions: number = DEFAULT_MAX_VERSIONS_PER_AGENT,
): Promise<{ deletedCount: number }> {
  // Get total version count
  const { total } = await agentsStore.listVersions({ agentId, perPage: 1 });

  if (total <= maxVersions) {
    return { deletedCount: 0 };
  }

  const versionsToDelete = total - maxVersions;

  // Get the oldest versions (ordered by versionNumber ascending)
  const { versions: oldestVersions } = await agentsStore.listVersions({
    agentId,
    perPage: versionsToDelete + 1, // Get one extra in case we need to skip the active version
    orderBy: { field: 'versionNumber', direction: 'ASC' },
  });

  let deletedCount = 0;
  for (const version of oldestVersions) {
    if (deletedCount >= versionsToDelete) {
      break;
    }

    // Never delete the active version
    if (version.id === activeVersionId) {
      continue;
    }

    await agentsStore.deleteVersion(version.id);
    deletedCount++;
  }

  return { deletedCount };
}

/**
 * Determines if an error is a unique constraint violation on versionNumber.
 * This is used to detect race conditions when creating versions concurrently.
 */
function isVersionNumberConflictError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Check for common unique constraint violation patterns across databases
    return (
      (message.includes('unique') && message.includes('constraint')) ||
      message.includes('duplicate key') ||
      message.includes('unique_violation') ||
      message.includes('sqlite_constraint_unique') ||
      message.includes('versionnumber')
    );
  }
  return false;
}

/**
 * Type for the agents store with version-related methods.
 * Uses generic types to work with any StorageAgentType-compatible structure.
 */
export interface AgentsStoreWithVersions<TAgent = any> {
  getLatestVersion: (agentId: string) => Promise<{ id: string; versionNumber: number; snapshot: TAgent } | null>;
  createVersion: (params: {
    id: string;
    agentId: string;
    versionNumber: number;
    name?: string;
    snapshot: TAgent;
    changedFields?: string[];
    changeMessage?: string;
  }) => Promise<{ id: string; versionNumber: number }>;
  updateAgent: (params: { id: string; activeVersionId?: string; [key: string]: any }) => Promise<TAgent>;
  listVersions: (params: {
    agentId: string;
    page?: number;
    perPage?: number | false;
    orderBy?: { field?: 'versionNumber' | 'createdAt'; direction?: 'ASC' | 'DESC' };
  }) => Promise<{
    versions: Array<{ id: string; versionNumber: number }>;
    total: number;
  }>;
  deleteVersion: (id: string) => Promise<void>;
}

/**
 * Creates a new version with retry logic for race condition handling.
 * If a unique constraint violation occurs on versionNumber, retries with a fresh versionNumber.
 *
 * @param agentsStore - The agents storage domain
 * @param agentId - The agent ID to create a version for
 * @param snapshot - The agent configuration snapshot
 * @param changedFields - Array of field names that changed
 * @param options - Optional settings for the version
 * @param options.name - Optional vanity name for the version
 * @param options.changeMessage - Optional description of the changes
 * @param options.maxRetries - Maximum number of retry attempts (default: 3)
 * @returns The created version ID and version number
 */
export async function createVersionWithRetry<TAgent>(
  agentsStore: AgentsStoreWithVersions<TAgent>,
  agentId: string,
  snapshot: TAgent,
  changedFields: string[],
  options: {
    name?: string;
    changeMessage?: string;
    maxRetries?: number;
  } = {},
): Promise<{ versionId: string; versionNumber: number }> {
  const { name, changeMessage, maxRetries = 3 } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Get the latest version number (fresh on each attempt)
      const latestVersion = await agentsStore.getLatestVersion(agentId);
      const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

      // Generate a unique version ID
      const versionId = generateVersionId();

      // Create the version
      await agentsStore.createVersion({
        id: versionId,
        agentId,
        versionNumber,
        name,
        snapshot,
        changedFields,
        changeMessage,
      });

      return { versionId, versionNumber };
    } catch (error) {
      lastError = error;

      // If it's a unique constraint violation, retry with a fresh versionNumber
      if (isVersionNumberConflictError(error) && attempt < maxRetries - 1) {
        // Small delay before retry to reduce contention
        await new Promise(resolve => setTimeout(resolve, 10 * (attempt + 1)));
        continue;
      }

      // For other errors or last attempt, rethrow
      throw error;
    }
  }

  // Should not reach here, but just in case
  throw lastError;
}

/**
 * Handles auto-versioning after an agent update.
 * Creates a new version with retry logic, then updates the agent's activeVersionId,
 * and finally enforces the retention limit. These are separate operations - if updateAgent
 * fails after version creation, a created-but-not-activated version may remain.
 *
 * @param agentsStore - The agents storage domain
 * @param agentId - The agent ID
 * @param existingAgent - The agent state before the update
 * @param updatedAgent - The agent state after the update
 * @returns The updated agent with the new activeVersionId, or the original if no changes
 */
export async function handleAutoVersioning<TAgent>(
  agentsStore: AgentsStoreWithVersions<TAgent>,
  agentId: string,
  existingAgent: TAgent,
  updatedAgent: TAgent,
): Promise<{ agent: TAgent; versionCreated: boolean }> {
  // Calculate what fields changed
  const changedFields = calculateChangedFields(
    existingAgent as unknown as Record<string, unknown>,
    updatedAgent as unknown as Record<string, unknown>,
  );

  // Only create version if there are actual changes (excluding metadata timestamps)
  if (changedFields.length === 0) {
    return { agent: updatedAgent, versionCreated: false };
  }

  // Create version with retry logic for race conditions
  const { versionId } = await createVersionWithRetry(agentsStore, agentId, updatedAgent, changedFields, {
    changeMessage: 'Auto-saved after edit',
  });

  // Update the agent's activeVersionId
  const finalAgent = await agentsStore.updateAgent({
    id: agentId,
    activeVersionId: versionId,
  });

  // Enforce retention limit
  await enforceRetentionLimit(agentsStore, agentId, versionId);

  return { agent: finalAgent, versionCreated: true };
}

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * GET /api/stored/agents/:agentId/versions - List all versions for an agent
 */
export const LIST_AGENT_VERSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/stored/agents/:agentId/versions',
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
      const agent = await agentsStore.getAgentById({ id: agentId });
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
 * POST /api/stored/agents/:agentId/versions - Create a new version snapshot
 */
export const CREATE_AGENT_VERSION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/stored/agents/:agentId/versions',
  responseType: 'json',
  pathParamSchema: agentVersionPathParams,
  bodySchema: createVersionBodySchema,
  responseSchema: createVersionResponseSchema,
  summary: 'Create agent version',
  description: 'Creates a new version snapshot of the current agent configuration',
  tags: ['Agent Versions'],
  handler: async ({ mastra, agentId, name, changeMessage }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const agentsStore = await storage.getStore('agents');
      if (!agentsStore) {
        throw new HTTPException(500, { message: 'Agents storage domain is not available' });
      }

      // Get the current agent configuration
      const agent = await agentsStore.getAgentById({ id: agentId });
      if (!agent) {
        throw new HTTPException(404, { message: `Agent with id ${agentId} not found` });
      }

      // Get the latest version to calculate changed fields
      const latestVersion = await agentsStore.getLatestVersion(agentId);
      const changedFields = calculateChangedFields(
        latestVersion?.snapshot as Record<string, unknown> | undefined,
        agent as unknown as Record<string, unknown>,
      );

      // Create the new version with retry logic to handle race conditions
      const { versionId } = await createVersionWithRetry(
        agentsStore,
        agentId,
        agent,
        changedFields.length > 0 ? changedFields : [],
        { name, changeMessage },
      );

      // Get the created version to return
      const version = await agentsStore.getVersion(versionId);
      if (!version) {
        throw new HTTPException(500, { message: 'Failed to retrieve created version' });
      }

      // Enforce retention limit - delete oldest versions if we exceed the max
      await enforceRetentionLimit(agentsStore, agentId, agent.activeVersionId);

      return version;
    } catch (error) {
      return handleError(error, 'Error creating agent version');
    }
  },
});

/**
 * GET /api/stored/agents/:agentId/versions/:versionId - Get a specific version
 */
export const GET_AGENT_VERSION_ROUTE = createRoute({
  method: 'GET',
  path: '/api/stored/agents/:agentId/versions/:versionId',
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
 * POST /api/stored/agents/:agentId/versions/:versionId/activate - Set a version as active
 */
export const ACTIVATE_AGENT_VERSION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/stored/agents/:agentId/versions/:versionId/activate',
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
      const agent = await agentsStore.getAgentById({ id: agentId });
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

      // Update the agent's activeVersionId
      await agentsStore.updateAgent({
        id: agentId,
        activeVersionId: versionId,
      });

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
 * POST /api/stored/agents/:agentId/versions/:versionId/restore - Restore agent to a version
 */
export const RESTORE_AGENT_VERSION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/stored/agents/:agentId/versions/:versionId/restore',
  responseType: 'json',
  pathParamSchema: versionIdPathParams,
  responseSchema: restoreVersionResponseSchema,
  summary: 'Restore agent version',
  description: 'Restores the agent configuration from a version snapshot, creating a new version',
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
      const agent = await agentsStore.getAgentById({ id: agentId });
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

      // Update the agent with the snapshot from the version to restore
      // Exclude id, createdAt, updatedAt, and activeVersionId from the snapshot
      // (activeVersionId from old snapshot may reference a stale/deleted version)
      const {
        id: _id,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        activeVersionId: _activeVersionId,
        ...snapshotData
      } = versionToRestore.snapshot;
      await agentsStore.updateAgent({
        id: agentId,
        ...snapshotData,
      });

      // Get the updated agent
      const updatedAgent = await agentsStore.getAgentById({ id: agentId });
      if (!updatedAgent) {
        throw new HTTPException(500, { message: 'Failed to retrieve updated agent' });
      }

      // Get the latest version to calculate changed fields
      const latestVersion = await agentsStore.getLatestVersion(agentId);
      const changedFields = calculateChangedFields(
        latestVersion?.snapshot as Record<string, unknown> | undefined,
        updatedAgent as unknown as Record<string, unknown>,
      );

      // Create a new version with retry logic to handle race conditions
      const { versionId: newVersionId } = await createVersionWithRetry(
        agentsStore,
        agentId,
        updatedAgent,
        changedFields,
        {
          changeMessage: `Restored from version ${versionToRestore.versionNumber}${versionToRestore.name ? ` (${versionToRestore.name})` : ''}`,
        },
      );

      // Update the agent's activeVersionId to the new version
      await agentsStore.updateAgent({
        id: agentId,
        activeVersionId: newVersionId,
      });

      // Get the created version to return
      const newVersion = await agentsStore.getVersion(newVersionId);
      if (!newVersion) {
        throw new HTTPException(500, { message: 'Failed to retrieve created version' });
      }

      // Enforce retention limit - delete oldest versions if we exceed the max
      // Use the new version ID as the active version
      await enforceRetentionLimit(agentsStore, agentId, newVersionId);

      return newVersion;
    } catch (error) {
      return handleError(error, 'Error restoring agent version');
    }
  },
});

/**
 * DELETE /api/stored/agents/:agentId/versions/:versionId - Delete a version
 */
export const DELETE_AGENT_VERSION_ROUTE = createRoute({
  method: 'DELETE',
  path: '/api/stored/agents/:agentId/versions/:versionId',
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
      const agent = await agentsStore.getAgentById({ id: agentId });
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
 * GET /api/stored/agents/:agentId/versions/compare - Compare two versions
 */
export const COMPARE_AGENT_VERSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/stored/agents/:agentId/versions/compare',
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

      // Compute diffs
      const diffs = computeVersionDiffs(
        fromVersion.snapshot as unknown as Record<string, unknown>,
        toVersion.snapshot as unknown as Record<string, unknown>,
      );

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
