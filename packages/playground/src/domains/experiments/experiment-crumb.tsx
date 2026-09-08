import { useParams } from 'react-router';
import { useExperiments } from '@/domains/datasets/hooks/use-experiments';

/**
 * Experiment breadcrumb: shows the experiment name, falling back to the
 * truncated id while loading or when the experiment was created without one.
 */
export function ExperimentCrumb() {
  const { experimentId } = useParams<{ experimentId: string }>();
  const { data } = useExperiments();

  if (!experimentId) return null;

  const experiment = data?.experiments?.find(e => e.id === experimentId);
  const shortId = experimentId.length > 8 ? `${experimentId.slice(0, 8)}...` : experimentId;

  return <>{experiment?.name || shortId}</>;
}
