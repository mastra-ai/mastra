import type { StorageWorkspaceSnapshotType } from '@mastra/core/storage';

/**
 * Compare a resolved workspace's config fields against a runtime snapshot.
 * Returns true if all snapshot config fields match.
 *
 * @internal — not part of the public API surface.
 */
export function snapshotsMatch(
  stored: { name: string } & Partial<StorageWorkspaceSnapshotType>,
  runtime: StorageWorkspaceSnapshotType,
): boolean {
  const keys: (keyof StorageWorkspaceSnapshotType)[] = [
    'name',
    'description',
    'filesystem',
    'sandbox',
    'mounts',
    'search',
    'skills',
    'tools',
    'autoSync',
    'operationTimeout',
  ];

  // JSON replacer that strips falsy leaf values (false, null, 0) so DB-hydrated
  // defaults don't cause spurious mismatches against runtime snapshots.
  const replacer = (_k: string, v: unknown) => (v === false || v === null || v === 0 ? undefined : v);

  for (const key of keys) {
    const storedVal = stored[key];
    const runtimeVal = runtime[key];

    const storedJSON = storedVal == null || storedVal === false ? undefined : JSON.stringify(storedVal, replacer);
    const runtimeJSON = runtimeVal == null || runtimeVal === false ? undefined : JSON.stringify(runtimeVal, replacer);

    if (storedJSON !== runtimeJSON) return false;
  }

  return true;
}
