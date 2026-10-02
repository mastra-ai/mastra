import { ListTreeIcon } from 'lucide-react';
import { formatTraceThreadMessages } from './format-trace-thread-messages';
import { TraceMessagesSkeleton } from './trace-messages-skeleton';
import { ToolCallProvider } from '@/domains/chat/context/tool-call-context';
import { MessageRow } from '@/domains/chat/messages/message-row';
import { TracesErrorContent } from '@/domains/traces/components/traces-error-content';
import { useTraceSpans } from '@/domains/traces/hooks/use-trace-spans';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/utils/cn';

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
        <Txt variant="body" tone="muted">
          No agent turn found for this trace.
        </Txt>
      </div>
    );
  }

  return (
    <div className={cn('min-w-0 p-4', className)}>
      {/* Messages carry their own vertical margins; strip them at the edges so `p-4` is the only outer spacing. */}
      <div className="mx-auto flex w-full max-w-3xl flex-col [&>[data-slot=message]:first-child]:mt-0 [&>[data-slot=message]:last-child]:mb-0">
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
                  size="icon-sm"
                  tooltip="Highlight spans"
                  aria-label="Highlight spans"
                  onClick={() => onHighlightSpans(message.traceSpanIds)}
                >
                  <ListTreeIcon />
                </Button>
              ) : undefined;

            const isToolCall = message.content.parts.every(part => part.type === 'tool-invocation');
            if (isToolCall && action) {
              // Tool calls sit on one line, so the action goes beside the tool card instead of below it.
              return (
                <div key={message.id} className="group/tool mb-3 flex items-start gap-1 last:mb-0">
                  <MessageRow message={message} readOnly className="flex-1" />
                  <div className="shrink-0 group-focus-within/tool:opacity-100 group-hover/tool:opacity-100 motion-safe:transition-opacity pointer-fine:opacity-0">
                    {action}
                  </div>
                </div>
              );
            }

            return <MessageRow key={message.id} message={message} readOnly footer={action} />;
          })}
        </ToolCallProvider>
      </div>
    </div>
  );
}
