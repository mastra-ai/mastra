import { useMastraPackages } from './use-mastra-packages';
import { useMastraPlatform } from '@/lib/mastra-platform/hooks/use-mastra-platform';

const LEGACY_ANALYTICS_OBSERVABILITY_TYPES = new Set([
  'ObservabilityStorageClickhouseVNext',
  'ObservabilityStorageDuckDB',
  'ObservabilityInMemory',
  'ObservabilitySpanner',
  'ObservabilityStoragePostgresVNext',
]);

export const useObservabilityStorageCapabilities = () => {
  // On the Mastra platform, observability reads (/api/observability/*) are
  // proxied by the edge router to the hosted ClickHouse-backed query service,
  // so the project's own storage capabilities are irrelevant.
  const { isMastraPlatform } = useMastraPlatform();
  const { data, isLoading } = useMastraPackages();
  const observabilityType = data?.observabilityStorageType;
  const advertisedCapabilities = data?.observabilityStorageCapabilities;
  const storageSupportsMetrics =
    advertisedCapabilities?.metrics ??
    (observabilityType ? LEGACY_ANALYTICS_OBSERVABILITY_TYPES.has(observabilityType) : false);

  return {
    supportsMetrics: isMastraPlatform || storageSupportsMetrics,
    isInMemory: !isMastraPlatform && observabilityType === 'ObservabilityInMemory',
    isLoading: !isMastraPlatform && isLoading,
  };
};
