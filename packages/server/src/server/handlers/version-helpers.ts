/**
 * Generic version management helpers shared across all versioned editor primitives.
 * These utilities are domain-agnostic and work with any VersionedStorageDomain.
 */

// Default maximum versions per entity (can be made configurable in the future)
export const DEFAULT_MAX_VERSIONS = 50;

/** Snapshot config fields for MCP client versioning. */
export const MCP_CLIENT_SNAPSHOT_CONFIG_FIELDS = ['name', 'description', 'servers'] as const;

/**
 * Deep equality comparison for comparing two values.
 * Handles primitives, arrays, objects, and Date instances.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    if (aKeys.length !== bKeys.length) return false;
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
 * Extracts snapshot config fields from a version record.
 * Strips version-metadata fields (id, FK field, versionNumber, changedFields, changeMessage, createdAt).
 */
export function extractConfigFromVersion(
  version: Record<string, unknown>,
  snapshotConfigFields: readonly string[],
): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const field of snapshotConfigFields) {
    if (field in version) {
      config[field] = version[field];
    }
  }
  return config;
}

/**
 * Compares two snapshots and returns an array of field names that changed.
 */
export function calculateChangedFields(
  previous: Record<string, unknown> | null | undefined,
  current: Record<string, unknown>,
): string[] {
  if (!previous) {
    return Object.keys(current);
  }

  const changedFields: string[] = [];
  const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)]);

  for (const key of allKeys) {
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
 * Computes detailed diffs between two config snapshots.
 */
export function computeVersionDiffs(
  fromConfig: Record<string, unknown>,
  toConfig: Record<string, unknown>,
): Array<{ field: string; previousValue: unknown; currentValue: unknown }> {
  const diffs: Array<{ field: string; previousValue: unknown; currentValue: unknown }> = [];
  const allKeys = new Set([...Object.keys(fromConfig), ...Object.keys(toConfig)]);

  for (const key of allKeys) {
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
 * Generic store interface for version management operations.
 * Works with any versioned storage domain.
 */
export interface VersionedStoreInterface<TEntity = unknown> {
  getLatestVersion: (parentId: string) => Promise<{ id: string; versionNumber: number } | null>;
  getVersion: (id: string) => Promise<{ id: string; versionNumber: number } | null>;
  createVersion: (params: Record<string, unknown>) => Promise<unknown>;
  update: (params: Record<string, unknown>) => Promise<TEntity>;
  listVersions: (params: Record<string, unknown>) => Promise<{
    versions: Array<{ id: string; versionNumber: number }>;
    total: number;
    page: number;
    perPage: number | false;
    hasMore: boolean;
  }>;
  deleteVersion: (id: string) => Promise<void>;
}

/**
 * Determines if an error is a unique constraint violation on versionNumber.
 */
function isVersionNumberConflictError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
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
 * Enforces version retention limit by deleting oldest versions that exceed the maximum.
 * Never deletes the active version.
 */
export async function enforceRetentionLimit(
  store: Pick<VersionedStoreInterface, 'listVersions' | 'deleteVersion'>,
  parentId: string,
  parentIdField: string,
  activeVersionId: string | undefined | null,
  maxVersions: number = DEFAULT_MAX_VERSIONS,
): Promise<{ deletedCount: number }> {
  const { total } = await store.listVersions({ [parentIdField]: parentId, perPage: 1 });

  if (total <= maxVersions) {
    return { deletedCount: 0 };
  }

  const versionsToDelete = total - maxVersions;

  const { versions: oldestVersions } = await store.listVersions({
    [parentIdField]: parentId,
    perPage: versionsToDelete + 1,
    orderBy: { field: 'versionNumber', direction: 'ASC' },
  });

  let deletedCount = 0;
  for (const version of oldestVersions) {
    if (deletedCount >= versionsToDelete) {
      break;
    }

    if (version.id === activeVersionId) {
      continue;
    }

    await store.deleteVersion(version.id);
    deletedCount++;
  }

  return { deletedCount };
}

/**
 * Creates a new version with retry logic for race condition handling.
 */
export async function createVersionWithRetry(
  store: Pick<VersionedStoreInterface, 'getLatestVersion' | 'createVersion'>,
  parentId: string,
  parentIdField: string,
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
      const latestVersion = await store.getLatestVersion(parentId);
      const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;
      const versionId = generateVersionId();

      await store.createVersion({
        ...snapshotConfig,
        id: versionId,
        [parentIdField]: parentId,
        versionNumber,
        changedFields,
        changeMessage,
      });

      return { versionId, versionNumber };
    } catch (error) {
      lastError = error;

      if (isVersionNumberConflictError(error) && attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 10 * (attempt + 1)));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

/**
 * Handles auto-versioning after an entity update.
 * Creates a new version if config fields changed, but does NOT update activeVersionId.
 */
export async function handleAutoVersioning<TEntity>(
  store: VersionedStoreInterface<TEntity>,
  parentId: string,
  parentIdField: string,
  snapshotConfigFields: readonly string[],
  existingEntity: TEntity & { activeVersionId?: string },
  updatedEntity: TEntity,
  configFields?: Record<string, unknown>,
): Promise<{ entity: TEntity; versionCreated: boolean }> {
  if (!configFields || Object.keys(configFields).length === 0) {
    return { entity: updatedEntity, versionCreated: false };
  }

  // Always compare against the latest version (not the active/published one).
  // This ensures each draft save is diffed against the last edit, so intermediate
  // draft changes are never silently reverted to the published baseline.
  const versionToCompare = await store.getLatestVersion(parentId);

  const previousConfig = versionToCompare
    ? extractConfigFromVersion(versionToCompare as unknown as Record<string, unknown>, snapshotConfigFields)
    : null;

  const changedFields = calculateChangedFields(previousConfig, configFields);

  if (changedFields.length === 0) {
    return { entity: updatedEntity, versionCreated: false };
  }

  const fullConfig: Record<string, unknown> = previousConfig ? { ...previousConfig } : {};
  for (const [key, value] of Object.entries(configFields)) {
    fullConfig[key] = value === null ? undefined : value;
  }

  const { versionId } = await createVersionWithRetry(store, parentId, parentIdField, fullConfig, changedFields, {
    changeMessage: 'Auto-saved after edit',
  });

  // Do NOT update activeVersionId here — the new version stays as a draft.
  // activeVersionId is only updated when the user explicitly publishes/activates a version.

  const activeVersionId = existingEntity.activeVersionId || versionId;
  await enforceRetentionLimit(store, parentId, parentIdField, activeVersionId);

  return { entity: updatedEntity, versionCreated: true };
}
