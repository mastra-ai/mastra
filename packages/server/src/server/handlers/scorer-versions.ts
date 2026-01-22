import type { StoredScorerType } from '@mastra/core/storage';
import type { StoredScorersStorage } from '@mastra/core/storage/domains/stored-scorers';
import { deepEqual } from '@mastra/core/utils';

// Default maximum versions per scorer (can be made configurable in the future)
export const DEFAULT_MAX_VERSIONS_PER_SCORER = 50;

// ============================================================================
// Helper Functions (exported for use in stored-scorers.ts)
// ============================================================================

/**
 * Generates a unique ID for a version using crypto.randomUUID()
 */
export function generateVersionId(): string {
  return crypto.randomUUID();
}

/**
 * Compares two scorer snapshots and returns an array of field names that changed.
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
 * Checks if an error is a version number conflict error.
 * This happens when two concurrent requests try to create versions with the same versionNumber.
 */
function isVersionNumberConflictError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Check for common unique constraint violation patterns
    return (
      message.includes('unique constraint') ||
      message.includes('duplicate') ||
      message.includes('already exists') ||
      (message.includes('version') && message.includes('conflict'))
    );
  }
  return false;
}

/**
 * Enforces version retention limit by deleting oldest versions that exceed the maximum.
 * Never deletes the active version.
 *
 * @param scorersStore - The scorers storage domain
 * @param scorerId - The scorer ID to enforce retention for
 * @param activeVersionId - The active version ID (will never be deleted)
 * @param maxVersions - Maximum number of versions to keep (default: 50)
 */
export async function enforceRetentionLimit(
  scorersStore: StoredScorersStorage,
  scorerId: string,
  activeVersionId: string | undefined | null,
  maxVersions: number = DEFAULT_MAX_VERSIONS_PER_SCORER,
): Promise<{ deletedCount: number }> {
  // Get all versions sorted by versionNumber ascending
  const result = await scorersStore.listScorerVersions({
    scorerId,
    perPage: false, // Get all versions
    orderBy: { field: 'versionNumber', direction: 'ASC' },
  });

  if (result.total <= maxVersions) {
    return { deletedCount: 0 };
  }

  const versionsToDelete = result.total - maxVersions;

  let deletedCount = 0;
  for (const version of result.versions) {
    if (deletedCount >= versionsToDelete) {
      break;
    }

    // Never delete the active version
    if (version.id === activeVersionId) {
      continue;
    }

    await scorersStore.deleteScorerVersion(version.id);
    deletedCount++;
  }

  return { deletedCount };
}

/**
 * Creates a new scorer version with retry logic to handle race conditions.
 * Retries up to maxRetries times if there's a version number conflict.
 *
 * @param scorersStore - The scorers storage domain
 * @param scorerId - The scorer ID
 * @param snapshot - The scorer snapshot to save
 * @param changedFields - Array of field names that changed
 * @param options - Optional name, changeMessage, and maxRetries
 * @returns The created version ID and version number
 */
export async function createVersionWithRetry(
  scorersStore: StoredScorersStorage,
  scorerId: string,
  snapshot: StoredScorerType,
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
      const latestVersion = await scorersStore.getLatestScorerVersion(scorerId);
      const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

      // Generate a unique version ID
      const versionId = generateVersionId();

      // Create the version
      await scorersStore.createScorerVersion({
        id: versionId,
        scorerId,
        versionNumber,
        name,
        snapshot: snapshot as unknown as Record<string, unknown>,
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
 * Handles auto-versioning after a scorer update.
 * Creates a new version with retry logic, then updates the scorer's activeVersionId,
 * and finally enforces the retention limit. These are separate operations - if updateScorer
 * fails after version creation, a created-but-not-activated version may remain.
 *
 * @param scorersStore - The scorers storage domain
 * @param scorerId - The scorer ID
 * @param existingScorer - The scorer before the update
 * @param updatedScorer - The scorer after the update
 * @returns The final scorer with updated activeVersionId and a flag indicating if a version was created
 */
export async function handleScorerAutoVersioning(
  scorersStore: StoredScorersStorage,
  scorerId: string,
  existingScorer: StoredScorerType,
  updatedScorer: StoredScorerType,
): Promise<{ scorer: StoredScorerType; versionCreated: boolean }> {
  // Calculate what fields changed
  const changedFields = calculateChangedFields(
    existingScorer as unknown as Record<string, unknown>,
    updatedScorer as unknown as Record<string, unknown>,
  );

  // Only create version if there are actual changes (excluding metadata timestamps)
  if (changedFields.length === 0) {
    return { scorer: updatedScorer, versionCreated: false };
  }

  // Create version with retry logic for race conditions
  const { versionId } = await createVersionWithRetry(scorersStore, scorerId, updatedScorer, changedFields, {
    changeMessage: 'Auto-saved after edit',
  });

  // Update the scorer's activeVersionId
  const finalScorer = await scorersStore.updateScorer({
    id: scorerId,
    activeVersionId: versionId,
  });

  // Enforce retention limit
  await enforceRetentionLimit(scorersStore, scorerId, versionId);

  return { scorer: finalScorer, versionCreated: true };
}
