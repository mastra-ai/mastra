import { useMastraPackages } from './use-mastra-packages';

const LEGACY_ANALYTICS_OBSERVABILITY_TYPES = new Set([
  'ObservabilityStorageClickhouseVNext',
  'ObservabilityStorageDuckDB',
  'ObservabilityInMemory',
  'ObservabilitySpanner',
  'ObservabilityStoragePostgresVNext',
]);

export const useObservabilityStorageCapabilities = () => {
  const { data, isLoading } = useMastraPackages();
  const observabilityType = data?.observabilityStorageType;
  const advertisedCapabilities = data?.observabilityStorageCapabilities;
  const supportsMetrics =
    advertisedCapabilities?.metrics ??
    (observabilityType ? LEGACY_ANALYTICS_OBSERVABILITY_TYPES.has(observabilityType) : false);

  return {
    supportsMetrics,
    isInMemory: observabilityType === 'ObservabilityInMemory',
    isLoading,
  };
};
