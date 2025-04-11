import { PreviewMessage } from './message';
import { useScrollToBottom } from './use-scroll-to-bottom';
import { Vote } from '@/lib/db/schema';
import { ChatRequestOptions } from 'ai';
import { memo } from 'react';
import equal from 'fast-deep-equal';
import { UIArtifact } from './artifact';
import { Message, CreateMessage } from '@ai-sdk/react';

interface ArtifactMessagesProps {
  chatId: string;
  isLoading: boolean;
  votes: Array<Vote> | undefined;
  messages: Array<Message>;
  setMessages: (messages: Message[] | ((messages: Message[]) => Message[])) => void;
  reload: (chatRequestOptions?: ChatRequestOptions) => Promise<string | null | undefined>;
  isReadonly: boolean;
  artifactStatus: UIArtifact['status'];
}

function PureArtifactMessages({
  chatId,
  isLoading,
  votes,
  messages,
  setMessages,
  reload,
  isReadonly,
}: ArtifactMessagesProps) {
  const [messagesContainerRef, messagesEndRef] = useScrollToBottom<HTMLDivElement>();

  return (
    <div ref={messagesContainerRef} className="flex flex-col gap-4 h-full items-center overflow-y-scroll px-4 pt-20">
      {messages.map((message, index) => (
        <PreviewMessage
          chatId={chatId}
          key={message.id}
          message={message}
          isLoading={isLoading && index === messages.length - 1}
          vote={votes ? votes.find(vote => vote.messageId === message.id) : undefined}
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
        />
      ))}

      <div ref={messagesEndRef} className="shrink-0 min-w-[24px] min-h-[24px]" />
    </div>
  );
}

function areEqual(prevProps: ArtifactMessagesProps, nextProps: ArtifactMessagesProps) {
  if (prevProps.artifactStatus === 'streaming' && nextProps.artifactStatus === 'streaming') return true;

  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.isLoading && nextProps.isLoading) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;

  return true;
}

export const ArtifactMessages = memo(PureArtifactMessages, areEqual);
