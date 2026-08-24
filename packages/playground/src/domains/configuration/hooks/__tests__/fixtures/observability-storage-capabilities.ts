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

/** Every storage class the legacy fallback recognizes as analytics-capable. */
export const LEGACY_ANALYTICS_STORAGE_TYPES = [
  'ObservabilityStorageClickhouseVNext',
  'ObservabilityStorageDuckDB',
  'ObservabilityInMemory',
  'ObservabilitySpanner',
  'ObservabilityStoragePostgresVNext',
] as const;

export const legacyStorageWithoutCapabilities = (observabilityStorageType: string): GetSystemPackagesResponse => ({
  ...baseSystemPackages,
  observabilityStorageType,
});

/** An unrecognized storage class on an older server that advertises nothing. */
export const unknownStorageWithoutCapabilities: GetSystemPackagesResponse = {
  ...baseSystemPackages,
  observabilityStorageType: 'ObservabilityStorageSomethingNew',
};

/** A server so old it does not report a storage class at all. */
export const noStorageTypeReported: GetSystemPackagesResponse = { ...baseSystemPackages };

export const inMemoryStorage: GetSystemPackagesResponse = {
  ...baseSystemPackages,
  observabilityStorageType: 'ObservabilityInMemory',
};
