import type { GetSystemPackagesResponse } from '@mastra/client-js';

export const systemPackagesWithUpdates: GetSystemPackagesResponse = {
  packages: [
    { name: '@mastra/core', version: '1.0.0' },
    { name: '@mastra/memory', version: '1.0.0' },
  ],
  isDev: true,
  cmsEnabled: false,
  observabilityEnabled: true,
};

export const currentPackageRegistryResponse = {
  'dist-tags': { latest: '2.0.0' },
  versions: { '1.0.0': {} },
};

export const deprecatedPackageRegistryResponse = {
  'dist-tags': { latest: '2.0.0' },
  versions: { '1.0.0': { deprecated: 'Use the replacement package' } },
};
