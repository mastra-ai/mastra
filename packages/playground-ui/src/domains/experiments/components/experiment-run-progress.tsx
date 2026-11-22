'use client';

import type { DatasetExperiment } from '@mastra/client-js';
import { QUEUED_MESSAGE, RUNNING_MESSAGES } from './experiment-run-messages';
import { useNow } from '@/domains/experiments/hooks/use-now';
import { EmptyState } from '@/ds/components/EmptyState';
import { Metadata } from '@/ds/components/Metadata';
import { RotatingText } from '@/ds/components/RotatingText';
import { Spinner } from '@/ds/components/Spinner';
import { formatDuration } from '@/utils/duration';

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
          <Metadata className="justify-center tabular-nums">
            <Metadata.Item>
              {finishedCount} / {totalItems} {noun} finished
            </Metadata.Item>
            {elapsed && <Metadata.Item>{elapsed} elapsed</Metadata.Item>}
          </Metadata>
        </span>
      }
    />
  );
}
