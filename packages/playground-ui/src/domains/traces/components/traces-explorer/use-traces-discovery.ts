import type { GetTraceQueryFieldsResponse } from '@mastra/client-js';
import { traceQueryFieldsQueryKey, useTraceMetadataFilterFields } from '@mastra/react/hooks/traces';
import { useTracesConfig } from './traces-explorer-context';
import { useSelectionPlaceholder } from '@/domains/observability/hooks/use-selection-cache';

/**
 * The metadata fields observed on traces in the explorer's date window. Every caller shares one
 * cached query, so each part (bar, columns menu, layout) can ask for it directly. When the window
 * moves on, the fields last found for the same date range stand in until the new ones arrive.
 */
export function useTracesDiscovery() {
  const { discoveryTimeRange, discoverySelection, withDiscovery } = useTracesConfig();
  const placeholderData = useSelectionPlaceholder<GetTraceQueryFieldsResponse>(
    `traces-discovery:${discoverySelection}`,
    traceQueryFieldsQueryKey(discoveryTimeRange),
  );
  return useTraceMetadataFilterFields({
    timeRange: discoveryTimeRange,
    queryOptions: { enabled: withDiscovery, placeholderData },
  });
}

/** Capabilities or filter field discovery are still loading, so the body shows its skeleton. */
export function useTracesBodyLoading() {
  const { isCapabilitiesLoading } = useTracesConfig();
  const { isLoading: isDiscoveryLoading } = useTracesDiscovery();
  return isCapabilitiesLoading || isDiscoveryLoading;
}
