import { useDatasetExperiment, useExperiment } from '@mastra/react/hooks/datasets';
import { useParams } from 'react-router';
import { ExperimentStatusIcon } from '@/domains/experiments/components/experiment-stats';

const useCurrentExperiment = () => {
  const { experimentId } = useParams<{ experimentId: string }>();
  // The page owns the fetch; re-fetching an errored lookup on mount would loop with the page's not-found shell.
  const { data } = useExperiment({
    experimentId: experimentId ?? '',
    queryOptions: { enabled: Boolean(experimentId), retryOnMount: false },
  });
  return { experimentId, experiment: data };
};

/**
 * Experiment breadcrumb label: the experiment name, falling back to the
 * truncated id while loading or when the experiment was created without one.
 */
export function ExperimentCrumb() {
  const { experimentId, experiment } = useCurrentExperiment();
  if (!experimentId) return null;

  const shortId = experimentId.length > 8 ? `${experimentId.slice(0, 8)}...` : experimentId;
  return experiment?.name || shortId;
}

/** Run status icon rendered through the crumb `icon` slot. */
export function ExperimentCrumbStatusIcon() {
  const { experimentId, experiment } = useCurrentExperiment();
  const datasetId = experiment?.datasetId ?? '';
  // `useExperiment` doesn't poll; the dataset-scoped query does while the run is active, so the icon follows it.
  const { data: datasetExperiment } = useDatasetExperiment({
    datasetId,
    experimentId: experimentId ?? '',
    queryOptions: { enabled: Boolean(datasetId && experimentId), retryOnMount: false },
  });

  const status = datasetExperiment?.status ?? experiment?.status;
  return status ? <ExperimentStatusIcon status={status} /> : null;
}
