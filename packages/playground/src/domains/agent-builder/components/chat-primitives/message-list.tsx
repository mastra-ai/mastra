import type { MastraUIMessage } from '@mastra/react';
import { useEffect, useState, type ReactNode } from 'react';
import { MessageRow, MessagesSkeleton, PendingIndicator } from './messages';
import { useAutoScroll } from './use-auto-scroll';

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
  messages: MastraUIMessage[];
  isLoading?: boolean;
  isRunning?: boolean;
  emptyState?: ReactNode;
  skeletonTestId?: string;
  /** Forwarded to MessageRow so chat-rendered tool widgets can address the agent. */
  agentId?: string;
}

const hasStreamingPart = (message: MastraUIMessage | undefined) => {
  if (!message) return false;
  return message.parts.some(part => {
    if (part.type === 'reasoning' || part.type === 'text') {
      return (part as { state?: string }).state === 'streaming';
    }
    if (part.type === 'dynamic-tool') {
      return true;
    }
    if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
      return true;
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
  agentId,
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
      className="flex-1 min-h-0 overflow-y-auto pb-6 px-6"
      style={{ viewTransitionName: 'agent-builder-messages' }}
    >
      {showSkeleton ? (
        <MessagesSkeleton testId={skeletonTestId} />
      ) : showEmpty ? (
        emptyState
      ) : (
        <div className="flex flex-col gap-6">
          {messages.map(message => (
            <MessageRow key={message.id} message={message} agentId={agentId} />
          ))}
          {showPending && <PendingIndicator />}
        </div>
      )}
    </div>
  );
};
