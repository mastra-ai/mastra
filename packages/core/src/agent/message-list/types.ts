import type { CoreMessage, Message } from '@internal/ai-sdk-v4';
import type * as AIV5 from '@internal/ai-sdk-v5';

import type { MastraDBMessage, MastraMessageV1, UIMessageWithMetadata } from './state/types';

// Re-export AI SDK types
export type { CoreMessage as CoreMessageV4, UIMessage as UIMessageV4 } from '@internal/ai-sdk-v4';
export type * as AIV4Type from '@internal/ai-sdk-v4';
export type * as AIV5Type from '@internal/ai-sdk-v5';

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

// ModelMessage with id - convertToModelMessages strips id, but we restore it from UIMessage
// This is the actual return type of our conversion functions
export type AIV5ModelMessageWithId = AIV5.ModelMessage & { id: string };

// Response messages are specifically assistant or tool messages with id
// Used in onFinish callback where users need to access response.messages[].id
export type AIV5ResponseMessage = (AIV5.AssistantModelMessage | AIV5.ToolModelMessage) & {
  id: string;
};

export type MessageInput =
  | AIV5.UIMessage
  | AIV5.ModelMessage
  | UIMessageWithMetadata
  | Message
  | CoreMessage
  | MastraMessageV1
  | MastraDBMessage;

export type MessageListInput = string | string[] | MessageInput | MessageInput[];
