import type { DatasetExperiment } from '@mastra/client-js';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { STATUS_LABEL } from './experiment-columns';

export interface ExperimentRunProgressProps {
  experiment: DatasetExperiment;
}

/** Stands in for the KPIs and results while a run is queued or in progress, which would only show partial data. */
export function ExperimentRunProgress({ experiment }: ExperimentRunProgressProps) {
  const { status, totalItems, succeededCount, failedCount } = experiment;
  const finishedCount = succeededCount + failedCount;
  const noun = totalItems === 1 ? 'item' : 'items';

  return (
    <EmptyState
      variant="fill"
      as="h2"
      iconSlot={<Spinner />}
      titleSlot={STATUS_LABEL[status]}
      descriptionSlot={
        <span className="tabular-nums">
          {finishedCount} / {totalItems} {noun} finished
        </span>
      }
    />
  );
}
