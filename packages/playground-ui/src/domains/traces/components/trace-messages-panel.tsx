import { TraceThreadItemView } from '@/domains/traces/components/trace-thread-item-view';
import type { TraceThreadItemViewProps } from '@/domains/traces/components/trace-thread-item-view';
import { cn } from '@/utils/cn';

export type TraceMessagesPanelProps = TraceThreadItemViewProps;

/** The "Messages" view of the trace side column: the trace rendered as one reconstructed agent turn. */
export function TraceMessagesPanel({ className, ...props }: TraceMessagesPanelProps) {
  return (
    <div data-testid="messages-panel" className={cn('flex h-full min-h-0 flex-col', className)}>
      <TraceThreadItemView {...props} />
    </div>
  );
}
