import type { DatasetExperiment } from '@mastra/client-js';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { RotatingText } from '@mastra/playground-ui/components/RotatingText';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { formatDuration } from '@mastra/playground-ui/utils/duration';
import { useNow } from '../hooks/use-now';
import { QUEUED_MESSAGE, RUNNING_MESSAGES } from './experiment-run-messages';

export interface ExperimentRunProgressProps {
  experiment: DatasetExperiment;
}

/** Stands in for the KPIs and results while a run is queued or in progress, which would only show partial data. */
export function ExperimentRunProgress({ experiment }: ExperimentRunProgressProps) {
  const { status, totalItems, succeededCount, failedCount, startedAt } = experiment;
  const now = useNow();
  const finishedCount = succeededCount + failedCount;
  const noun = totalItems === 1 ? 'item' : 'items';
  const isQueued = status === 'pending';

  // Whole seconds keep the counter steady; a negative value means clock skew, so it is dropped.
  const elapsedMs = startedAt ? Math.floor((now - new Date(startedAt).getTime()) / 1000) * 1000 : undefined;
  const elapsed = !isQueued && elapsedMs !== undefined ? formatDuration(elapsedMs) : undefined;

  return (
    <EmptyState
      variant="fill"
      as="h2"
      iconSlot={<Spinner />}
      titleSlot={isQueued ? 'Experiment queued' : 'Experiment in progress'}
      descriptionSlot={
        <span className="flex flex-col items-center gap-1">
          <span>{isQueued ? QUEUED_MESSAGE : <RotatingText messages={RUNNING_MESSAGES} />}</span>
          <span className="tabular-nums">
            <span>
              {finishedCount} / {totalItems} {noun} finished
            </span>
            {elapsed && (
              <>
                <span aria-hidden> · </span>
                <span>{elapsed} elapsed</span>
              </>
            )}
          </span>
        </span>
      }
    />
  );
}
