import { useTraceMetadataFilterFields } from '@mastra/react/hooks/traces';
import type { TracesFilters } from '../components/traces-explorer/traces-explorer-actions';
import type {
  TracesExplorerCapabilities,
  TracesExplorerDiscovery,
} from '../components/traces-explorer/traces-explorer-data';
import { resolveTracesSupport } from '../components/traces-explorer/traces-explorer-support';
import type { TracesExplorerFeatures } from '../components/traces-explorer/traces-explorer-support';
import { useTracesDiscoveryWindow } from './use-traces-discovery-window';

export type UseTracesDiscoveryQueryArgs = {
  filters: TracesFilters;
  capabilities: TracesExplorerCapabilities;
  features?: TracesExplorerFeatures;
};

/**
 * Studio's field discovery for the explorer, through the Mastra client: the metadata fields observed on
 * traces in the filters' window, once the server supports discovery. Pass the result as
 * `TracesExplorer`'s `discovery`.
 */
export function useTracesDiscoveryQuery({
  filters,
  capabilities,
  features,
}: UseTracesDiscoveryQueryArgs): TracesExplorerDiscovery {
  const { withDiscovery } = resolveTracesSupport(capabilities, features);
  const timeRange = useTracesDiscoveryWindow(filters);
  const { fields, canonicalFields, isLoading } = useTraceMetadataFilterFields({
    timeRange,
    queryOptions: { enabled: withDiscovery },
  });
  return { fields, canonicalFields, isLoading };
}
