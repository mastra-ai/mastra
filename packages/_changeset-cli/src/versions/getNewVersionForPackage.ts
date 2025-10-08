import assembleReleasePlan from '@changesets/assemble-release-plan';
import { read as readConfig } from '@changesets/config';
import getChangesets from '@changesets/read';
import type { NewChangeset } from '@changesets/types';
import { getPackages } from '@manypkg/get-packages';
import { PnpmTool } from '@manypkg/tools';
import { rootDir } from '../config.js';

interface VersionInfo {
  type: string;
  oldVersion: string;
  newVersion: string;
  changesets: string[];
}

// Get the release plan which calculates all new versions
export async function getReleasePlan(changesets?: NewChangeset[]) {
  try {
    const packages = await getPackages(rootDir, {
      tools: [PnpmTool],
    });
    changesets = changesets || (await getChangesets(rootDir));
    const config = await readConfig(rootDir);

    const releasePlan = assembleReleasePlan(
      changesets,
      {
        ...packages,
        root: packages.rootPackage!,
      } as any,
      config,
      undefined,
    );
    return releasePlan;
  } catch (error) {
    console.error('Error assembling release plan:', error);
    return null;
  }
}

// Get the new version for a specific package using the release plan
export async function getNewVersionForPackage(
  packageName: string,
  changesets?: NewChangeset[],
): Promise<string | null> {
  try {
    const releasePlan = await getReleasePlan(changesets);
    if (!releasePlan) {
      return null;
    }

    // Find the package in the release plan
    const packageRelease = releasePlan.releases.find(release => release.name === packageName);

    if (packageRelease) {
      return packageRelease.newVersion;
    }

    // If not in release plan, get current version
    const { packages } = await getPackages(rootDir);
    const pkg = packages.find(p => p.packageJson.name === packageName);

    return pkg ? pkg.packageJson.version : null;
  } catch (error: any) {
    console.error(`Error calculating new version for ${packageName}:`, error.message);
    return null;
  }
}

// Get all new versions from the release plan
export async function getAllNewVersions(): Promise<Record<string, VersionInfo>> {
  try {
    const releasePlan = await getReleasePlan();

    if (!releasePlan) {
      return {};
    }

    const versions: Record<string, VersionInfo> = {};
    for (const release of releasePlan.releases) {
      versions[release.name] = {
        type: release.type,
        oldVersion: release.oldVersion,
        newVersion: release.newVersion,
        changesets: release.changesets,
      };
    }

    return versions;
  } catch (error: any) {
    console.error('Error getting all new versions:', error.message);
    return {};
  }
}
