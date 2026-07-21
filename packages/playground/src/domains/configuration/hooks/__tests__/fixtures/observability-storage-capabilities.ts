import type { GetSystemPackagesResponse } from '@mastra/client-js';

const baseSystemPackages: GetSystemPackagesResponse = {
  packages: [],
  isDev: false,
  cmsEnabled: false,
  observabilityEnabled: true,
};

export const renamedPostgresWithMetrics: GetSystemPackagesResponse = {
  ...baseSystemPackages,
  observabilityStorageType: '_ObservabilityStoragePostgresVNext',
  observabilityStorageCapabilities: {
    metrics: true,
    logs: true,
  },
};

export const legacyPostgresWithoutCapabilities: GetSystemPackagesResponse = {
  ...baseSystemPackages,
  observabilityStorageType: 'ObservabilityStoragePostgresVNext',
};

export const storageWithoutMetrics: GetSystemPackagesResponse = {
  ...baseSystemPackages,
  observabilityStorageType: 'ObservabilityStoragePostgresVNext',
  observabilityStorageCapabilities: {
    metrics: false,
    logs: true,
  },
};
