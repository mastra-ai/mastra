import writeChangeset from '@changesets/write';
import { rootDir } from '../config.js';
import type { VersionBumps } from './getChangesetMessage.js';

export async function createCustomChangeset(versionBumps: VersionBumps, message: string): Promise<string> {
  const changeset = await writeChangeset(
    {
      releases: Object.entries(versionBumps).map(([pkg, bump]) => ({
        name: pkg,
        type: bump,
      })),
      summary: message,
    },
    rootDir,
    {
      prettier: true,
    },
  );

  return changeset;
}
