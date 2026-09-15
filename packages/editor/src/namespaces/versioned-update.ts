import { deepEqual } from '@mastra/core/utils';

type VersionRecord = {
  id: string;
  versionNumber: number;
};

export type VersionedUpdateStore<TVersion extends VersionRecord, TCreateVersionInput> = {
  getLatestVersion(parentId: string): Promise<TVersion | null>;
  createVersion(input: TCreateVersionInput): Promise<TVersion>;
};

export function getProvidedSnapshotFields<TSnapshot extends object>(
  input: Record<string, unknown>,
  snapshotFields: readonly (keyof TSnapshot & string)[],
): Partial<TSnapshot> {
  const config: Partial<TSnapshot> = {};

  for (const field of snapshotFields) {
    if (input[field] !== undefined) {
      (config as Record<string, unknown>)[field] = input[field];
    }
  }

  return config;
}

export function extractSnapshotConfig<TSnapshot extends object>(
  version: unknown,
  snapshotFields: readonly (keyof TSnapshot & string)[],
): Partial<TSnapshot> {
  const record = version as Record<string, unknown>;
  const config: Partial<TSnapshot> = {};

  for (const field of snapshotFields) {
    if (field in record) {
      (config as Record<string, unknown>)[field] = record[field];
    }
  }

  return config;
}

function getChangedSnapshotFields<TSnapshot extends object>(
  previousConfig: Partial<TSnapshot>,
  providedConfig: Partial<TSnapshot>,
  snapshotFields: readonly (keyof TSnapshot & string)[],
): string[] {
  return snapshotFields.filter(
    field => field in providedConfig && !deepEqual(previousConfig[field], providedConfig[field]),
  );
}

function isVersionNumberConflictError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    (message.includes('unique') && message.includes('constraint')) ||
    message.includes('duplicate key') ||
    message.includes('unique_violation') ||
    message.includes('sqlite_constraint_unique') ||
    (message.includes('version number') && message.includes('already exists')) ||
    message.includes('versionnumber')
  );
}

export async function createVersionFromSnapshotUpdate<
  TVersion extends VersionRecord,
  TCreateVersionInput,
  TSnapshot extends object,
>({
  store,
  parentId,
  parentIdField,
  snapshotFields,
  providedConfig,
  changeMessage = 'Auto-saved after edit',
  maxRetries = 3,
}: {
  store: VersionedUpdateStore<TVersion, TCreateVersionInput>;
  parentId: string;
  parentIdField: string;
  snapshotFields: readonly (keyof TSnapshot & string)[];
  providedConfig: Partial<TSnapshot>;
  changeMessage?: string;
  maxRetries?: number;
}): Promise<{ versionCreated: false } | { versionCreated: true; version: TVersion; changedFields: string[] }> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const latestVersion = await store.getLatestVersion(parentId);
      if (!latestVersion) {
        return { versionCreated: false };
      }

      const previousConfig = extractSnapshotConfig<TSnapshot>(latestVersion, snapshotFields);
      const changedFields = getChangedSnapshotFields(previousConfig, providedConfig, snapshotFields);
      if (changedFields.length === 0) {
        return { versionCreated: false };
      }

      const nextConfig: Record<string, unknown> = { ...previousConfig };
      for (const [field, value] of Object.entries(providedConfig)) {
        nextConfig[field] = value === null ? undefined : value;
      }

      const version = await store.createVersion({
        ...nextConfig,
        id: crypto.randomUUID(),
        [parentIdField]: parentId,
        versionNumber: latestVersion.versionNumber + 1,
        changedFields,
        changeMessage,
      } as TCreateVersionInput);

      return { versionCreated: true, version, changedFields };
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
