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
      latest: '0.9.0',
    },
    {
      name: '@mastra/observability',
      used: '0.9.0',
      latest: '0.9.0',
    },
    {
      name: '@mastra/storage',
      used: '0.9.0',
      usedDeprecated: true,
      latest: '0.9.0',
    },
  ];

  return {
    data: {
      version: packages.find(pkg => pkg.name === '@mastra/core')?.used || '?',
      outdated: packages.filter(pkg => pkg.used !== pkg.latest)?.length || 0,
      deprecated: packages.filter(pkg => pkg.usedDeprecated)?.length || 0,
      packages,
    },
    loading: false,
    error: null,
  };
}
