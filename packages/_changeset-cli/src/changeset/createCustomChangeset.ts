import writeChangeset from '@changesets/write';
import { rootDir } from '../config.js';
import type { VersionBumps, BumpType } from '../types.js';

interface ChangesetRelease {
  name: string;
  type: BumpType;
}

function createReleases(versionBumps: VersionBumps): ChangesetRelease[] {
  return Object.entries(versionBumps).map(([pkg, bump]) => ({
    name: pkg,
    type: bump,
  }));
}

export async function createCustomChangeset(versionBumps: VersionBumps, message: string): Promise<string> {
  if (!message || message.trim().length === 0) {
    throw new Error('Changeset message cannot be empty');
  }

  if (Object.keys(versionBumps).length === 0) {
    throw new Error('No version bumps provided');
  }

  try {
    const releases = createReleases(versionBumps);

    const changesetId = await writeChangeset(
      {
        releases,
        summary: message.trim(),
      },
      rootDir,
      {
        prettier: true,
      },
    );

    return changesetId;
  } catch (error) {
    throw new Error('Failed to write changeset file', { cause: error });
  }
}
