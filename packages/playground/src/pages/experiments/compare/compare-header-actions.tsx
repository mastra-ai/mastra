import { CompareDatasetBadge } from './compare-dataset-badge';
import { useComparedExperimentIds } from './use-compared-experiment-ids';
import { StudioCompareMetricsMenu } from '@/domains/experiments/components/comparison/studio-compare-metrics-menu';

/** Top-right actions of the compare page: the metrics picker and the compared dataset. */
export function CompareHeaderActions() {
  const { datasetId, baselineId, contenderIds } = useComparedExperimentIds();

  return (
    <div className="flex items-center gap-2">
      {datasetId && baselineId && contenderIds.length > 0 && (
        <StudioCompareMetricsMenu datasetId={datasetId} baselineId={baselineId} contenderIds={contenderIds} />
      )}
      <CompareDatasetBadge />
    </div>
  );
}
