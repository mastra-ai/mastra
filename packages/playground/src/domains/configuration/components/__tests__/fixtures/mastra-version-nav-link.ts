import type { GetSystemPackagesResponse } from '@mastra/client-js';

export const systemPackagesWithUpdates: GetSystemPackagesResponse = {
  packages: [
    { name: '@mastra/core', version: '1.0.0' },
    { name: '@mastra/memory', version: '1.0.0' },
  ],
  isDev: true,
  cmsEnabled: false,
  liveKitConnectionRouteEnabled: false,
  observabilityEnabled: true,
};

/** The part of an npm registry document that `usePackageUpdates` reads. */
export type NpmRegistryResponse = {
  'dist-tags': { latest: string };
  versions: Record<string, { deprecated?: string }>;
};

export const currentPackageRegistryResponse: NpmRegistryResponse = {
  'dist-tags': { latest: '1.0.0' },
  versions: { '1.0.0': {} },
};

export const outdatedPackageRegistryResponse: NpmRegistryResponse = {
  'dist-tags': { latest: '2.0.0' },
  versions: { '1.0.0': {} },
};

export const deprecatedPackageRegistryResponse: NpmRegistryResponse = {
  'dist-tags': { latest: '2.0.0' },
  versions: { '1.0.0': { deprecated: 'Use the replacement package' } },
};
