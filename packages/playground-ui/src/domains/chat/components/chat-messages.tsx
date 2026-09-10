import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { getClientMessageKey } from '../../../ds/components/ThreadRail/thread-rail-turns';
import { ChatMessage } from './chat-message';
import type { ChatToolContext } from './chat-tool-context';

export interface ChatMessagesProps extends ChatToolContext {
  messages: MastraDBMessage[];
  hasModelList?: boolean;
  speakingMessageId?: string;
  onReadAloud?: (message: MastraDBMessage, text: string) => void;
  onStopSpeaking?: () => void;
  onSaveToDataset?: (message: MastraDBMessage, text: string) => void;
}

/** Message content only. The caller owns transport, scrolling, empty states and the composer. */
export function ChatMessages({
  messages,
  hasModelList,
  speakingMessageId,
  onReadAloud,
  onStopSpeaking,
  onSaveToDataset,
  ...tools
}: ChatMessagesProps) {
  return messages.map(message => (
    <ChatMessage
      key={getClientMessageKey(message)}
      message={message}
      hasModelList={hasModelList}
      isSpeaking={speakingMessageId === message.id}
      onReadAloud={onReadAloud ? text => onReadAloud(message, text) : undefined}
      onStopSpeaking={onStopSpeaking}
      onSaveToDataset={onSaveToDataset ? text => onSaveToDataset(message, text) : undefined}
      {...tools}
    />
  ));
}
