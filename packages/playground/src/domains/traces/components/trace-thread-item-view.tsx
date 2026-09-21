import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ToolCallProvider } from '@mastra/playground-ui/domains/chat/context/tool-call-context';
import { TracesErrorContent } from '@mastra/playground-ui/domains/traces/components/traces-error-content';
import { useTraceSpans } from '@mastra/playground-ui/domains/traces/hooks/use-trace-spans';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ListTreeIcon } from 'lucide-react';

import { formatTraceThreadMessages } from './format-trace-thread-messages';
import { TraceMessagesSkeleton } from './trace-messages-skeleton';
import { MessageRow } from '@/lib/ai-ui/messages/message-row';

export interface TraceThreadItemViewProps {
  traceId: string;
  /** Called with the ids of the spans behind a message (text or tool call) when its "Highlight spans" action is clicked. */
  onHighlightSpans?: (spanIds: string[]) => void;
  className?: string;
}

const noop = () => {};

export function TraceThreadItemView({ traceId, onHighlightSpans, className }: TraceThreadItemViewProps) {
  const { data, isLoading, error } = useTraceSpans(traceId, { passive: true });

  if (isLoading) return <TraceMessagesSkeleton className={className} />;

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <TracesErrorContent error={error} resource="trace" errorTitle="Failed to load partial thread" />
      </div>
    );
  }

  const messages = data ? formatTraceThreadMessages(data.spans) : [];

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Txt variant="body" className="text-muted-foreground">
          No agent turn found for this trace.
        </Txt>
      </div>
    );
  }

  return (
    <div className={cn('animate-in fade-in-0 p-4 duration-300', className)}>
      {/* Messages carry their own vertical margins; strip them at the edges so `p-4` is the only outer spacing. */}
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 [&>[data-slot=message]:first-child]:mt-0 [&>[data-slot=message]:last-child]:mb-0">
        <ToolCallProvider
          approveToolcall={noop}
          declineToolcall={noop}
          approveToolcallGenerate={noop}
          declineToolcallGenerate={noop}
          approveNetworkToolcall={noop}
          declineNetworkToolcall={noop}
          isRunning={false}
          toolCallApprovals={{}}
          networkToolCallApprovals={{}}
        >
          {messages.map(message => {
            const action =
              onHighlightSpans && message.traceSpanIds.length > 0 ? (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  tooltip="Highlight spans"
                  aria-label="Highlight spans"
                  onClick={() => onHighlightSpans(message.traceSpanIds)}
                >
                  <ListTreeIcon />
                </Button>
              ) : undefined;

            return <MessageRow key={message.id} message={message} readOnly footer={action} />;
          })}
        </ToolCallProvider>
      </div>
    </div>
  );
}
