import { useTraceSpans } from '@mastra/react/hooks/traces';
import { ListTreeIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTraceTimeCursor, useTraceTimeCursorStore } from '../hooks/use-trace-time-cursor';
import { createSpanSnapshotIndex, snapshotKeyAt, snapshotSpansAt } from '../utils/span-snapshot';
import { formatTraceThreadMessages } from './format-trace-thread-messages';
import { ReadOnlyToolCallProvider } from './read-only-tool-call-provider';
import { TraceMessagesSkeleton } from './trace-messages-skeleton';
import { MessageRow } from '@/domains/chat/messages/message-row';
import { TracesErrorContent } from '@/domains/traces/components/traces-error-content';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/utils/cn';

export interface TraceThreadItemViewProps {
  traceId: string;
  /** Called with the ids of the spans behind a message (text or tool call) when its "Highlight spans" action is clicked. */
  onHighlightSpans?: (spanIds: string[]) => void;
  className?: string;
}

const NO_SPANS: never[] = [];

export function TraceThreadItemView({ traceId, onHighlightSpans, className }: TraceThreadItemViewProps) {
  const { data, isLoading, error } = useTraceSpans({
    traceId: traceId,
    passive: true,
    queryOptions: { enabled: !!traceId },
  });
  const spans = data?.spans ?? NO_SPANS;
  const snapshotIndex = useMemo(() => createSpanSnapshotIndex(spans), [spans]);
  const timeCursor = useTraceTimeCursorStore();
  // Re-renders only when the cursor crosses a span start or end, not on every cursor move.
  const snapshotKey = useTraceTimeCursor(t => (t == null ? null : snapshotKeyAt(snapshotIndex, t)));
  const messages = useMemo(() => {
    // The key fully determines which spans are started and ended, so reading the live cursor here is safe.
    const t = snapshotKey == null ? null : (timeCursor?.get() ?? null);
    return formatTraceThreadMessages(t == null ? spans : snapshotSpansAt(spans, t));
  }, [spans, snapshotKey, timeCursor]);

  if (isLoading) return <TraceMessagesSkeleton className={className} />;

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <TracesErrorContent error={error} resource="trace" errorTitle="Failed to load partial thread" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Txt variant="body" tone="muted">
          {snapshotKey == null ? 'No agent turn found for this trace.' : 'Nothing has happened yet at this point.'}
        </Txt>
      </div>
    );
  }

  return (
    <div className={cn('min-w-0 p-4', className)}>
      {/* Messages carry their own vertical margins; strip them at the edges so `p-4` is the only outer spacing. */}
      <div className="mx-auto flex w-full max-w-3xl flex-col [&>[data-slot=message]:first-child]:mt-0 [&>[data-slot=message]:last-child]:mb-0">
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
        </ReadOnlyToolCallProvider>
      </div>
    </div>
  );
}
