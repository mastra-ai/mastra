import { useTraceQueryAvailable } from '@mastra/playground-ui/domains/capabilities';
import { ExperimentsComparison } from '@mastra/playground-ui/domains/experiments';
import {
  useAllDatasetExperimentResultsQueries,
  useCompareExperiments,
  useDatasetExperimentsQueries,
  useScoresByExperimentIdsQueries,
} from '@mastra/react/hooks/datasets';
import { useExperimentsItemUsage } from '@mastra/react/hooks/experiments';
import { useMemo } from 'react';
import { useRenameExperiment } from '../../hooks/use-rename-experiment';
import { ComparisonDatasetItemPanel } from './comparison-dataset-item-panel';
import { ComparisonTracePanel } from './comparison-trace-panel';
import { useObservabilityStorageCapabilities } from '@/domains/configuration/hooks/use-observability-storage-capabilities';

interface StudioExperimentsComparisonProps {
  datasetId: string;
  baselineId: string;
  contenderIds: string[];
  onSetBaseline?: (experimentId: string) => void;
}

/** Loads the compared experiments, their results, scores and usage into the shared comparison table. */
export function StudioExperimentsComparison({
  datasetId,
  baselineId,
  contenderIds,
  onSetBaseline,
}: StudioExperimentsComparisonProps) {
  const experimentIds = useMemo(() => [baselineId, ...contenderIds], [baselineId, contenderIds]);
  const traceQuery = useTraceQueryAvailable();
  const renameHandlerFor = useRenameExperiment();

  const {
    data: comparison,
    isLoading,
    error,
  } = useCompareExperiments({
    datasetId,
    experimentIds,
    baselineId,
    queryOptions: { enabled: Boolean(datasetId) && Boolean(baselineId) && contenderIds.length > 0 },
  });

  const { data: experimentsById, isLoading: isExperimentsLoading } = useDatasetExperimentsQueries({
    datasetId,
    experimentIds,
  });

  const experimentRefs = useMemo(
    () => experimentIds.map(id => ({ id, status: experimentsById[id]?.status })),
    [experimentIds, experimentsById],
  );

  const { data: resultsById, isLoading: isResultsLoading } = useAllDatasetExperimentResultsQueries({
    datasetId,
    experiments: experimentRefs,
  });
  // Scorer reasons live in the scores store, not on the result rows.
  const { data: scoresById } = useScoresByExperimentIdsQueries({ experiments: experimentRefs });

  const { supportsMetrics, isLoading: isCapabilitiesLoading } = useObservabilityStorageCapabilities();
  // Filtered by experiment id, so it runs alongside the results instead of waiting for their trace ids.
  const { data: usageById, isLoading: isUsageLoading } = useExperimentsItemUsage({
    experiments: experimentRefs,
    supportsMetrics,
  });

  // The route answers `null` for a missing experiment; the table takes `undefined`.
  const comparedExperimentsById = Object.fromEntries(experimentIds.map(id => [id, experimentsById[id] ?? undefined]));

  return (
    <ExperimentsComparison
      experimentIds={experimentIds}
      comparison={comparison}
      experimentsById={comparedExperimentsById}
      resultsById={resultsById}
      scoresById={scoresById}
      usageById={usageById}
      isLoading={isLoading || isExperimentsLoading || isCapabilitiesLoading || isUsageLoading}
      isResultsLoading={isResultsLoading}
      error={error ?? undefined}
      supportsMetrics={supportsMetrics}
      onSetBaseline={onSetBaseline}
      onRenameExperiment={(experiment, patch) => renameHandlerFor(experiment)?.(patch) ?? Promise.resolve()}
      itemPanel={({ itemId, onClose }) => (
        <ComparisonDatasetItemPanel datasetId={datasetId} itemId={itemId} onClose={onClose} />
      )}
      // Stays mounted so the drawer animates in and out, like on the traces page.
      tracePanel={({ traceId, onClose }) => (
        <ComparisonTracePanel traceId={traceId} onClose={onClose} withFeedback={traceQuery.enabled} />
      )}
    />
  );
}
