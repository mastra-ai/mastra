import { ChatMessage } from '../../components/ui/chat-message';
import type { ChatMessageProps, Message } from '../../components/ui/chat-message';
import { TypingIndicator } from '../../components/ui/typing-indicator';

type AdditionalMessageOptions = Omit<ChatMessageProps, keyof Message>;

interface MessageListProps {
  messages: Message[];
  showTimeStamps?: boolean;
  isTyping?: boolean;
  messageOptions?: AdditionalMessageOptions | ((message: Message) => AdditionalMessageOptions);
}

export function MessageList({ messages, showTimeStamps = true, isTyping = false, messageOptions }: MessageListProps) {
  return (
    <div className="space-y-4 overflow-visible">
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
