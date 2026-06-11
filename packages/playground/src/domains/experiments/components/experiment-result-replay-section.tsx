import type { ToolReplayReport } from '@mastra/client-js';
import { Button, Chip, DataKeysAndValues, DataPanel, TraceIcon } from '@mastra/playground-ui';
import { HistoryIcon } from 'lucide-react';
import { classifyReplayDivergence } from '../utils/tool-replay';

export type ExperimentResultReplaySectionProps = {
  report: ToolReplayReport;
  onShowSourceTrace?: (traceId: string) => void;
};

/**
 * Per-item divergence report: how far this run drifted from the recording.
 * Read the item's scores through this — a clean report means the grade is
 * fully comparable to the baseline.
 */
export function ExperimentResultReplaySection({ report, onShowSourceTrace }: ExperimentResultReplaySectionProps) {
  const isClean = classifyReplayDivergence(report) === 'clean' && report.replayedCount === report.totalRecorded;

  return (
    <div className="grid gap-2">
      <DataPanel.SectionHeading icon={<HistoryIcon />} className="mb-2">
        Tool Replay
      </DataPanel.SectionHeading>

      <div className="flex flex-wrap items-center gap-1.5">
        <Chip color={isClean ? 'green' : 'gray'}>{`replayed ${report.replayedCount}/${report.totalRecorded}`}</Chip>
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
