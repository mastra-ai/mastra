import { getPackageInfo } from 'local-pkg';
import pc from 'picocolors';
import { satisfies } from 'semver';

import type { MastraPackageInfo } from './mastra-packages.js';

interface PeerDepMismatch {
  package: string;
  packageVersion: string;
  peerDep: string;
  requiredRange: string;
  installedVersion: string;
}

/**
 * Checks if the installed versions of @mastra packages satisfy each other's peer dependency requirements.
 * Returns a list of mismatches that should be warned about.
 */
export async function checkMastraPeerDeps(packages: MastraPackageInfo[]): Promise<PeerDepMismatch[]> {
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
        if (!satisfies(installedVersion, requiredRange)) {
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
 * Logs warnings for any peer dependency mismatches found.
 * Returns true if any mismatches were found.
 */
export function logPeerDepWarnings(mismatches: PeerDepMismatch[]): boolean {
  if (mismatches.length === 0) {
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
  console.warn(pc.dim('  Consider upgrading your @mastra packages to compatible versions.'));
  console.warn(pc.dim('  Run: pnpm update @mastra/*'));
  console.warn();

  return true;
}
