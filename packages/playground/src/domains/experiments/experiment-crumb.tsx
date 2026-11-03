import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useDatasetExperiment, useExperiment } from '@mastra/react/hooks/datasets';
import { useParams } from 'react-router';
import { ExperimentStatusIcon } from '@/domains/experiments/components/experiment-stats';

const useCurrentExperiment = () => {
  const { experimentId } = useParams<{ experimentId: string }>();
  // Retrying an errored lookup on mount loops with the page's not-found shell.
  const { data } = useExperiment({
    experimentId: experimentId ?? '',
    queryOptions: { enabled: Boolean(experimentId), retryOnMount: false },
  });
  return { experimentId, experiment: data };
};

const useLiveExperiment = () => {
  const { experimentId, experiment } = useCurrentExperiment();
  const datasetId = experiment?.datasetId ?? '';
  // Only the dataset-scoped query polls active runs.
  const { data: datasetExperiment } = useDatasetExperiment({
    datasetId,
    experimentId: experimentId ?? '',
    queryOptions: { enabled: Boolean(datasetId && experimentId), retryOnMount: false },
  });
  return datasetExperiment ?? experiment;
};

export function ExperimentCrumb() {
  const { experimentId, experiment } = useCurrentExperiment();
  if (!experimentId) return null;

  const shortId = experimentId.length > 8 ? `${experimentId.slice(0, 8)}...` : experimentId;
  return experiment?.name || shortId;
}

export function ExperimentCrumbStatusIcon() {
  const experiment = useLiveExperiment();
  return experiment?.status ? <ExperimentStatusIcon status={experiment.status} /> : null;
}

export function ExperimentCrumbItemCount() {
  const experiment = useLiveExperiment();
  if (!experiment || experiment.status === 'running' || experiment.status === 'pending') return null;

  const { totalItems, failedCount } = experiment;
  const count = `${totalItems} ${totalItems === 1 ? 'item' : 'items'}`;

  return (
    <Txt as="span" variant="caption" tone="muted" className="whitespace-nowrap tabular-nums">
      <Metadata>
        <Metadata.Item>{count}</Metadata.Item>
        {failedCount > 0 && <Metadata.Item>{failedCount} errored</Metadata.Item>}
      </Metadata>
    </Txt>
  );
}
