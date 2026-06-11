import type { ExperimentStatus } from '@mastra/core/storage';
import { Button, Chip, Spinner, Txt } from '@mastra/playground-ui';
import { GitCompareArrows, HistoryIcon } from 'lucide-react';
import type { ReplayAggregates, ReplayItemFlow } from '../hooks/use-replay-aggregates';
import type { ToolReplayCallsSummary, ToolReplayMarker } from '../utils/tool-replay';
import { formatMockedToolNames, getCallOutcomeView } from '../utils/tool-replay';
import { useLinkComponent } from '@/lib/framework';

export type ExperimentReplaySummaryProps = {
  marker: ToolReplayMarker;
  /** The replay experiment's own id — contender side of "Compare with source". */
  experimentId: string;
  datasetId?: string | null;
  aggregates?: ReplayAggregates;
  isLoading: boolean;
  experimentStatus?: ExperimentStatus;
  /** Opens one item's result panel (Results tab) from the flow table. */
  onSelectResult?: (resultId: string) => void;
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
  onSelectResult,
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
        {marker.onMiss && (
          <Txt variant="ui-sm" className="text-neutral3">
            · on miss: {marker.onMiss}
          </Txt>
        )}
        {marker.matching && (
          <Txt variant="ui-sm" className="text-neutral3">
            · matching: {marker.matching}
          </Txt>
        )}
        {marker.mockedTools && marker.mockedTools.length > 0 && (
          <Txt variant="ui-sm" className="text-neutral3">
            · mocked: {formatMockedToolNames(marker.mockedTools)}
          </Txt>
        )}
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
          {aggregates.withFailedExpectations > 0 && (
            <Chip color="red">{`${aggregates.withFailedExpectations} failed expectations`}</Chip>
          )}
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

      {aggregates && aggregates.callTotals.total > 0 && (
        <div className="grid gap-1.5" data-testid="replay-flow-graph">
          <Txt variant="ui-sm" className="text-neutral4">
            {formatExperimentCallsVerdict(aggregates.callTotals, aggregates.itemFlows.length)}
          </Txt>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface4">
            {flowBarSegments(aggregates.callTotals).map(segment => (
              <div
                key={segment.key}
                className={segment.barClassName}
                style={{ width: `${(segment.count / aggregates.callTotals.total) * 100}%` }}
                title={`${segment.count} ${segment.label}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-ui-xs text-neutral3">
            {flowBarSegments(aggregates.callTotals).map(segment => (
              <span key={segment.key}>
                <span className={segment.glyphClassName}>{segment.glyph}</span> {segment.count} {segment.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {aggregates && aggregates.itemFlows.length > 0 && (
        <div className="grid gap-0.5" data-testid="replay-flow-table">
          <Txt variant="ui-xs" className="text-neutral2 uppercase tracking-widest mb-1">
            Run flow per item
          </Txt>
          {aggregates.itemFlows.slice(0, MAX_FLOW_ROWS).map(flow => (
            <button
              key={flow.resultId}
              type="button"
              onClick={() => onSelectResult?.(flow.resultId)}
              aria-label={`Open result for item ${flow.itemId}`}
              className="grid grid-cols-[6rem_auto_1fr] items-center gap-3 rounded-md px-2 py-1 text-left hover:bg-surface4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent1"
            >
              <span className="font-mono text-ui-smd text-neutral3 truncate">{flow.itemId.slice(0, 8)}</span>
              <span
                role="img"
                aria-label={flow.hasError ? 'Error' : 'Success'}
                className={`w-2 h-2 rounded-full ${flow.hasError ? 'bg-red-700' : 'bg-green-600'}`}
              />
              <span className="font-mono text-ui-smd tracking-[0.2em] truncate">
                {flow.outcomes.length === 0 ? (
                  <span className="text-neutral2 tracking-normal">no tool calls</span>
                ) : (
                  <>
                    {flow.outcomes.slice(0, MAX_FLOW_GLYPHS).map((call, i) => (
                      <FlowGlyph key={i} call={call} />
                    ))}
                    {flow.outcomes.length > MAX_FLOW_GLYPHS && (
                      <span className="text-neutral3 tracking-normal"> +{flow.outcomes.length - MAX_FLOW_GLYPHS}</span>
                    )}
                  </>
                )}
              </span>
            </button>
          ))}
          {aggregates.itemFlows.length > MAX_FLOW_ROWS && (
            <Txt variant="ui-xs" className="text-neutral3 px-2">
              Showing the first {MAX_FLOW_ROWS} of {aggregates.itemFlows.length} items — the Results tab has them all.
            </Txt>
          )}
        </div>
      )}

      {isRunning && (
        <Txt variant="ui-xs" className="text-neutral3">
          Experiment in progress — groundedness updates live.
        </Txt>
      )}
    </div>
  );
}

const MAX_FLOW_ROWS = 30;
const MAX_FLOW_GLYPHS = 24;

/** "12 tool calls across 4 items — 8 replayed (2 with different args) · 2 mocked · 1 missed · 1 ran live" */
function formatExperimentCallsVerdict(totals: ToolReplayCallsSummary, itemCount: number): string {
  const segments: string[] = [];
  if (totals.replayed > 0) {
    const drift = totals.replayedWithDrift > 0 ? ` (${totals.replayedWithDrift} with different args)` : '';
    segments.push(`${totals.replayed} replayed${drift}`);
  }
  if (totals.mocked > 0) segments.push(`${totals.mocked} mocked`);
  if (totals.missed > 0) segments.push(`${totals.missed} missed`);
  if (totals.live > 0) segments.push(`${totals.live} ran live`);
  const head = `${totals.total} tool call${totals.total === 1 ? '' : 's'} across ${itemCount} item${itemCount === 1 ? '' : 's'}`;
  return segments.length > 0 ? `${head} — ${segments.join(' · ')}` : head;
}

type FlowBarSegment = {
  key: string;
  count: number;
  label: string;
  glyph: string;
  glyphClassName: string;
  barClassName: string;
};

/** Non-zero outcome buckets in display order — drives both the stacked bar and its legend. */
function flowBarSegments(totals: ToolReplayCallsSummary): FlowBarSegment[] {
  const cleanReplays = totals.replayed - totals.replayedWithDrift;
  return [
    {
      key: 'replayed',
      count: cleanReplays,
      label: 'replayed',
      glyph: '✓',
      glyphClassName: 'text-green-400',
      barClassName: 'bg-green-400',
    },
    {
      key: 'drift',
      count: totals.replayedWithDrift,
      label: 'args differed',
      glyph: '✓',
      glyphClassName: 'text-yellow-400',
      barClassName: 'bg-yellow-400',
    },
    {
      key: 'mocked',
      count: totals.mocked,
      label: 'mocked',
      glyph: 'Ⓜ',
      glyphClassName: 'text-purple-400',
      barClassName: 'bg-purple-400',
    },
    {
      key: 'missed',
      count: totals.missed,
      label: 'missed',
      glyph: '✗',
      glyphClassName: 'text-red-400',
      barClassName: 'bg-red-400',
    },
    {
      key: 'live',
      count: totals.live,
      label: 'ran live',
      glyph: '⚡',
      glyphClassName: 'text-blue-400',
      barClassName: 'bg-blue-400',
    },
  ].filter(segment => segment.count > 0);
}

/** One call in an item's flow row — drifted replays render yellow to match the bar. */
function FlowGlyph({ call }: { call: ReplayItemFlow['outcomes'][number] }) {
  const view = getCallOutcomeView(call.outcome);
  const className = call.argsDiffered && call.outcome === 'replayed' ? 'text-yellow-400' : view.glyphClassName;
  const title = `${view.label || call.outcome}${call.argsDiffered ? ' · args differed' : ''}${view.note ? ` · ${view.note}` : ''}`;
  return (
    <span className={className} title={title}>
      {view.glyph}
    </span>
  );
}
