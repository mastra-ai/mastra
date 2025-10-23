import {
  Icon,
  IconButton,
  MessageActions,
  MessageContent,
  MessageUsage,
  MessageUsageEntry,
  MessageUsages,
  MessageUsageValue,
} from '@mastra/react';
import { Copy, Hash, Mic } from 'lucide-react';
import { Response } from '../ai-elements/response';
export interface TextMessageProps {
  message: string;
  isStreaming: boolean;
  role: 'system' | 'user' | 'assistant';
}

export const TextMessage = ({ role, isStreaming, message }: TextMessageProps) => {
  return (
    <>
      {role === 'assistant' && (
        <MessageUsages>
          <MessageUsage>
            <MessageUsageEntry>
              <Icon>
                <Hash />
              </Icon>
              Tokens:
            </MessageUsageEntry>
            <MessageUsageValue>100</MessageUsageValue>
          </MessageUsage>
        </MessageUsages>
      )}
      <MessageContent isStreaming={isStreaming}>
        <Response>{message}</Response>
      </MessageContent>

      <MessageActions>
        <IconButton tooltip="Voice message">
          <Mic />
        </IconButton>

        <IconButton tooltip="Copy">
          <Copy />
        </IconButton>
      </MessageActions>
    </>
  );
};
