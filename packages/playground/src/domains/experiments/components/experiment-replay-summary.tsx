import type { ExperimentStatus } from '@mastra/core/storage';
import { Button, Chip, Spinner, Txt } from '@mastra/playground-ui';
import { GitCompareArrows, HistoryIcon } from 'lucide-react';
import type { ReplayAggregates } from '../hooks/use-replay-aggregates';
import type { ToolReplayMarker } from '../utils/tool-replay';
import { useLinkComponent } from '@/lib/framework';

export type ExperimentReplaySummaryProps = {
  marker: ToolReplayMarker;
  /** The replay experiment's own id — contender side of "Compare with source". */
  experimentId: string;
  datasetId?: string | null;
  aggregates?: ReplayAggregates;
  isLoading: boolean;
  experimentStatus?: ExperimentStatus;
};

/**
 * Groundedness summary for a replay experiment: how many items stayed fully
 * on the recording vs diverged. Scores should always be read through these
 * numbers — a grade over a diverged run is not comparable to its baseline.
 */
export function ExperimentReplaySummary({
  marker,
  experimentId,
  datasetId,
  aggregates,
  isLoading,
  experimentStatus,
}: ExperimentReplaySummaryProps) {
  const { Link: LinkComponent, paths } = useLinkComponent();
  const isRunning = experimentStatus === 'running' || experimentStatus === 'pending';

  const sourceHref = marker.fromExperimentId
    ? datasetId
      ? paths.datasetExperimentLink(datasetId, marker.fromExperimentId)
      : paths.experimentLink(marker.fromExperimentId)
    : null;

  // Side-by-side comparison view (CompareDatasetExperimentsPage) with the
  // source experiment as baseline and this replay as contender. The route is
  // dataset-scoped, so without a datasetId there is nothing to link to.
  const compareHref =
    marker.fromExperimentId && datasetId
      ? `/datasets/${datasetId}/experiments?baseline=${marker.fromExperimentId}&contender=${experimentId}`
      : null;

  return (
    <div className="rounded-lg border border-border1 p-4 mb-5 grid gap-3">
      <div className="flex items-center gap-2">
        <HistoryIcon className="w-4 h-4 text-neutral3" />
        <Txt variant="ui-md" className="text-neutral5 font-medium">
          Tool Replay
        </Txt>
        {marker.fromExperimentId &&
          (sourceHref ? (
            <LinkComponent href={sourceHref} className="text-ui-sm text-accent1 hover:underline">
              source: {marker.fromExperimentId.slice(0, 8)}
            </LinkComponent>
          ) : (
            <Txt variant="ui-sm" className="text-neutral3">
              source: {marker.fromExperimentId.slice(0, 8)}
            </Txt>
          ))}
        <Txt variant="ui-sm" className="text-neutral3">
          · on miss: {marker.onMiss}
        </Txt>
        {compareHref && (
          <Button as={LinkComponent} href={compareHref} size="sm" className="ml-auto">
            <GitCompareArrows />
            Compare with source
          </Button>
        )}
      </div>

      {isLoading && !aggregates ? (
        <div className="flex items-center gap-2">
          <Spinner className="w-3 h-3" />
          <Txt variant="ui-sm" className="text-neutral3">
            Computing groundedness…
          </Txt>
        </div>
      ) : aggregates ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {(() => {
            // Items with an empty recording can't be grounded — keep them out
            // of the denominator so the headline ratio stays honest, and color
            // by the ratio itself (a 0/2 must never read as green).
            const gradedTotal = aggregates.total - aggregates.emptyRecordings;
            if (gradedTotal <= 0) return null;
            const color =
              aggregates.fullyGrounded === gradedTotal ? 'green' : aggregates.fullyGrounded > 0 ? 'yellow' : 'red';
            return <Chip color={color}>{`${aggregates.fullyGrounded}/${gradedTotal} fully grounded`}</Chip>;
          })()}
          {aggregates.withMisses > 0 && <Chip color="orange">{`${aggregates.withMisses} with misses`}</Chip>}
          {aggregates.withUnconsumed > 0 && <Chip color="blue">{`${aggregates.withUnconsumed} with unconsumed`}</Chip>}
          {aggregates.withArgMismatches > 0 && (
            <Chip color="yellow">{`${aggregates.withArgMismatches} with arg mismatches`}</Chip>
          )}
          {aggregates.failedReplay > 0 && <Chip color="red">{`${aggregates.failedReplay} failed (replay)`}</Chip>}
          {aggregates.emptyRecordings > 0 && (
            <Chip color="gray">{`${aggregates.emptyRecordings} without recorded tool calls`}</Chip>
          )}
          {aggregates.staleRecordings > 0 && (
            <Chip color="gray">{`${aggregates.staleRecordings} stale recordings`}</Chip>
          )}
          {aggregates.redactedPayloads > 0 && (
            <Chip color="gray">{`${aggregates.redactedPayloads} with redacted payloads`}</Chip>
          )}
        </div>
      ) : null}

      {isRunning && (
        <Txt variant="ui-xs" className="text-neutral3">
          Experiment in progress — groundedness updates live.
        </Txt>
      )}
    </div>
  );
}
