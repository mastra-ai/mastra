import {
  Button,
  Chip,
  DataKeysAndValues,
  DataList,
  DataPanel,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TraceIcon,
  cn,
} from '@mastra/playground-ui';
import { HistoryIcon } from 'lucide-react';
import { useMemo } from 'react';
import type {
  ReplayTapeSpan,
  ToolReplayCallsSummary,
  ToolReplayMatching,
  ToolReplayMockKind,
  ToolReplayReportExtended,
} from '../utils/tool-replay';
import {
  buildReplayTape,
  classifyReplayDivergence,
  summarizeReplayCalls,
  CALL_OUTCOME_VIEWS,
  UNKNOWN_CALL_OUTCOME_VIEW,
} from '../utils/tool-replay';

export type ExperimentResultReplaySectionProps = {
  report: ToolReplayReportExtended;
  onShowSourceTrace?: (traceId: string, spanId?: string) => void;
  /** Source-trace spans (light) — enables the per-tool tape view when provided. */
  sourceTraceSpans?: ReplayTapeSpan[];
  /** The run's matching policy (from the experiment marker) — labels the verdict and the tape. */
  matching?: ToolReplayMatching;
};

const MOCK_KIND_LABELS: Record<ToolReplayMockKind, string> = {
  output: 'stub',
  error: 'error',
  function: 'function',
  observe: 'observed',
};

/** "4 tool calls — 2 replayed (1 with different args) · 1 mocked · 1 ran live" (zero-count segments are skipped). */
function formatReplayCallsVerdict(summary: ToolReplayCallsSummary): string {
  const segments: string[] = [];
  if (summary.replayed > 0) {
    const drift = summary.replayedWithDrift > 0 ? ` (${summary.replayedWithDrift} with different args)` : '';
    segments.push(`${summary.replayed} replayed${drift}`);
  }
  if (summary.mocked > 0) segments.push(`${summary.mocked} mocked`);
  if (summary.missed > 0) segments.push(`${summary.missed} missed`);
  if (summary.live > 0) segments.push(`${summary.live} ran live`);
  const head = `${summary.total} tool call${summary.total === 1 ? '' : 's'}`;
  return segments.length > 0 ? `${head} — ${segments.join(' · ')}` : head;
}

/**
 * Per-item divergence report: how far this run drifted from the recording.
 * Read the item's scores through this — a clean report means the grade is
 * fully comparable to the baseline.
 */
export function ExperimentResultReplaySection({
  report,
  onShowSourceTrace,
  sourceTraceSpans,
  matching,
}: ExperimentResultReplaySectionProps) {
  const isEmptyRecording = report.totalRecorded === 0;
  const isClean =
    !isEmptyRecording && classifyReplayDivergence(report) === 'clean' && report.replayedCount === report.totalRecorded;
  const tape = useMemo(
    () => (sourceTraceSpans && !isEmptyRecording ? buildReplayTape(sourceTraceSpans, report) : null),
    [sourceTraceSpans, report, isEmptyRecording],
  );
  // Older rows predate the call-flow field — they render no verdict and no run-flow table.
  const callsSummary = useMemo(() => summarizeReplayCalls(report), [report]);
  const calls = callsSummary && callsSummary.total > 0 ? report.calls! : null;

  return (
    <div className="grid gap-2">
      <DataPanel.SectionHeading icon={<HistoryIcon />} className="mb-2">
        Tool Replay
      </DataPanel.SectionHeading>

      {callsSummary && (
        <p className="text-ui-sm text-neutral3">
          {formatReplayCallsVerdict(callsSummary)}
          {matching === 'strict' ? ' · strict args matching' : ''}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {isEmptyRecording ? (
          <Chip color="gray">no recorded tool calls</Chip>
        ) : (
          <Chip color={isClean ? 'green' : 'gray'}>{`replayed ${report.replayedCount}/${report.totalRecorded}`}</Chip>
        )}
        {report.misses.length > 0 && <Chip color="orange">{`${report.misses.length} misses`}</Chip>}
        {report.unconsumed.length > 0 && (
          <Chip color="blue">{`${report.unconsumed.reduce((sum, u) => sum + u.count, 0)} unconsumed`}</Chip>
        )}
        {report.argMismatches.length > 0 && (
          <Chip color="yellow">{`${report.argMismatches.length} arg mismatches`}</Chip>
        )}
        {report.staleRecording && <Chip color="gray">stale recording</Chip>}
        {(report.redactedPayloadCount ?? 0) > 0 && (
          <Chip color="gray">{`${report.redactedPayloadCount} redacted payloads`}</Chip>
        )}
      </div>

      {report.mocks && report.mocks.length > 0 && (
        <div className="grid gap-1.5">
          <span className="text-ui-xs uppercase tracking-widest text-neutral2">Mocked tools</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {report.mocks.map((mock, i) => (
              <Tooltip key={`${mock.toolName}-${i}`}>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Chip color="purple">{`${mock.toolName} · ${mock.calls} call${mock.calls === 1 ? '' : 's'}`}</Chip>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Mock kind: {MOCK_KIND_LABELS[mock.kind] ?? mock.kind}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      {report.expectations && report.expectations.length > 0 && (
        <div className="grid gap-1.5">
          <span className="text-ui-xs uppercase tracking-widest text-neutral2">Expectations</span>
          <ul className="grid gap-1">
            {report.expectations.map((expectation, i) => (
              <li
                key={`${expectation.toolName}-${i}`}
                className="flex flex-wrap items-center gap-2 text-ui-sm text-neutral4"
              >
                <Chip color={expectation.satisfied ? 'green' : 'red'}>
                  {`${expectation.satisfied ? '✓' : '✗'} ${expectation.toolName}`}
                </Chip>
                {!expectation.satisfied && expectation.reason && <span>{expectation.reason}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isEmptyRecording &&
        (report.mocks && report.mocks.length > 0 ? (
          <p className="text-ui-sm text-neutral3">
            Tools were mocked — no recording involved. Mock answers are listed above.
          </p>
        ) : (
          <p className="text-ui-sm text-neutral3">
            The source run never called any tools — there was nothing to replay, so the model ran with no frozen
            observations. To exercise replay, record a baseline where the agent actually uses its tools.
          </p>
        ))}

      {calls && (
        <div data-testid="replay-run-flow" className="grid gap-1.5">
          {/* The RUN's perspective: every call the new run made, in arrival order. */}
          <span className="text-ui-xs uppercase tracking-widest text-neutral2">Run flow</span>
          <DataList columns="max-content minmax(0, 1fr) max-content minmax(0, 1.5fr)">
            <DataList.Top>
              <DataList.TopCell>#</DataList.TopCell>
              <DataList.TopCell>Tool</DataList.TopCell>
              <DataList.TopCell>Outcome</DataList.TopCell>
              <DataList.TopCell>Notes</DataList.TopCell>
            </DataList.Top>
            {calls.map(call => {
              const view = CALL_OUTCOME_VIEWS[call.outcome] ?? UNKNOWN_CALL_OUTCOME_VIEW;
              const tapeRef = typeof call.sequence === 'number' ? `tape #${call.sequence + 1}` : null;
              const note = [tapeRef, view.note].filter(Boolean).join(' · ');
              return (
                <DataList.RowStatic key={call.order}>
                  <DataList.MonoCell>{call.order + 1}</DataList.MonoCell>
                  <DataList.MonoCell className="text-neutral5">{call.toolName}</DataList.MonoCell>
                  <DataList.Cell height="compact" className="text-ui-sm text-neutral4">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span aria-hidden="true" className={cn('font-mono', view.glyphClassName)}>
                        {view.glyph}
                      </span>
                      <span className="truncate">{view.label || call.outcome}</span>
                    </span>
                  </DataList.Cell>
                  <DataList.Cell height="compact" className="text-ui-sm text-neutral3">
                    {note || call.argsDiffered ? (
                      <span className="min-w-0 truncate">
                        {note}
                        {call.argsDiffered && <span className="text-amber-400">{note ? ' · ' : ''}args differed</span>}
                      </span>
                    ) : null}
                  </DataList.Cell>
                </DataList.RowStatic>
              );
            })}
          </DataList>
        </div>
      )}

      {tape && tape.length > 0 && (
        <div className="grid gap-1.5 rounded-lg border border-border1 bg-surface3/50 p-3">
          <div className="flex items-center justify-between gap-2">
            {/* The RECORDING's perspective: what was on the tape and what became of it. */}
            <span className="text-ui-xs uppercase tracking-widest text-neutral2">
              {`Recording (tape) · ${matching === 'strict' ? 'strict args matching' : 'FIFO per tool'}`}
            </span>
            <span className="text-ui-xs text-neutral2">
              ✓ replayed · ≈ args differed · ○ never requested · + new call
            </span>
          </div>
          {tape.map(tool => (
            <div key={tool.toolName} className="flex items-center gap-2 min-w-0">
              <span className="text-ui-sm text-neutral5 font-mono truncate shrink-0 max-w-[40%]">{tool.toolName}</span>
              <div className="flex flex-wrap items-center gap-1">
                {tool.events.map(event => {
                  const symbol = event.status === 'replayed' ? '✓' : event.status === 'arg-mismatch' ? '≈' : '○';
                  const label =
                    event.status === 'replayed'
                      ? 'Replayed — the recorded answer was served'
                      : event.status === 'arg-mismatch'
                        ? 'Replayed, but the call asked with different args — click to inspect the recorded call'
                        : matching === 'strict'
                          ? 'Never consumed — no call matched these args exactly (left in the queue)'
                          : 'Never requested by the new run (left in the queue)';
                  return (
                    <Tooltip key={event.spanId}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={
                            onShowSourceTrace && report.sourceTraceId
                              ? () => onShowSourceTrace(report.sourceTraceId!, event.spanId)
                              : undefined
                          }
                          className={cn(
                            'h-6 min-w-6 px-1 rounded-md border text-ui-xs font-mono transition-colors',
                            event.status === 'replayed' && 'border-green-700/50 bg-green-500/15 text-neutral5',
                            event.status === 'arg-mismatch' && 'border-yellow-600/50 bg-yellow-500/20 text-neutral5',
                            event.status === 'unconsumed' && 'border-border2 bg-transparent text-neutral3',
                            onShowSourceTrace && 'hover:bg-surface5 cursor-pointer',
                          )}
                        >
                          {symbol}
                          {event.sequence}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{label}</TooltipContent>
                    </Tooltip>
                  );
                })}
                {tool.misses.map((miss, i) => (
                  <Tooltip key={`miss-${i}`}>
                    <TooltipTrigger asChild>
                      <span className="h-6 min-w-6 px-1 inline-flex items-center justify-center rounded-md border border-orange-600/50 bg-orange-500/20 text-ui-xs font-mono text-neutral5">
                        +{miss.action === 'passthrough' ? 'live' : 'stop'}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {miss.action === 'passthrough'
                        ? 'New call beyond the recording — the live tool executed'
                        : 'New call beyond the recording — the item stopped here'}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {(report.misses.length > 0 || report.unconsumed.length > 0 || report.argMismatches.length > 0) && (
        <ul className="grid gap-1 text-ui-sm text-neutral4">
          {report.misses.map((miss, i) => (
            <li key={`miss-${i}`}>
              <span className="text-neutral5">{miss.toolName}</span> — no recorded event left (
              {miss.action === 'passthrough' ? 'ran live' : 'item stopped'})
              {miss.input !== undefined && (
                <>
                  {' '}
                  · called with <span className="font-mono text-neutral3">{formatMissArgs(miss.input)}</span>
                </>
              )}
            </li>
          ))}
          {report.unconsumed.map((entry, i) => (
            <li key={`unconsumed-${i}`}>
              <span className="text-neutral5">{entry.toolName}</span> — {entry.count} recorded answer
              {entry.count > 1 ? 's' : ''} never requested
            </li>
          ))}
          {report.argMismatches.map((mismatch, i) => (
            <li key={`mismatch-${i}`}>
              <span className="text-neutral5">{mismatch.toolName}</span> — args differed from the recording (event #
              {mismatch.sequence})
            </li>
          ))}
        </ul>
      )}

      {report.sourceTraceId && (
        <div className="flex items-center justify-between gap-2">
          <DataKeysAndValues>
            <DataKeysAndValues.Key>Source trace</DataKeysAndValues.Key>
            <DataKeysAndValues.ValueWithCopyBtn copyTooltip="Copy source trace id" copyValue={report.sourceTraceId}>
              {report.sourceTraceId}
            </DataKeysAndValues.ValueWithCopyBtn>
          </DataKeysAndValues>
          {onShowSourceTrace && (
            <Button size="sm" onClick={() => onShowSourceTrace(report.sourceTraceId!)}>
              <TraceIcon />
              View source trace
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Compact args for the misses list — under strict matching this is the rejected call's input. */
function formatMissArgs(input: unknown): string {
  let text: string;
  try {
    text = JSON.stringify(input) ?? String(input);
  } catch {
    text = String(input);
  }
  return text.length > 120 ? `${text.slice(0, 119)}…` : text;
}
