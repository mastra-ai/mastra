import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { raisedSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useObservationalMemoryContext } from '@mastra/react/hooks/memory';

interface AgentMemoryContextProps {
  agentId: string;
  resourceId: string;
  threadId: string;
}

/** What the agent's next turn sends the model: rendered observations, then the messages not yet observed. */
export function AgentMemoryContext({ agentId, resourceId, threadId }: AgentMemoryContextProps) {
  const { data, isLoading } = useObservationalMemoryContext({
    agentId,
    threadId,
    resourceId,
    queryOptions: { enabled: Boolean(threadId) && threadId !== 'new' },
  });

  if (!isLoading && !data?.supported) return null;

  const context = data?.context;

  return (
    <div className="border-b border-border p-4">
      <Txt as="h3" variant="subheading" tone="ink">
        Current Context
      </Txt>
      <Txt variant="caption" tone="muted" className="mt-1">
        Sent to the model on the next turn
        {context?.observedAt ? `, observed up to ${new Date(context.observedAt).toLocaleString()}` : ''}.
      </Txt>
      {isLoading ? (
        <Skeleton className="mt-3 h-24 w-full" />
      ) : !context ? (
        <Txt tone="muted" className="mt-3">
          Nothing yet. Send a message to start the thread.
        </Txt>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <div className={cn(raisedSurfaceStyle, 'rounded-lg p-3')}>
            <Txt variant="column" tone="muted" className="mb-1 block">
              Observations
            </Txt>
            {context.system ? (
              <div className="max-h-64 overflow-y-auto">
                <MarkdownRenderer>{context.system}</MarkdownRenderer>
              </div>
            ) : (
              <Txt variant="caption" tone="muted">
                None yet. Messages are observed once the thread passes its token threshold.
              </Txt>
            )}
          </div>
          <div className={cn(raisedSurfaceStyle, 'rounded-lg p-3')}>
            <Txt variant="column" tone="muted" className="mb-1 block">
              Unobserved messages ({context.messages.length})
            </Txt>
            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {context.messages.map((message, i) => (
                <Txt key={message.id ?? i} variant="caption" tone="ink" className="wrap-break-word">
                  <span className="font-medium">{message.role}:</span> {message.content}
                </Txt>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
