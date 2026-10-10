import { useDatasetExperiment, useExperiments } from '@mastra/react/hooks/datasets';
import { useParams } from 'react-router';
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

/**
 * Run status icon rendered through the crumb `icon` slot.
 *
 * The experiments list is not polled, so its status goes stale once a run
 * finishes. The list entry is only used to resolve the datasetId and as a
 * fallback; the live status comes from the polled single-experiment query
 * (shared with the experiment page via the same query key).
 */
export function ExperimentCrumbStatusIcon() {
  const { experimentId, experiment } = useCurrentExperiment();
  const datasetId = experiment?.datasetId ?? '';
  const { data: detail } = useDatasetExperiment({
    datasetId,
    experimentId: experimentId ?? '',
    queryOptions: { enabled: Boolean(datasetId) && Boolean(experimentId) },
  });

  const status = detail?.status ?? experiment?.status;
  return status ? <ExperimentStatusIcon status={status} /> : null;
}
