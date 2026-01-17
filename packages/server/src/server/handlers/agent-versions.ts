import { deepEqual } from '@mastra/core/utils';

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
