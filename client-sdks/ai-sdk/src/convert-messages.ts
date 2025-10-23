import { convertMessages } from '@mastra/core/agent';
import type { MastraMessageV2 } from '@mastra/core/agent';
import type { UIMessage } from 'ai';

/**
 * Converts Mastra V2 messages to AI SDK V5 UI format
 */
export function toAISdkV5Format(messages: MastraMessageV2[]): UIMessage[] {
  return convertMessages(messages).to('aiv5-ui') as UIMessage[];
}

/**
 * Converts Mastra V2 messages to AI SDK V4 UI format
 */
export function toAISdkV4Format(messages: MastraMessageV2[]): UIMessage[] {
  return convertMessages(messages).to('aiv4-ui') as UIMessage[];
}
