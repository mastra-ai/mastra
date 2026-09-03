import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { TracesErrorContent } from '@mastra/playground-ui/domains/traces/components/traces-error-content';
import { useTraceSpans } from '@mastra/playground-ui/domains/traces/hooks/use-trace-spans';

import { formatTraceThreadMessages } from './format-trace-thread-messages';
import { MessageRow } from '@/lib/ai-ui/messages/message-row';
import { ToolCallProvider } from '@/services/tool-call-provider';

export interface TraceThreadItemViewProps {
  traceId: string;
}

const noop = () => {};

export function TraceThreadItemView({ traceId }: TraceThreadItemViewProps) {
  const { data, isLoading, error } = useTraceSpans(traceId);

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
    <div className="h-full min-h-0 overflow-y-auto p-4">
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
          {messages.map(message => (
            <MessageRow key={message.id} message={message} readOnly />
          ))}
        </ToolCallProvider>
      </div>
    </div>
  );
}
