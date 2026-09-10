import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { TracesErrorContent } from '@mastra/playground-ui/domains/traces/components/traces-error-content';
import { useTraceSpans } from '@mastra/playground-ui/domains/traces/hooks/use-trace-spans';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ListTreeIcon } from 'lucide-react';

import { formatTraceThreadMessages } from './format-trace-thread-messages';
import type { TraceViewMastraDBMessage } from './format-trace-thread-messages';
import { MessageRow } from '@/lib/ai-ui/messages/message-row';
import { ToolCallTrailingSlotContext } from '@/lib/ai-ui/tools/badges/tool-call-trailing-slot';
import { ToolCallProvider } from '@/services/tool-call-provider';

export interface TraceThreadItemViewProps {
  traceId: string;
  /** Called with the ids of the spans behind a message (text or tool call) when its "Highlight spans" action is clicked. */
  onHighlightSpans?: (spanIds: string[]) => void;
  className?: string;
}

const noop = () => {};

const isToolMessage = (message: TraceViewMastraDBMessage) =>
  message.content.parts.some(part => part.type === 'tool-invocation');

export function TraceThreadItemView({ traceId, onHighlightSpans, className }: TraceThreadItemViewProps) {
  const { data, isLoading, error } = useTraceSpans(traceId, { passive: true });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center" aria-label="Loading partial thread">
        <Spinner />
      </div>
    );
  }

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
        <Txt variant="ui-md" className="text-neutral3">
          No agent turn found for this trace.
        </Txt>
      </div>
    );
  }

  return (
    <div className={cn('p-4', className)}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
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
              ) : null;

            // A tool message carries a single tool part: put the action on the badge header line.
            if (isToolMessage(message)) {
              return (
                <ToolCallTrailingSlotContext.Provider key={message.id} value={action}>
                  <MessageRow message={message} readOnly />
                </ToolCallTrailingSlotContext.Provider>
              );
            }

            // Text messages: the action joins the hover-revealed action bar, next to Copy.
            return <MessageRow key={message.id} message={message} readOnly footer={action ?? undefined} />;
          })}
        </ToolCallProvider>
      </div>
    </div>
  );
}
