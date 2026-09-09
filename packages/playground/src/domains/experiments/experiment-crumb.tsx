import { useParams } from 'react-router';
import { useExperiments } from '@/domains/datasets/hooks/use-experiments';
import { ExperimentStatusIcon } from '@/domains/experiments/components/experiment-stats';

/**
 * Experiment breadcrumb: run status icon followed by the experiment name, falling
 * back to the truncated id while loading or when the experiment was created without one.
 */
export function ExperimentCrumb() {
  const { experimentId } = useParams<{ experimentId: string }>();
  const { data } = useExperiments();

  if (!experimentId) return null;

  const experiment = data?.experiments?.find(e => e.id === experimentId);
  const shortId = experimentId.length > 8 ? `${experimentId.slice(0, 8)}...` : experimentId;

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {experiment && <ExperimentStatusIcon status={experiment.status} />}
      <span className="truncate">{experiment?.name || shortId}</span>
    </span>
  );
}
