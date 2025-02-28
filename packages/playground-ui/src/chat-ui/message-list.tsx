import React from 'react';

import { ChatMessage, type ChatMessageProps, type Message } from './chat-message';
import { TypingIndicator } from './typing-indicator';

type AdditionalMessageOptions = Omit<ChatMessageProps, keyof Message>;

interface MessageListProps {
  messages: Message[];
  showTimeStamps?: boolean;
  isTyping?: boolean;
  messageOptions?: AdditionalMessageOptions | ((message: Message) => AdditionalMessageOptions);
}

export function MessageList({ messages, showTimeStamps = true, isTyping = false, messageOptions }: MessageListProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-3 pt-3">
      {messages.map((message, index) => {
        const additionalOptions = typeof messageOptions === 'function' ? messageOptions(message) : messageOptions;

        if (message.role === 'assistant' && !message.content.trim()) {
          return null;
        }
        return <ChatMessage key={index} showTimeStamp={showTimeStamps} {...message} {...additionalOptions} />;
      })}
      {isTyping && <TypingIndicator />}
    </div>
  );
}
