import type { CoreMessage, Message } from '@internal/ai-sdk-v4';
import type * as AIV5 from '@internal/ai-sdk-v5';
import type * as AIV6 from '@internal/ai-v6';

import type { MastraDBMessage, MastraMessageV1, UIMessageWithMetadata } from './state/types';

// Re-export AI SDK types
export type { CoreMessage as CoreMessageV4, UIMessage as UIMessageV4 } from '@internal/ai-sdk-v4';
export type * as AIV4Type from '@internal/ai-sdk-v4';
export type * as AIV5Type from '@internal/ai-sdk-v5';
export type * as AIV6Type from '@internal/ai-v6';

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

// MessageList input types
export type AIV5ResponseMessage = AIV5.AssistantModelMessage | AIV5.ToolModelMessage;
export type AIV6ResponseMessage = AIV6.AssistantModelMessage | AIV6.ToolModelMessage;

export type MessageInput =
  | AIV6.UIMessage
  | AIV6.ModelMessage
  | AIV5.UIMessage
  | AIV5.ModelMessage
  | UIMessageWithMetadata
  | Message
  | CoreMessage
  | MastraMessageV1
  | MastraDBMessage;

export type MessageListInput = string | string[] | MessageInput | MessageInput[];
