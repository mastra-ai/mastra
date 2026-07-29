import type { ToolMockReport } from '@mastra/client-js';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { WrenchIcon } from 'lucide-react';

export interface ToolMockReportSectionProps {
  report: ToolMockReport;
}

type ReportRow = { outcome: 'served' | 'live' | 'unconsumed'; toolName: string; args: unknown };

function formatArgs(args: unknown): string {
  try {
    return JSON.stringify(args ?? {});
  } catch {
    return String(args);
  }
}

/**
 * Diagnostics panel for item-level tool mocks on an experiment result.
 *
 * Surfaces what the run did with the item's static mocks:
 * - served: mocks matched and returned to the agent
 * - live: unmocked tools that ran live (non-deterministic)
 * - unconsumed: mocks declared but never used (report-only; does not fail the item)
 * - failure: the mock mis-call that failed the item, if any
 */
export function ToolMockReportSection({ report }: ToolMockReportSectionProps) {
  const { served, unconsumed, liveCalls, failure } = report;

  const rows: ReportRow[] = [
    ...served.map(s => ({ outcome: 'served' as const, toolName: s.toolName, args: s.args })),
    ...liveCalls.map(c => ({ outcome: 'live' as const, toolName: c.toolName, args: c.args })),
    ...unconsumed.map(u => ({ outcome: 'unconsumed' as const, toolName: u.toolName, args: u.args })),
  ];

  return (
    <div className="grid gap-2" data-testid="tool-mock-report">
      <DataPanel.SectionHeading icon={<WrenchIcon />} className="mb-2">
        Tool Mocks
      </DataPanel.SectionHeading>

      {failure && (
        <Notice variant="destructive" title="Mock mismatch">
          <Notice.Message>
            <span className="block">
              {`Tool "${failure.toolName}" was called with arguments that did not match an available mock (${failure.code}).`}
            </span>
            <span className="mt-1 block font-mono text-xs">Called with: {formatArgs(failure.args)}</span>
            {unconsumed.length > 0 && (
              <span className="mt-1 block font-mono text-xs">
                Unconsumed mocks: {unconsumed.map(u => formatArgs(u.args)).join(', ')}
              </span>
            )}
          </Notice.Message>
        </Notice>
      )}

      <div className="border-border1 divide-border1 divide-y rounded border text-sm">
        {rows.map((row, i) => (
          <div
            key={`${row.outcome}-${row.toolName}-${i}`}
            className="flex items-center justify-between gap-2 px-3 py-1.5"
          >
            <span className="min-w-0 truncate">
              <span className="text-neutral4 font-mono">{row.toolName}</span>
              <span className="text-neutral3 ml-2 font-mono text-xs">{formatArgs(row.args)}</span>
            </span>
            <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${outcomeClass(row.outcome)}`}>{row.outcome}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function outcomeClass(outcome: ReportRow['outcome']): string {
  switch (outcome) {
    case 'served':
      return 'bg-accent1/10 text-accent1';
    case 'live':
      return 'bg-orange-500/10 text-orange-400';
    case 'unconsumed':
      return 'bg-neutral3/10 text-neutral4';
  }
}
