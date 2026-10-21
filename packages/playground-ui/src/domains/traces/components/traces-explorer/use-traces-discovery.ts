import { useTraceMetadataFilterFields } from '@mastra/react/hooks/traces';
import { useTracesConfig } from './traces-explorer-context';

/**
 * The metadata fields observed on traces in the explorer's date window. Every caller shares one
 * cached query, so each part (bar, columns menu, layout) can ask for it directly.
 */
export function useTracesDiscovery() {
  const { discoveryTimeRange, withDiscovery } = useTracesConfig();
  return useTraceMetadataFilterFields({ timeRange: discoveryTimeRange, queryOptions: { enabled: withDiscovery } });
}
