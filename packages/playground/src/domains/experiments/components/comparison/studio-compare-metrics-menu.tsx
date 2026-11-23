import { CompareMetricsMenu } from '@mastra/playground-ui/domains/experiments';
import { useCompareExperiments } from '@mastra/react/hooks/datasets';
import { useMemo } from 'react';
import { useObservabilityStorageCapabilities } from '@/domains/configuration/hooks/use-observability-storage-capabilities';

interface StudioCompareMetricsMenuProps {
  datasetId: string;
  baselineId: string;
  contenderIds: string[];
}

/** The compare page's metrics picker, offering the scorers of the comparison shown. */
export function StudioCompareMetricsMenu({ datasetId, baselineId, contenderIds }: StudioCompareMetricsMenuProps) {
  const experimentIds = useMemo(() => [baselineId, ...contenderIds], [baselineId, contenderIds]);
  // Same query as the grid, so React Query serves it from cache.
  const { data: comparison } = useCompareExperiments({ datasetId, experimentIds, baselineId });
  const { supportsMetrics } = useObservabilityStorageCapabilities();
  return <CompareMetricsMenu comparison={comparison} supportsMetrics={supportsMetrics} />;
}
