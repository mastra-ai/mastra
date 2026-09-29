import type { ComponentProps, ReactNode } from 'react';

import { useThreadTrace } from './thread-trace-context';
import { DataPanel } from '@/ds/components/DataPanel';
import { cn } from '@/lib/utils';

export interface ThreadTraceTracePanelProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** Trailing header controls (e.g. "Go to trace"), rendered before the close button. */
  actions?: (traceId: string) => ReactNode;
  /** Body of the column for the open trace, e.g. tabs holding `ThreadTrace.Spans`. */
  children: (traceId: string) => ReactNode;
}

/**
 * The trace column: the open turn's trace next to the conversation. The cell stays mounted
 * (empty) while no trace is open so the root grid can animate its column open and closed.
 */
export function ThreadTraceTracePanel({ actions, className, children, ...props }: ThreadTraceTracePanelProps) {
  const { openTraceId, openTrace, traceIds } = useThreadTrace();
  const turn = openTraceId ? traceIds.indexOf(openTraceId) + 1 : 0;

  return (
    <div
      data-slot="thread-trace-trace-panel"
      className={cn(
        'flex min-h-0 min-w-0 flex-col overflow-hidden',
        openTraceId && 'animate-in border-l border-border duration-300 fade-in-0',
        className,
      )}
      {...props}
    >
      {openTraceId && (
        // Keyed by trace so switching turns resets the tabs and the tree's scroll.
        <div key={openTraceId} className="flex min-h-0 flex-1 flex-col" data-testid="thread-trace-trace-panel">
          <DataPanel.Header className="border-b border-border">
            <DataPanel.HeaderContent>
              <DataPanel.Heading className="whitespace-nowrap">
                Turn {turn}
                <DataPanel.CopyId id={openTraceId} />
              </DataPanel.Heading>
            </DataPanel.HeaderContent>
            <DataPanel.HeaderActions>
              {actions?.(openTraceId)}
              <DataPanel.CloseButton icon="x" onClick={() => openTrace(null)} tooltip="Hide trace" label="Hide trace" />
            </DataPanel.HeaderActions>
          </DataPanel.Header>
          <div className="flex min-h-0 flex-1 flex-col">{children(openTraceId)}</div>
        </div>
      )}
    </div>
  );
}
