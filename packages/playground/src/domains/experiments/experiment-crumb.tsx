import { useExperiment } from '@mastra/react/hooks/datasets';
import { useParams } from 'react-router';
import { ExperimentStatusIcon } from '@/domains/experiments/components/experiment-stats';

const useCurrentExperiment = () => {
  const { experimentId } = useParams<{ experimentId: string }>();
  const { data: experiment } = useExperiment({
    experimentId: experimentId ?? '',
    // The page shell remounts the crumb when this query fails (e.g. 404). Retrying on that
    // mount would reset the query to pending, unmount the crumb, and loop forever.
    queryOptions: { enabled: Boolean(experimentId), retryOnMount: false },
  });
  return { experimentId, experiment };
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
  const { experiment } = useCurrentExperiment();
  return experiment ? <ExperimentStatusIcon status={experiment.status} /> : null;
}
