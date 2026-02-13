import { existsSync } from 'node:fs';

import { getPackageInfo } from 'local-pkg';
import pc from 'picocolors';
import { satisfies, gtr } from 'semver';

import type { MastraPackageInfo } from './mastra-packages.js';

export interface PeerDepMismatch {
  package: string;
  packageVersion: string;
  peerDep: string;
  requiredRange: string;
  installedVersion: string;
}

/**
 * Checks if the installed versions of @mastra packages satisfy each other's peer dependency requirements.
 * Returns a list of mismatches that should be warned about.
 *
 * Set MASTRA_SKIP_PEERDEP_CHECK=1 to skip this check.
 */
export async function checkMastraPeerDeps(packages: MastraPackageInfo[]): Promise<PeerDepMismatch[]> {
  if (process.env.MASTRA_SKIP_PEERDEP_CHECK === '1' || process.env.MASTRA_SKIP_PEERDEP_CHECK === 'true') {
    return [];
  }

  const mismatches: PeerDepMismatch[] = [];

  // Build a map of installed package versions for quick lookup
  const installedVersions = new Map<string, string>();
  for (const pkg of packages) {
    installedVersions.set(pkg.name, pkg.version);
  }

  // Check each package's peer dependencies against installed versions
  for (const pkg of packages) {
    try {
      const packageInfo = await getPackageInfo(pkg.name);
      if (!packageInfo?.packageJson?.peerDependencies) {
        continue;
      }

      const peerDeps = packageInfo.packageJson.peerDependencies as Record<string, string>;

      for (const [peerDepName, requiredRange] of Object.entries(peerDeps)) {
        // Only check @mastra/* peer dependencies
        if (!peerDepName.startsWith('@mastra/') && peerDepName !== 'mastra') {
          continue;
        }

        const installedVersion = installedVersions.get(peerDepName);
        if (!installedVersion) {
          // Peer dep not installed - this is a separate issue that npm/pnpm will warn about
          continue;
        }

        // Check if the installed version satisfies the peer dep range
        // includePrerelease: true so that 1.1.0-alpha.1 satisfies >=1.0.0-0 <2.0.0-0
        if (!satisfies(installedVersion, requiredRange, { includePrerelease: true })) {
          mismatches.push({
            package: pkg.name,
            packageVersion: pkg.version,
            peerDep: peerDepName,
            requiredRange,
            installedVersion,
          });
        }
      }
    } catch {
      // Package info not available, skip
    }
  }

  return mismatches;
}

/**
 * Detects the package manager being used in the project.
 */
export function detectPackageManager(): 'pnpm' | 'npm' | 'yarn' {
  if (existsSync('pnpm-lock.yaml')) return 'pnpm';
  if (existsSync('yarn.lock')) return 'yarn';
  return 'npm';
}

/**
 * Returns the command to update mismatched packages, or null if no mismatches.
 *
 * - If peer dep is BELOW the required range → upgrade the peer dep (e.g., @mastra/core)
 * - If peer dep is ABOVE the required range → upgrade the package requiring it (e.g., @mastra/libsql)
 */
export function getUpdateCommand(mismatches: PeerDepMismatch[]): string | null {
  if (mismatches.length === 0) {
    return null;
  }

  const pm = detectPackageManager();
  const packagesToUpdate = new Set<string>();

  for (const m of mismatches) {
    // Check if installed version is above the range (too new) or below (too old)
    const isAboveRange = gtr(m.installedVersion, m.requiredRange, { includePrerelease: true });

    if (isAboveRange) {
      // Peer dep is too new - upgrade the package that requires it
      packagesToUpdate.add(m.package);
    } else {
      // Peer dep is too old - upgrade the peer dep itself
      packagesToUpdate.add(m.peerDep);
    }
  }

  const packagesWithLatest = [...packagesToUpdate].map(pkg => `${pkg}@latest`);
  return `${pm} add ${packagesWithLatest.join(' ')}`;
}

/**
 * Logs warnings for any peer dependency mismatches found.
 * Returns true if any mismatches were found.
 */
export function logPeerDepWarnings(mismatches: PeerDepMismatch[]): boolean {
  const updateCommand = getUpdateCommand(mismatches);
  if (!updateCommand) {
    return false;
  }

  console.warn();
  console.warn(pc.yellow('⚠ Peer dependency version mismatch detected:'));
  console.warn();

  for (const mismatch of mismatches) {
    console.warn(
      pc.dim('  •'),
      pc.cyan(`${mismatch.package}@${mismatch.packageVersion}`),
      'requires',
      pc.cyan(mismatch.peerDep),
      pc.green(mismatch.requiredRange),
    );
    console.warn(pc.dim('    but found'), pc.red(`${mismatch.peerDep}@${mismatch.installedVersion}`));
  }

  console.warn();
  console.warn(pc.dim('  To fix, run:'));
  console.warn(`  ${pc.cyan(updateCommand)}`);
  console.warn();

  return true;
}
