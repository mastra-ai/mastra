import { useParams } from 'react-router';
import { useExperiments } from '@/domains/datasets/hooks/use-experiments';
import { ExperimentStatusIcon } from '@/domains/experiments/components/experiment-stats';

const useCurrentExperiment = () => {
  const { experimentId } = useParams<{ experimentId: string }>();
  const { data } = useExperiments();
  return { experimentId, experiment: data?.experiments?.find(e => e.id === experimentId) };
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
