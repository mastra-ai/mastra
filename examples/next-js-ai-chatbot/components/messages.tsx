import { ChatRequestOptions } from 'ai';
import { AiMessageType as Message } from '@mastra/core';
import { PreviewMessage, ThinkingMessage } from './message';
import { Overview } from './overview';
import { memo, useRef } from 'react';
import equal from 'fast-deep-equal';
import { useAutoscroll } from '@/hooks/use-autoscroll';

interface MessagesProps {
  isLoading: boolean;
  messages: Array<Message>;
  isReadonly: boolean;
}

function PureMessages({ isLoading, messages, isReadonly }: MessagesProps) {
  const messagesContainerRef = useRef(null);
  useAutoscroll(messagesContainerRef);

  return (
    <div ref={messagesContainerRef} className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4">
      {messages.length === 0 && <Overview />}

      {messages.map((message, index) => (
        <PreviewMessage
          key={message.id}
          message={message}
          isLoading={isLoading && messages.length - 1 === index}
          isReadonly={isReadonly}
        />
      ))}

      {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && <ThinkingMessage />}
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.isLoading && nextProps.isLoading) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;
  // if (!equal(prevProps.votes, nextProps.votes)) return false;

  return true;
});
