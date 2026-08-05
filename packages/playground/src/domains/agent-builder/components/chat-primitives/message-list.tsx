import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { PendingIndicator } from '@mastra/playground-ui/components/PendingIndicator';
import type { MessageFactoryPart } from '@mastra/react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { MessageRow, MessagesSkeleton } from './messages';
import { useAutoScroll } from '@/domains/agent-builder/hooks/use-auto-scroll';

/**
 * Returns true only after `flag` has stayed true for `delayMs` continuously.
 * If `flag` flips back to false before the delay elapses (e.g. data resolved
 * locally), nothing is shown — preventing a brief skeleton flash.
 */
const useDelayedFlag = (flag: boolean, delayMs: number) => {
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    if (!flag) {
      setDelayed(false);
      return;
    }
    const id = setTimeout(() => setDelayed(true), delayMs);
    return () => clearTimeout(id);
  }, [flag, delayMs]);
  return delayed;
};

const SKELETON_DELAY_MS = 300;

interface MessageListProps {
  messages: MastraDBMessage[];
  isLoading?: boolean;
  isRunning?: boolean;
  emptyState?: ReactNode;
  skeletonTestId?: string;
}

/**
 * Detects whether the last assistant message has a part that is *actively*
 * streaming output. Completed tool calls (`output-available` / `output-error`)
 * are excluded so the pending indicator stays visible during quiet moments —
 * e.g. while the server is internally retrying via
 * `StreamErrorRetryProcessor` after the previous step finished cleanly.
 */
const hasStreamingPart = (message: MastraDBMessage | undefined) => {
  if (!message) return false;
  // `MastraMessagePart[]` widens into `MessageFactoryPart[]`, surfacing the
  // runtime `dynamic-tool` / `tool-${string}` parts, so no cast is needed.
  const parts: MessageFactoryPart[] = message.content.parts;
  return parts.some(part => {
    if (part.type === 'reasoning' || part.type === 'text') {
      return 'state' in part && part.state === 'streaming';
    }
    if (part.type === 'tool-invocation') {
      return 'toolInvocation' in part && part.toolInvocation.state !== 'result';
    }
    if (part.type === 'dynamic-tool' || part.type.startsWith('tool-')) {
      const state = 'state' in part ? part.state : undefined;
      return state !== 'output-available' && state !== 'output-error';
    }
    return false;
  });
};

export const MessageList = ({
  messages,
  isLoading = false,
  isRunning = false,
  emptyState,
  skeletonTestId,
}: MessageListProps) => {
  const scrollRef = useAutoScroll(messages);
  const isLoadingEmpty = isLoading && messages.length === 0;
  // Defer the skeleton by 300ms so it doesn't flash on fast (local) responses.
  // If `isLoadingEmpty` flips false before the timer elapses, nothing renders.
  const showSkeleton = useDelayedFlag(isLoadingEmpty, SKELETON_DELAY_MS);
  const showEmpty = !isLoading && messages.length === 0 && emptyState !== undefined;
  const lastMessage = messages[messages.length - 1];
  const showPending =
    isRunning && !isLoadingEmpty && (lastMessage?.role !== 'assistant' || !hasStreamingPart(lastMessage));

  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-y-auto px-6 py-6"
      style={{ viewTransitionName: 'agent-builder-messages' }}
    >
      {showSkeleton ? (
        <MessagesSkeleton testId={skeletonTestId} />
      ) : showEmpty ? (
        emptyState
      ) : (
        <div className="flex flex-col gap-6">
          {messages.map(message => (
            <MessageRow key={message.id} message={message} />
          ))}
          {showPending && <PendingIndicator testId="agent-builder-chat-pending" />}
        </div>
      )}
    </div>
  );
};
