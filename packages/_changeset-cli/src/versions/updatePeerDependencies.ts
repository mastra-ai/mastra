import * as p from '@clack/prompts';
import { getPackages } from '@manypkg/get-packages';
import color from 'picocolors';
import semver from 'semver';
import { createCustomChangeset } from '../changeset/createCustomChangeset.js';
import type { VersionBumps } from '../changeset/getChangesetMessage.js';
import { rootDir, corePackage } from '../config.js';
import { getPackageJson } from '../pkg/getPackageJson.js';
import type { PackageJson } from '../pkg/getPackageJson.js';
import { updatePackageJson } from '../pkg/updatePackageJson.js';
import { getNewVersionForPackage } from './getNewVersionForPackage.js';

interface UpdatedPeerDependencies {
  directUpdatedPackages: string[];
  indirectUpdatedPackages: string[];
}

export const getDefaultUpdatedPeerDependencies = (): UpdatedPeerDependencies => {
  return {
    directUpdatedPackages: [],
    indirectUpdatedPackages: [],
  };
};

export async function updatePeerDependencies(versionBumps: VersionBumps): Promise<UpdatedPeerDependencies> {
  const s = p.spinner();
  s.start('Updating peer dependencies');

  const coreBump = versionBumps[corePackage];

  if (!coreBump) {
    s.stop(color.dim('Core package not bumped, skipping peer dependency updates.'));
    return getDefaultUpdatedPeerDependencies();
  }

  const corePackageJson = getPackageJson('packages/core');
  if (!corePackageJson) {
    s.stop(color.dim('Core package not found, skipping peer dependency updates.'));
    return getDefaultUpdatedPeerDependencies();
  }

  const nextCoreVersionBasedOnAllChangesets = await getNewVersionForPackage(corePackage);
  if (!nextCoreVersionBasedOnAllChangesets) {
    s.stop(color.dim('Could not determine next core version.'));
    return getDefaultUpdatedPeerDependencies();
  }

  const nextMajorCoreVersion =
    nextCoreVersionBasedOnAllChangesets.split('.')[0] === '0'
      ? semver.inc(nextCoreVersionBasedOnAllChangesets, 'minor')
      : semver.inc(nextCoreVersionBasedOnAllChangesets, 'major');

  if (coreBump === 'patch' && Object.keys(versionBumps).length === 1) {
    s.stop(color.dim('Only core package bumped, skipping peer dependency updates.'));
    return getDefaultUpdatedPeerDependencies();
  }

  const { packages } = await getPackages(rootDir);
  const packagesByName = new Map(packages.map(pkg => [pkg.packageJson.name, pkg]));

  const directUpdatedPackages = new Map<string, PackageJson>();
  const indirectUpdatedPackages = new Map<string, PackageJson>();
  (s as any).message = 'Updating direct peer dependencies';
  for (const name of Object.keys(versionBumps)) {
    if (name === corePackage) continue;

    if (packagesByName.has(name)) {
      const pkgInfo = packagesByName.get(name)!;

      if (pkgInfo.packageJson?.peerDependencies?.[corePackage]) {
        const cloned = JSON.parse(JSON.stringify(pkgInfo.packageJson));
        cloned.peerDependencies[corePackage] = `>=${nextCoreVersionBasedOnAllChangesets}-0 <${nextMajorCoreVersion}-0`;

        directUpdatedPackages.set(name, cloned);
      }
    }
  }

  for (const [pkg, pkgInfo] of directUpdatedPackages) {
    updatePackageJson(packagesByName.get(pkg)!.dir, pkgInfo);
  }

  if (directUpdatedPackages.size > 0) {
    const bumpObject: VersionBumps = {};
    for (const pkg of directUpdatedPackages.keys()) {
      bumpObject[pkg] = 'minor';
    }
    await createCustomChangeset(
      bumpObject,
      `Update peer dependencies to match core package version bump (${nextCoreVersionBasedOnAllChangesets})`,
    );
  }

  if (coreBump !== 'patch') {
    (s as any).message = 'Updating indirect peer dependencies';
    for (const pkg of packages) {
      if (pkg.packageJson.name === corePackage) continue;

      if (!directUpdatedPackages.has(pkg.packageJson.name) && pkg.packageJson.peerDependencies?.[corePackage]) {
        const cloned = JSON.parse(JSON.stringify(pkg.packageJson));
        const [before] = cloned.peerDependencies[corePackage].split(' ');
        cloned.peerDependencies[corePackage] = `${before} <${nextMajorCoreVersion}-0`;

        indirectUpdatedPackages.set(pkg.packageJson.name, cloned);
      }
    }
  }

  for (const [pkg, pkgInfo] of indirectUpdatedPackages) {
    updatePackageJson(packagesByName.get(pkg)!.dir, pkgInfo);
  }

  if (indirectUpdatedPackages.size > 0) {
    const bumpObject: VersionBumps = {};
    for (const pkg of indirectUpdatedPackages.keys()) {
      bumpObject[pkg] = 'patch';
    }
    await createCustomChangeset(
      bumpObject,
      `Update peer dependencies to match core package version bump (${nextCoreVersionBasedOnAllChangesets})`,
    );
  }

  s.stop('Updated peer dependencies');

  return {
    directUpdatedPackages: Array.from(directUpdatedPackages.keys()),
    indirectUpdatedPackages: Array.from(indirectUpdatedPackages.keys()),
  };
}
