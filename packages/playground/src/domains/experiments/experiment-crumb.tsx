import { Txt } from '@mastra/playground-ui/components/Txt';
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

/** Current experiment, kept fresh while it runs. */
const useLiveExperiment = () => {
  const { experimentId, experiment } = useCurrentExperiment();
  const datasetId = experiment?.datasetId ?? '';
  // `useExperiment` doesn't poll; the dataset-scoped query does while the run is active, so the crumb follows it.
  const { data: datasetExperiment } = useDatasetExperiment({
    datasetId,
    experimentId: experimentId ?? '',
    queryOptions: { enabled: Boolean(datasetId && experimentId), retryOnMount: false },
  });
  return datasetExperiment ?? experiment;
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
  const experiment = useLiveExperiment();
  return experiment?.status ? <ExperimentStatusIcon status={experiment.status} /> : null;
}

/** Item count rendered next to the experiment name once the run settles; the page body shows an active run's progress. */
export function ExperimentCrumbItemCount() {
  const experiment = useLiveExperiment();
  if (!experiment || experiment.status === 'running' || experiment.status === 'pending') return null;

  const { totalItems, failedCount } = experiment;
  const count = `${totalItems} ${totalItems === 1 ? 'item' : 'items'}`;

  return (
    <Txt as="span" variant="caption" tone="muted" className="whitespace-nowrap tabular-nums">
      {failedCount > 0 ? `${count} · ${failedCount} errored` : count}
    </Txt>
  );
}
