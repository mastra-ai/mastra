import type { TraceSpanRecord } from '../types';
import { formatTraceThreadMessages } from './format-trace-thread-messages';
import { ReadOnlyToolCallProvider } from './read-only-tool-call-provider';
import { TraceMessagesSkeleton } from './trace-messages-skeleton';
import { useRecordNavigationOf, useTraceNavigation } from './trace-navigation';
import type { TraceNavigation } from './trace-navigation';
import { TraceNavigationScope } from './trace-navigation-scope';
import { useTraceToolCardRenderer } from './trace-tool-calls';
import type { TraceToolCallsProps } from './trace-tool-calls';
import { RecordNavigationContext } from '@/domains/chat/context/record-navigation';
import { MessageRow } from '@/domains/chat/messages/message-row';
import { TracesErrorContent } from '@/domains/traces/components/traces-error-content';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { IconCodeTree } from '@/ds/icons/central/IconCodeTree';
import { cn } from '@/utils/cn';

export interface TraceThreadItemViewProps extends TraceToolCallsProps {
  /**
   * Every span of the trace with its payload (`getTrace`); the turn is reconstructed from them.
   * The view never fetches: the host hands them down (Studio: `useTraceSpans`).
   */
  spans: TraceSpanRecord[] | undefined;
  /** The spans are still loading: shows the messages skeleton. */
  isLoading?: boolean;
  /** The spans failed to load. */
  error?: unknown;
  /** Called with the ids of the spans behind a message (text or tool call) when its "Highlight spans" action is clicked. */
  onHighlightSpans?: (spanIds: string[]) => void;
  className?: string;
  /** Where the turn's links (workspaces, Knowledge pages) open; defaults to the navigation of the root around it. */
  navigation?: TraceNavigation;
}

/** One trace rendered as the agent turn it recorded, through the chat UI. */
export function TraceThreadItemView({ navigation, ...props }: TraceThreadItemViewProps) {
  return (
    <TraceNavigationScope navigation={navigation}>
      <TurnMessages {...props} />
    </TraceNavigationScope>
  );
}

function TurnMessages({
  spans,
  isLoading,
  error,
  onHighlightSpans,
  mcpAppTools,
  renderToolCall,
  className,
}: Omit<TraceThreadItemViewProps, 'navigation'>) {
  const renderToolCard = useTraceToolCardRenderer({ mcpAppTools, renderToolCall });
  const recordNavigation = useRecordNavigationOf(useTraceNavigation());

  if (isLoading) return <TraceMessagesSkeleton className={className} />;

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <TracesErrorContent error={error} resource="trace" errorTitle="Failed to load partial thread" />
      </div>
    );
  }

  const messages = spans ? formatTraceThreadMessages(spans) : [];
  const rowProps = { readOnly: true, mcpAppTools, renderToolCard };

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
        <RecordNavigationContext.Provider value={recordNavigation}>
          <ReadOnlyToolCallProvider>
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
                    <IconCodeTree />
                  </Button>
                ) : undefined;

              const isToolCall = message.content.parts.every(part => part.type === 'tool-invocation');
              if (isToolCall && action) {
                // Tool calls sit on one line, so the action goes beside the tool card instead of below it.
                return (
                  <div key={message.id} className="group/tool mb-3 flex items-start gap-1 last:mb-0">
                    <MessageRow message={message} {...rowProps} className="flex-1" />
                    <div className="shrink-0 group-focus-within/tool:opacity-100 group-hover/tool:opacity-100 motion-safe:transition-opacity pointer-fine:opacity-0">
                      {action}
                    </div>
                  </div>
                );
              }

              return <MessageRow key={message.id} message={message} {...rowProps} footer={action} />;
            })}
          </ReadOnlyToolCallProvider>
        </RecordNavigationContext.Provider>
      </div>
    </div>
  );
}
