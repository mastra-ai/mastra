import type { ExperimentStatus } from '@mastra/core/storage';
import { Button, Chip, Spinner, Txt, cn } from '@mastra/playground-ui';
import { GitCompareArrows, HistoryIcon } from 'lucide-react';
import type { ReplayAggregates, ReplayItemFlow } from '../hooks/use-replay-aggregates';
import { REPLAY_AGGREGATES_ITEM_CAP } from '../hooks/use-replay-aggregates';
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

  // Mock-only runs (mocks always answer — no miss policy) have no recording,
  // so groundedness language is noise: the card leads with mock usage and
  // expectations instead. Replay (and replay+mock) runs keep the full
  // groundedness layout.
  const isMockOnly = Boolean(marker.mockedTools?.length) && !marker.onMiss;

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
          {isMockOnly ? 'Tool Mocks' : 'Tool Replay'}
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
            {isMockOnly ? 'Computing mock usage…' : 'Computing groundedness…'}
          </Txt>
        </div>
      ) : aggregates ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {isMockOnly ? (
            // Mock-only leads: did the asserted expectations hold, and how many
            // calls the mocks answered — there is no recording to be grounded on.
            <>
              {aggregates.totalExpectations > 0 && (
                <Chip
                  color={aggregates.satisfiedExpectations === aggregates.totalExpectations ? 'green' : 'red'}
                >{`expectations satisfied ${aggregates.satisfiedExpectations}/${aggregates.totalExpectations}`}</Chip>
              )}
              {aggregates.callTotals.mocked > 0 && (
                <Chip color="purple">{`${aggregates.callTotals.mocked} calls answered by mocks`}</Chip>
              )}
            </>
          ) : (
            (() => {
              // Items with an empty recording can't be grounded — keep them out
              // of the denominator so the headline ratio stays honest, and color
              // by the ratio itself (a 0/2 must never read as green).
              const gradedTotal = aggregates.total - aggregates.emptyRecordings;
              if (gradedTotal <= 0) return null;
              const color =
                aggregates.fullyGrounded === gradedTotal ? 'green' : aggregates.fullyGrounded > 0 ? 'yellow' : 'red';
              return <Chip color={color}>{`${aggregates.fullyGrounded}/${gradedTotal} fully grounded`}</Chip>;
            })()
          )}
          {aggregates.withFailedExpectations > 0 && (
            <Chip color="red">{`${aggregates.withFailedExpectations} failed expectations`}</Chip>
          )}
          {aggregates.withMisses > 0 && <Chip color="orange">{`${aggregates.withMisses} with misses`}</Chip>}
          {aggregates.withUnconsumed > 0 && <Chip color="blue">{`${aggregates.withUnconsumed} with unconsumed`}</Chip>}
          {aggregates.withArgMismatches > 0 && (
            <Chip color="yellow">{`${aggregates.withArgMismatches} with arg mismatches`}</Chip>
          )}
          {aggregates.failedReplay > 0 && <Chip color="red">{`${aggregates.failedReplay} failed (replay)`}</Chip>}
          {/* Mock-only runs have no tape at all — "without recorded tool calls" is vacuously true for every item. */}
          {!isMockOnly && aggregates.emptyRecordings > 0 && (
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

      {aggregates?.partial && (
        <Txt variant="ui-xs" className="text-neutral3">
          Summary over the first {REPLAY_AGGREGATES_ITEM_CAP} items — final after completion.
        </Txt>
      )}

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
              // The glyph strip is aria-hidden — this label is the row's whole
              // accessible story, so it carries the outcome counts (with
              // miss-passthrough as its own "ran live on a miss" bucket).
              aria-label={`Open result for item ${flow.itemId} — ${formatFlowOutcomesLabel(flow.outcomes)}`}
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
                      <span aria-hidden="true" className="text-neutral3 tracking-normal">
                        {' '}
                        +{flow.outcomes.length - MAX_FLOW_GLYPHS}
                      </span>
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
          {isMockOnly
            ? 'Experiment in progress — mock usage updates live.'
            : 'Experiment in progress — groundedness updates live.'}
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

/**
 * "2 replayed, 1 mocked, 1 ran live on a miss" — accessible counts for one
 * item's flow row. Miss-passthrough is its own bucket so screen readers can
 * tell a passthrough beyond a recording from a regular unmocked live call.
 */
function formatFlowOutcomesLabel(outcomes: ReplayItemFlow['outcomes']): string {
  if (outcomes.length === 0) return 'no tool calls';
  const counts = { replayed: 0, mocked: 0, missed: 0, missPassthrough: 0, live: 0 };
  for (const call of outcomes) {
    switch (call.outcome) {
      case 'replayed':
      case 'replayed-error':
        counts.replayed += 1;
        break;
      case 'mocked':
      case 'mock-error':
        counts.mocked += 1;
        break;
      case 'miss-error':
        counts.missed += 1;
        break;
      case 'miss-passthrough':
        counts.missPassthrough += 1;
        break;
      case 'live':
        counts.live += 1;
        break;
    }
  }
  const segments: string[] = [];
  if (counts.replayed > 0) segments.push(`${counts.replayed} replayed`);
  if (counts.mocked > 0) segments.push(`${counts.mocked} mocked`);
  if (counts.missed > 0) segments.push(`${counts.missed} missed`);
  if (counts.missPassthrough > 0) segments.push(`${counts.missPassthrough} ran live on a miss`);
  if (counts.live > 0) segments.push(`${counts.live} ran live`);
  // Reports come from storage — unknown future outcomes still get a count.
  return segments.length > 0 ? segments.join(', ') : `${outcomes.length} tool call${outcomes.length === 1 ? '' : 's'}`;
}

/**
 * One call in an item's flow row — drifted replays render yellow to match the
 * bar. Glyphs are decorative (aria-hidden): the row's aria-label carries the
 * counts. Miss-passthrough shares the ⚡ glyph with live but is set apart
 * beyond color by a dotted underline, plus its distinct title.
 */
function FlowGlyph({ call }: { call: ReplayItemFlow['outcomes'][number] }) {
  const view = getCallOutcomeView(call.outcome);
  const className = call.argsDiffered && call.outcome === 'replayed' ? 'text-yellow-400' : view.glyphClassName;
  const title = `${view.label || call.outcome}${call.argsDiffered ? ' · args differed' : ''}${view.note ? ` · ${view.note}` : ''}`;
  return (
    <span
      aria-hidden="true"
      className={cn(call.outcome === 'miss-passthrough' && 'underline decoration-dotted underline-offset-2', className)}
      title={title}
    >
      {view.glyph}
    </span>
  );
}
