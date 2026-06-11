import type { ToolReplayReport } from '@mastra/client-js';
import {
  Button,
  Chip,
  DataKeysAndValues,
  DataPanel,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TraceIcon,
  cn,
} from '@mastra/playground-ui';
import { HistoryIcon } from 'lucide-react';
import { useMemo } from 'react';
import type { ReplayTapeSpan } from '../utils/tool-replay';
import { buildReplayTape, classifyReplayDivergence } from '../utils/tool-replay';

export type ExperimentResultReplaySectionProps = {
  report: ToolReplayReport;
  onShowSourceTrace?: (traceId: string, spanId?: string) => void;
  /** Source-trace spans (light) — enables the per-tool tape view when provided. */
  sourceTraceSpans?: ReplayTapeSpan[];
};

/**
 * Per-item divergence report: how far this run drifted from the recording.
 * Read the item's scores through this — a clean report means the grade is
 * fully comparable to the baseline.
 */
export function ExperimentResultReplaySection({
  report,
  onShowSourceTrace,
  sourceTraceSpans,
}: ExperimentResultReplaySectionProps) {
  const isEmptyRecording = report.totalRecorded === 0;
  const isClean =
    !isEmptyRecording && classifyReplayDivergence(report) === 'clean' && report.replayedCount === report.totalRecorded;
  const tape = useMemo(
    () => (sourceTraceSpans && !isEmptyRecording ? buildReplayTape(sourceTraceSpans, report) : null),
    [sourceTraceSpans, report, isEmptyRecording],
  );

  return (
    <div className="grid gap-2">
      <DataPanel.SectionHeading icon={<HistoryIcon />} className="mb-2">
        Tool Replay
      </DataPanel.SectionHeading>

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

      {isEmptyRecording && (
        <p className="text-ui-sm text-neutral3">
          The source run never called any tools — there was nothing to replay, so the model ran with no frozen
          observations. To exercise replay, record a baseline where the agent actually uses its tools.
        </p>
      )}

      {tape && tape.length > 0 && (
        <div className="grid gap-1.5 rounded-lg border border-border1 bg-surface3/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-ui-xs uppercase tracking-widest text-neutral2">Recording tape (FIFO per tool)</span>
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
