import type { MastraUIMessage } from '@mastra/react';
import type { ReactNode } from 'react';
import { MessageRow, MessagesSkeleton } from './messages';
import { useAutoScroll } from './use-auto-scroll';

interface MessageListProps {
  messages: MastraUIMessage[];
  isLoading?: boolean;
  emptyState?: ReactNode;
  skeletonTestId?: string;
}

export const MessageList = ({ messages, isLoading = false, emptyState, skeletonTestId }: MessageListProps) => {
  const scrollRef = useAutoScroll(messages);
  const showSkeleton = isLoading && messages.length === 0;
  const showEmpty = !isLoading && messages.length === 0 && emptyState !== undefined;

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto pb-6 px-6">
      {showSkeleton ? (
        <MessagesSkeleton testId={skeletonTestId} />
      ) : showEmpty ? (
        emptyState
      ) : (
        <div className="flex flex-col gap-6">
          {messages.map(message => (
            <MessageRow key={message.id} message={message} />
          ))}
        </div>
      )}
    </div>
  );
};
