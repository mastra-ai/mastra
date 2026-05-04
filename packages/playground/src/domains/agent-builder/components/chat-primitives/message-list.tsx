import type { MastraUIMessage } from '@mastra/react';
import type { ReactNode } from 'react';
import { MessageRow, MessagesSkeleton, PendingIndicator } from './messages';
import { useAutoScroll } from './use-auto-scroll';

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
  const showSkeleton = isLoading && messages.length === 0;
  const showEmpty = !isLoading && messages.length === 0 && emptyState !== undefined;
  const lastMessage = messages[messages.length - 1];
  const showPending =
    isRunning && !showSkeleton && (lastMessage?.role !== 'assistant' || !hasStreamingPart(lastMessage));

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
