import type { CoreMessage, Message } from '@internal/ai-sdk-v4';
import type * as AIV5 from '@internal/ai-sdk-v5';
import type * as AIV6 from '@internal/ai-v6';
import type * as AIV7 from '@internal/ai-v7';

import type { CreatedAgentSignal } from '../signals';
import type { MastraDBMessage, MastraMessageV1, UIMessageWithMetadata } from './state/types';

// Re-export AI SDK types
export type { CoreMessage as CoreMessageV4, UIMessage as UIMessageV4 } from '@internal/ai-sdk-v4';
export type * as AIV4Type from '@internal/ai-sdk-v4';
export type * as AIV5Type from '@internal/ai-sdk-v5';
export type * as AIV6Type from '@internal/ai-v6';
export type * as AIV7Type from '@internal/ai-v7';

// Re-export all message types from state/types for convenience
export type {
  MastraDBMessage,
  MastraMessageV1,
  MastraMessageContentV2,
  MastraMessagePart,
  UIMessageV4Part,
  MessageSource,
  MemoryInfo,
  UIMessageWithMetadata,
} from './state/types';

/** Assistant and tool response messages in the AI SDK v5 model format. */
export type AIV5ResponseMessage = AIV5.AssistantModelMessage | AIV5.ToolModelMessage;
export type AIV6ResponseMessage = AIV6.AssistantModelMessage | AIV6.ToolModelMessage;

/** Message accepted from supported AI SDK formats or Mastra's stored message formats. */
export type MessageInput =
  | AIV7.UIMessage
  | AIV7.ModelMessage
  | AIV6.UIMessage
  | AIV6.ModelMessage
  | AIV5.UIMessage
  | AIV5.ModelMessage
  | UIMessageWithMetadata
  | Message
  | CoreMessage
  | MastraMessageV1
  | MastraDBMessage;

/** A text prompt or supported message object. */
export type BaseMessageListItem = string | MessageInput;
/** Text, one message or a list of text and message inputs. */
export type BaseMessageListInput = string | MessageInput | BaseMessageListItem[];
/** One message-list item, including a created agent signal. */
export type MessageListItem = BaseMessageListItem | CreatedAgentSignal;
/** Agent input as text, messages, created signals or a list combining these forms. */
export type MessageListInput = BaseMessageListInput | CreatedAgentSignal | MessageListItem[];
