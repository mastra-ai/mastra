import { useQueries } from '@tanstack/react-query';
import semver from 'semver';

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

async function fetchPackageInfo(packageName: string, installedVersion: string): Promise<PackageUpdateInfo> {
  const installedIsPrerelease = semver.prerelease(installedVersion) !== null;

  try {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`);

    if (!response.ok) {
      return {
        name: packageName,
        version: installedVersion,
        latestVersion: null,
        isOutdated: false,
        isDeprecated: false,
        isPrerelease: installedIsPrerelease,
      };
    }

    const data: NpmPackageResponse = await response.json();
    const latestVersion = data['dist-tags']?.latest ?? null;
    const versionInfo = data.versions?.[installedVersion];
    const deprecationMessage = versionInfo?.deprecated;

    // Determine if outdated using semver.gt (greater than)
    // Only mark as outdated if latest is actually newer than installed
    let isOutdated = false;
    if (latestVersion !== null && semver.valid(installedVersion) && semver.valid(latestVersion)) {
      isOutdated = semver.gt(latestVersion, installedVersion);
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
      isPrerelease: installedIsPrerelease,
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
