import { useQueries } from '@tanstack/react-query';

export interface PackageInfo {
  name: string;
  version: string;
}

export interface PackageUpdateInfo extends PackageInfo {
  latestVersion: string | null;
  isOutdated: boolean;
  isDeprecated: boolean;
  isPrerelease: boolean;
  deprecationMessage?: string;
}

interface NpmPackageResponse {
  'dist-tags': {
    latest: string;
  };
  versions: Record<
    string,
    {
      deprecated?: string;
    }
  >;
}

/**
 * Check if a version string is a prerelease (alpha, beta, rc, etc.)
 */
function isPrerelease(version: string): boolean {
  return /[-](alpha|beta|rc|canary|next|dev|pre|snapshot)/i.test(version);
}

/**
 * Compare two semver versions. Returns:
 * - negative if a < b
 * - 0 if a === b
 * - positive if a > b
 */
function compareSemver(a: string, b: string): number {
  // Strip prerelease tags for base comparison
  const parseVersion = (v: string) => {
    const match = v.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) return [0, 0, 0];
    return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
  };

  const [aMajor, aMinor, aPatch] = parseVersion(a);
  const [bMajor, bMinor, bPatch] = parseVersion(b);

  if (aMajor !== bMajor) return aMajor - bMajor;
  if (aMinor !== bMinor) return aMinor - bMinor;
  if (aPatch !== bPatch) return aPatch - bPatch;

  // If base versions are equal, check prerelease
  const aIsPrerelease = isPrerelease(a);
  const bIsPrerelease = isPrerelease(b);

  // Stable > prerelease for same base version
  if (!aIsPrerelease && bIsPrerelease) return 1;
  if (aIsPrerelease && !bIsPrerelease) return -1;

  return 0;
}

async function fetchPackageInfo(packageName: string, installedVersion: string): Promise<PackageUpdateInfo> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`);

    if (!response.ok) {
      return {
        name: packageName,
        version: installedVersion,
        latestVersion: null,
        isOutdated: false,
        isDeprecated: false,
        isPrerelease: isPrerelease(installedVersion),
      };
    }

    const data: NpmPackageResponse = await response.json();
    const latestVersion = data['dist-tags']?.latest ?? null;
    const versionInfo = data.versions?.[installedVersion];
    const deprecationMessage = versionInfo?.deprecated;
    const installedIsPrerelease = isPrerelease(installedVersion);

    // Determine if outdated:
    // - If installed is a prerelease, don't mark as outdated vs stable latest
    // - Only mark as outdated if latest is actually newer
    let isOutdated = false;
    if (latestVersion !== null && installedVersion !== latestVersion) {
      if (installedIsPrerelease) {
        // Prerelease versions: only outdated if latest stable base is higher than installed base
        isOutdated = compareSemver(latestVersion, installedVersion) > 0;
      } else {
        // Stable versions: outdated if latest is newer
        isOutdated = compareSemver(latestVersion, installedVersion) > 0;
      }
    }

    return {
      name: packageName,
      version: installedVersion,
      latestVersion,
      isOutdated,
      isDeprecated: !!deprecationMessage,
      isPrerelease: installedIsPrerelease,
      deprecationMessage,
    };
  } catch {
    return {
      name: packageName,
      version: installedVersion,
      latestVersion: null,
      isOutdated: false,
      isDeprecated: false,
      isPrerelease: isPrerelease(installedVersion),
    };
  }
}

export function usePackageUpdates(packages: PackageInfo[]) {
  const queries = useQueries({
    queries: packages.map(pkg => ({
      queryKey: ['package-update', pkg.name, pkg.version],
      queryFn: () => fetchPackageInfo(pkg.name, pkg.version),
      staleTime: 1000 * 60 * 60, // 1 hour - latest versions don't change often
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
    })),
  });

  const isLoading = queries.some(q => q.isLoading);
  const packageUpdates = queries.map(q => q.data).filter((p): p is PackageUpdateInfo => p !== undefined);

  // Only compute counts when all queries are complete to avoid incrementing badges
  const allComplete = !isLoading && packageUpdates.length === packages.length;
  const outdatedCount = allComplete ? packageUpdates.filter(p => p.isOutdated && !p.isDeprecated).length : 0;
  const deprecatedCount = allComplete ? packageUpdates.filter(p => p.isDeprecated).length : 0;

  return {
    packages: packageUpdates,
    isLoading,
    outdatedCount,
    deprecatedCount,
  };
}
