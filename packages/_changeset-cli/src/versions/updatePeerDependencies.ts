import * as p from '@clack/prompts';
import type { Package } from '@manypkg/get-packages';
import color from 'picocolors';
import semver from 'semver';
import { createCustomChangeset } from '../changeset/createCustomChangeset.js';
import { corePackage } from '../config.js';
import { getPackageJson } from '../pkg/getPackageJson.js';
import { getPublicPackages } from '../pkg/getPublicPackages.js';
import { updatePackageJson } from '../pkg/updatePackageJson.js';
import type { VersionBumps, UpdatedPeerDependencies, PackageJson, BumpType } from '../types.js';
import { getNewVersionForPackage, getReleasePlan } from './getNewVersionForPackage.js';

interface UpdateContext {
  coreBump: string;
  nextCoreVersion: string;
  nextMajorVersion: string | null;
  packages: Package[];
  packagesByName: Map<string, Package>;
  versionBumps: VersionBumps;
}

export function getDefaultUpdatedPeerDependencies(): UpdatedPeerDependencies {
  return {
    directUpdatedPackages: [],
    indirectUpdatedPackages: [],
  };
}

function getNextMajorVersion(version: string): string | null {
  const isZeroVersion = version.startsWith('0.');
  const bumpType = isZeroVersion ? 'minor' : 'major';
  return semver.inc(version, bumpType);
}

async function validateAndPrepareContext(versionBumps: VersionBumps, spinner: any): Promise<UpdateContext | null> {
  const corePackageJson = getPackageJson('packages/core');
  if (!corePackageJson) {
    spinner.stop(color.dim('Core package not found, skipping peer dependency updates.'));
    return null;
  }

  const temporaryChangeset = {
    id: 'tmp-changeset',
    releases: Object.entries(versionBumps).map(([name, bump]) => ({
      name,
      type: bump,
    })),
    summary: 'Update peer dependencies to match core package version bump',
  };
  const nextCoreVersion = await getNewVersionForPackage(corePackage, [temporaryChangeset]);

  if (!nextCoreVersion) {
    spinner.stop(color.dim('Could not determine next core version.'));
    return null;
  }

  const releasePlan = await getReleasePlan([temporaryChangeset]);
  if (!releasePlan) {
    spinner.stop(color.dim('Could not determine next versions.'));
    return null;
  }

  const bumpsFromRelease: VersionBumps = {};
  for (const release of releasePlan.releases) {
    if (release.type !== 'none') {
      bumpsFromRelease[release.name] = release.type as BumpType;
    }
  }

  if (!(corePackage in bumpsFromRelease)) {
    spinner.stop(color.dim('Core package not bumped, skipping peer dependency updates.'));
    return null;
  }

  const nextMajorVersion = getNextMajorVersion(nextCoreVersion);
  if (!nextMajorVersion) {
    spinner.stop(color.red('Failed to calculate next major version.'));
    return null;
  }

  const coreBump = bumpsFromRelease[corePackage];

  // if core got bumped because of a linked package we don't have to update peer dependencies.
  if (coreBump === 'patch' && !versionBumps[corePackage]) {
    spinner.stop(color.dim('Core package not bumped, skipping peer dependency updates.'));
    return null;
  }

  if (coreBump === 'patch' && Object.keys(versionBumps).length === 1) {
    spinner.stop(color.dim('Only core package bumped, skipping peer dependency updates.'));
    return null;
  }

  // When core is not bumped, we don't have to update peer dependencies to minor.
  if (!versionBumps[corePackage]) {
    versionBumps = {} as VersionBumps;
  }

  const packages = await getPublicPackages();
  const packagesByName = new Map(packages.map(pkg => [pkg.packageJson.name, pkg]));

  return {
    coreBump,
    versionBumps: versionBumps,
    nextCoreVersion,
    nextMajorVersion,
    packages,
    packagesByName,
  };
}

function collectDirectUpdates(versionBumps: VersionBumps, context: UpdateContext): Map<string, PackageJson> {
  const directUpdatedPackages = new Map<string, PackageJson>();

  for (const name of Object.keys(versionBumps)) {
    if (name === corePackage) continue;

    const pkgInfo = context.packagesByName.get(name);
    if (!pkgInfo) continue;

    if (pkgInfo.packageJson?.peerDependencies?.[corePackage]) {
      const cloned = JSON.parse(JSON.stringify(pkgInfo.packageJson));
      cloned.peerDependencies[corePackage] = `>=${context.nextCoreVersion}-0 <${context.nextMajorVersion}-0`;
      if (cloned.peerDependencies[corePackage] !== pkgInfo.packageJson.peerDependencies?.[corePackage]) {
        directUpdatedPackages.set(name, cloned);
      }
    }
  }

  return directUpdatedPackages;
}

function collectIndirectUpdates(
  context: UpdateContext,
  directUpdatedPackages: Map<string, PackageJson>,
): Map<string, PackageJson> {
  const indirectUpdatedPackages = new Map<string, PackageJson>();

  if (context.coreBump === 'patch') {
    return indirectUpdatedPackages;
  }

  for (const pkg of context.packages) {
    if (pkg.packageJson.name === corePackage) continue;

    if (!directUpdatedPackages.has(pkg.packageJson.name) && pkg.packageJson.peerDependencies?.[corePackage]) {
      const cloned = JSON.parse(JSON.stringify(pkg.packageJson));
      const [before] = cloned.peerDependencies[corePackage].split(' ');
      cloned.peerDependencies[corePackage] = `${before} <${context.nextMajorVersion}-0`;

      if (cloned.peerDependencies[corePackage] !== pkg.packageJson.peerDependencies?.[corePackage]) {
        indirectUpdatedPackages.set(pkg.packageJson.name, cloned);
      }
    }
  }

  return indirectUpdatedPackages;
}

function applyUpdatesToFiles(updates: Map<string, PackageJson>, packagesByName: Map<string, Package>): void {
  for (const [pkg, pkgInfo] of updates) {
    const packageDir = packagesByName.get(pkg)?.dir;
    if (packageDir) {
      updatePackageJson(packageDir, pkgInfo);
    }
  }
}

async function createChangesetForUpdates(
  updates: Map<string, PackageJson>,
  bumpType: 'major' | 'minor' | 'patch',
  nextCoreVersion: string,
): Promise<void> {
  if (updates.size === 0) return;

  const bumpObject: VersionBumps = {};
  for (const pkg of updates.keys()) {
    bumpObject[pkg] = bumpType;
  }

  await createCustomChangeset(
    bumpObject,
    `Update peer dependencies to match core package version bump (${nextCoreVersion})`,
  );
}

export async function updatePeerDependencies(versionBumps: VersionBumps): Promise<UpdatedPeerDependencies> {
  const s = p.spinner();
  s.start('Updating peer dependencies');

  // Validate and prepare context
  const context = await validateAndPrepareContext(versionBumps, s);
  if (!context) {
    return getDefaultUpdatedPeerDependencies();
  }

  // Collect direct updates
  (s as any).message = 'Updating direct peer dependencies';
  const directUpdatedPackages = collectDirectUpdates(context.versionBumps, context);

  // Apply direct updates
  applyUpdatesToFiles(directUpdatedPackages, context.packagesByName);

  // Create changeset for direct updates
  await createChangesetForUpdates(directUpdatedPackages, 'minor', context.nextCoreVersion);

  // Collect indirect updates
  (s as any).message = 'Updating indirect peer dependencies';
  const indirectUpdatedPackages = collectIndirectUpdates(context, directUpdatedPackages);

  // Apply indirect updates
  applyUpdatesToFiles(indirectUpdatedPackages, context.packagesByName);

  // Create changeset for indirect updates
  await createChangesetForUpdates(indirectUpdatedPackages, 'patch', context.nextCoreVersion);

  s.stop(`Updated all peer dependencies (core: ${context.coreBump})`);

  return {
    directUpdatedPackages: Array.from(directUpdatedPackages.keys()),
    indirectUpdatedPackages: Array.from(indirectUpdatedPackages.keys()),
  };
}
