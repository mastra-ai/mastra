import { useObservabilityCapabilities } from '@mastra/react/hooks/capabilities';
import { useMastraPlatform } from '@/lib/mastra-platform/hooks/use-mastra-platform';

const LEGACY_ANALYTICS_OBSERVABILITY_TYPES = new Set([
  'ObservabilityStorageClickhouseVNext',
  'ObservabilityStorageDuckDB',
  'ObservabilityInMemory',
  'ObservabilitySpanner',
  'ObservabilityStoragePostgresVNext',
]);

/** Resolves metrics support, preserving lookup failures and the hosted-platform override. */
export const useObservabilityStorageCapabilities = () => {
  // On the Mastra platform, observability reads (/api/observability/*) are
  // proxied by the edge router to the hosted ClickHouse-backed query service,
  // so the project's own storage capabilities are irrelevant.
  const { isMastraPlatform } = useMastraPlatform();
  const { data, isLoading, error } = useObservabilityCapabilities();
  const observabilityType = data?.observabilityStorageType;
  const storageSupportsMetrics =
    data?.capabilities?.metrics ??
    (observabilityType ? LEGACY_ANALYTICS_OBSERVABILITY_TYPES.has(observabilityType) : false);

  return {
    supportsMetrics: isMastraPlatform || storageSupportsMetrics,
    isInMemory: !isMastraPlatform && observabilityType === 'ObservabilityInMemory',
    isLoading: !isMastraPlatform && isLoading,
    error: isMastraPlatform ? undefined : error,
  };
};
