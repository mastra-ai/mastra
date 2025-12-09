import { deprecate } from 'util';

export function useMastraPackageVersions() {
  // Placeholder for actual implementation

  const packages: { name: string; used: string; latest: string; usedDeprecated?: boolean }[] = [
    {
      name: '@mastra/core',
      used: '1.0.0',
      latest: '1.0.0',
    },
    {
      name: '@mastra/evals',
      used: '0.9.0',
      latest: '0.9.0',
    },
    {
      name: '@mastra/evals',
      used: '0.9.0',
      latest: '0.12.0',
    },
    {
      name: '@mastra/observability',
      used: '0.9.0',
      latest: '0.10.0',
    },
    {
      name: '@mastra/storage',
      used: '0.9.0',
      usedDeprecated: true,
      latest: '0.12.0',
    },
  ];

  return {
    data: {
      version: packages.find(pkg => pkg.name === '@mastra/core')?.used || '?',
      allPackages: packages,
      outdatedPackagesCount: packages.filter(pkg => pkg.used !== pkg.latest).length,
      deprecatedPackagesCount: packages.filter(pkg => pkg.usedDeprecated).length,
    },
    loading: false,
    error: null,
  };
}
