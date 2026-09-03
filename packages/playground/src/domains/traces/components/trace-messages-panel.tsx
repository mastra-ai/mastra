import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { cn } from '@mastra/playground-ui/utils/cn';

import { TraceThreadItemView } from '@/domains/traces/components/trace-thread-item-view';

export interface TraceMessagesPanelProps {
  traceId: string;
  className?: string;
}

/** The "Messages" column: the trace rendered as one reconstructed agent turn. */
export function TraceMessagesPanel({ traceId, className }: TraceMessagesPanelProps) {
  return (
    <DataPanel data-testid="messages-panel" className={cn('h-full rounded-none border-0 bg-transparent', className)}>
      <DataPanel.Header>
        <DataPanel.Heading>Messages</DataPanel.Heading>
      </DataPanel.Header>
      <DataPanel.Content>
        <TraceThreadItemView traceId={traceId} />
      </DataPanel.Content>
    </DataPanel>
  );
}
