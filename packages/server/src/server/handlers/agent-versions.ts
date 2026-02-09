import type { StorageAgentSnapshotType } from '@mastra/core/storage';
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
] as const;

// ============================================================================
// Helper Functions (exported for use in stored-agents.ts)
// ============================================================================

/**
 * Deep equality comparison for comparing two values.
 * Handles primitives, arrays, objects, and Date instances.
 * TODO: Move to a shared utils package that gets bundled into each package
 */
function deepEqual(a: unknown, b: unknown): boolean {
  // Handle identical references and primitives
  if (a === b) return true;

  // Handle null/undefined
  if (a == null || b == null) return a === b;

  // Handle different types
  if (typeof a !== typeof b) return false;

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  // Handle dates (must check before generic objects since Date is also an object)
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // Handle objects (after Date check to avoid treating Dates as plain objects)
  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    if (aKeys.length !== bKeys.length) return false;

    // Verify that bObj has the same keys as aObj before comparing values
    return aKeys.every(key => Object.prototype.hasOwnProperty.call(bObj, key) && deepEqual(aObj[key], bObj[key]));
  }

  return false;
}

/**
 * Generates a unique ID for a version using crypto.randomUUID()
 */
export function generateVersionId(): string {
  return crypto.randomUUID();
}

/**
 * Extracts snapshot config fields from a version record (top-level fields).
 * Strips version-metadata fields (id, agentId, versionNumber, changedFields, changeMessage, createdAt).
 */
function extractConfigFromVersion(version: Record<string, unknown>): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const field of SNAPSHOT_CONFIG_FIELDS) {
    if (field in version) {
      config[field] = version[field];
    }
  }
  return config;
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
 * Computes detailed diffs between two agent config snapshots.
 */
function computeVersionDiffs(
  fromConfig: Record<string, unknown>,
  toConfig: Record<string, unknown>,
): Array<{ field: string; previousValue: unknown; currentValue: unknown }> {
  const diffs: Array<{ field: string; previousValue: unknown; currentValue: unknown }> = [];
  const allKeys = new Set([...Object.keys(fromConfig), ...Object.keys(toConfig)]);

  for (const key of allKeys) {
    // Skip metadata fields
    if (key === 'updatedAt' || key === 'createdAt') {
      continue;
    }

    const prevValue = fromConfig[key];
    const currValue = toConfig[key];

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
 *
 * AgentVersion config fields are top-level (no nested snapshot object).
 * getLatestVersion returns the version with config fields top-level.
 */
export interface AgentsStoreWithVersions<TAgent = any> {
  getLatestVersion: (agentId: string) => Promise<
    | (StorageAgentSnapshotType & {
        id: string;
        versionNumber: number;
        [key: string]: any;
      })
    | null
  >;
  getVersion: (id: string) => Promise<
    | (StorageAgentSnapshotType & {
        id: string;
        versionNumber: number;
        [key: string]: any;
      })
    | null
  >;
  createVersion: (
    params: StorageAgentSnapshotType & {
      id: string;
      agentId: string;
      versionNumber: number;
      changedFields?: string[];
      changeMessage?: string;
    },
  ) => Promise<{ id: string; versionNumber: number }>;
  updateAgent: (params: { id: string; activeVersionId?: string; [key: string]: any }) => Promise<TAgent>;
  listVersions: (params: {
    agentId: string;
    page?: number;
    perPage?: number | false;
    orderBy?: { field?: 'versionNumber' | 'createdAt'; direction?: 'ASC' | 'DESC' };
  }) => Promise<{
    versions: Array<{
      id: string;
      agentId: string;
      versionNumber: number;
      [key: string]: any;
    }>;
    total: number;
    page: number;
    perPage: number | false;
    hasMore: boolean;
  }>;
  deleteVersion: (id: string) => Promise<void>;
}

/**
 * Creates a new version with retry logic for race condition handling.
 * If a unique constraint violation occurs on versionNumber, retries with a fresh versionNumber.
 *
 * Config fields are passed top-level (not nested in a snapshot object).
 *
 * @param agentsStore - The agents storage domain
 * @param agentId - The agent ID to create a version for
 * @param snapshotConfig - The agent configuration fields (StorageAgentSnapshotType)
 * @param changedFields - Array of field names that changed
 * @param options - Optional settings for the version
 * @param options.changeMessage - Optional description of the changes
 * @param options.maxRetries - Maximum number of retry attempts (default: 3)
 * @returns The created version ID and version number
 */
export async function createVersionWithRetry<TAgent>(
  agentsStore: AgentsStoreWithVersions<TAgent>,
  agentId: string,
  snapshotConfig: Record<string, unknown>,
  changedFields: string[],
  options: {
    changeMessage?: string;
    maxRetries?: number;
  } = {},
): Promise<{ versionId: string; versionNumber: number }> {
  const { changeMessage, maxRetries = 3 } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Get the latest version number (fresh on each attempt)
      const latestVersion = await agentsStore.getLatestVersion(agentId);
      const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

      // Generate a unique version ID
      const versionId = generateVersionId();

      // Create the version with config fields top-level
      // snapshotConfig is guaranteed to contain name, instructions, model at runtime
      await agentsStore.createVersion({
        ...snapshotConfig,
        id: versionId,
        agentId,
        versionNumber,
        changedFields,
        changeMessage,
      } as Parameters<AgentsStoreWithVersions<TAgent>['createVersion']>[0]);

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
 * @param existingAgent - The agent state before the update (thin record)
 * @param updatedAgent - The agent state after the update (thin record)
 * @param configFields - The config fields that were provided in the update (StorageAgentSnapshotType fields)
 * @returns The updated agent with the new activeVersionId, or the original if no changes
 */
export async function handleAutoVersioning<TAgent>(
  agentsStore: AgentsStoreWithVersions<TAgent>,
  agentId: string,
  existingAgent: TAgent & { activeVersionId?: string },
  updatedAgent: TAgent,
  configFields?: Record<string, unknown>,
): Promise<{ agent: TAgent; versionCreated: boolean }> {
  // If no config fields were provided, no version change needed
  if (!configFields || Object.keys(configFields).length === 0) {
    return { agent: updatedAgent, versionCreated: false };
  }

  // Get the current active version to compare against
  // IMPORTANT: Use the version that activeVersionId points to, not the "latest" version
  // Otherwise we compare against newly created versions that aren't active yet
  const activeVersion = existingAgent.activeVersionId
    ? await agentsStore.getVersion(existingAgent.activeVersionId)
    : null;

  // Fall back to latest version if no active version is set
  const versionToCompare = activeVersion || (await agentsStore.getLatestVersion(agentId));

  const previousConfig = versionToCompare
    ? extractConfigFromVersion(versionToCompare as unknown as Record<string, unknown>)
    : null;

  // Calculate what config fields changed by comparing provided fields against previous version
  const changedFields = calculateChangedFields(previousConfig, configFields);

  // Only create version if there are actual config changes
  if (changedFields.length === 0) {
    return { agent: updatedAgent, versionCreated: false };
  }

  // Build the full snapshot config for the new version:
  // Start with the previous version's config and overlay the provided changes
  // Convert null values to undefined (null means "remove this field")
  const fullConfig: Record<string, unknown> = previousConfig ? { ...previousConfig } : {};
  for (const [key, value] of Object.entries(configFields)) {
    fullConfig[key] = value === null ? undefined : value;
  }

  // Create version with retry logic for race conditions
  const { versionId } = await createVersionWithRetry(agentsStore, agentId, fullConfig, changedFields, {
    changeMessage: 'Auto-saved after edit',
  });

  // Update the agent's activeVersionId to point to the new version
  await agentsStore.updateAgent({
    id: agentId,
    activeVersionId: versionId,
  });

  // Update the updatedAgent object with the new activeVersionId
  const agentWithNewVersion = {
    ...updatedAgent,
    activeVersionId: versionId,
  };

  // Enforce retention limit with the new activeVersionId
  await enforceRetentionLimit(agentsStore, agentId, versionId);

  return { agent: agentWithNewVersion, versionCreated: true };
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
 * POST /stored/agents/:agentId/versions - Create a new version snapshot
 */
export const CREATE_AGENT_VERSION_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/agents/:agentId/versions',
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
      const agent = await agentsStore.getAgentById({ id: agentId });
      if (!agent) {
        throw new HTTPException(404, { message: `Agent with id ${agentId} not found` });
      }

      // Get the current active version to snapshot its config
      let currentConfig: Record<string, unknown> = {};
      if (agent.activeVersionId) {
        const activeVersion = await agentsStore.getVersion(agent.activeVersionId);
        if (activeVersion) {
          currentConfig = extractConfigFromVersion(activeVersion as unknown as Record<string, unknown>);
        }
      }

      // Get the latest version to calculate changed fields
      const latestVersion = await agentsStore.getLatestVersion(agentId);
      const previousConfig = latestVersion
        ? extractConfigFromVersion(latestVersion as unknown as Record<string, unknown>)
        : null;

      const changedFields = calculateChangedFields(previousConfig, currentConfig);

      // Create the new version with retry logic to handle race conditions
      // Config fields are passed top-level
      const { versionId } = await createVersionWithRetry(
        agentsStore,
        agentId,
        currentConfig,
        changedFields.length > 0 ? changedFields : [],
        { changeMessage },
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
 * GET /stored/agents/:agentId/versions/:versionId - Get a specific version
 */
export const GET_AGENT_VERSION_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/agents/:agentId/versions/:versionId',
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

      // Update the agent's activeVersionId AND status to 'published'
      await agentsStore.updateAgent({
        id: agentId,
        activeVersionId: versionId,
        status: 'published',
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
 * POST /stored/agents/:agentId/versions/:versionId/restore - Restore agent to a version
 */
export const RESTORE_AGENT_VERSION_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/agents/:agentId/versions/:versionId/restore',
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

      // Extract the config fields from the version to restore (top-level, no .snapshot)
      const restoredConfig = extractConfigFromVersion(versionToRestore as unknown as Record<string, unknown>);

      // Update the agent with the config from the version to restore
      await agentsStore.updateAgent({
        id: agentId,
        ...restoredConfig,
      });

      // Get the latest version to calculate changed fields
      const latestVersion = await agentsStore.getLatestVersion(agentId);
      const previousConfig = latestVersion
        ? extractConfigFromVersion(latestVersion as unknown as Record<string, unknown>)
        : null;

      const changedFields = calculateChangedFields(previousConfig, restoredConfig);

      // Create a new version with retry logic to handle race conditions
      // Config fields are passed top-level
      const { versionId: newVersionId } = await createVersionWithRetry(
        agentsStore,
        agentId,
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
      await enforceRetentionLimit(agentsStore, agentId, agent.activeVersionId);

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
 * GET /stored/agents/:agentId/versions/compare - Compare two versions
 */
export const COMPARE_AGENT_VERSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/agents/:agentId/versions/compare',
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
      const fromConfig = extractConfigFromVersion(fromVersion as unknown as Record<string, unknown>);
      const toConfig = extractConfigFromVersion(toVersion as unknown as Record<string, unknown>);

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
