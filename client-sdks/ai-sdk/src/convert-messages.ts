import { convertMessages } from '@mastra/core/agent/message-list';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { UIMessage } from 'ai';

/**
 * Converts Mastra V2 messages to AI SDK V5 UI format
 */
export function toAISdkV5Messages(messages: MastraDBMessage[]): UIMessage[] {
  return convertMessages(messages).to('aiv5-ui') as UIMessage[];
}

/**
 * Converts Mastra V2 messages to AI SDK V4 UI format
 */
export function toAISdkV4Messages(messages: MastraDBMessage[]): UIMessage[] {
  return convertMessages(messages).to('aiv4-ui') as UIMessage[];
}
