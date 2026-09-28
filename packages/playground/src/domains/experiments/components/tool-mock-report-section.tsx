import type { ToolMockReport } from '@mastra/client-js';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { InlineCode } from '@mastra/playground-ui/components/InlineCode';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
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
      <DataPanel.SectionHeading icon={<WrenchIcon />}>Tool Mocks</DataPanel.SectionHeading>

      {failure && (
        <Notice variant="destructive" title="Mock mismatch">
          <Notice.Message>
            <span className="block">
              {`Tool "${failure.toolName}" was called with arguments that did not match an available mock (${failure.code}).`}
            </span>
            <span className="mt-1 block text-caption">
              Called with: <InlineCode>{formatArgs(failure.args)}</InlineCode>
            </span>
            {unconsumed.length > 0 && (
              <span className="mt-1 block text-caption">
                Unconsumed mocks: <InlineCode>{unconsumed.map(u => formatArgs(u.args)).join(', ')}</InlineCode>
              </span>
            )}
          </Notice.Message>
        </Notice>
      )}

      <div className="divide-y divide-border rounded border border-border text-body">
        {rows.map((row, i) => (
          <div
            key={`${row.outcome}-${row.toolName}-${i}`}
            className="flex items-center justify-between gap-2 px-3 py-1.5"
          >
            <span className="min-w-0 truncate">
              <Txt as="span" variant="body-sm" tone="muted" font="mono">
                {row.toolName}
              </Txt>
              <Txt as="span" variant="caption" tone="muted" font="mono" className="ml-2">
                {formatArgs(row.args)}
              </Txt>
            </span>
            <span className={`shrink-0 rounded px-2 py-0.5 text-caption ${outcomeClass(row.outcome)}`}>
              {row.outcome}
            </span>
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
      return 'bg-muted-foreground/10 text-muted-foreground';
  }
}
