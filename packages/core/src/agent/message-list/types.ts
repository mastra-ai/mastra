import type * as AIV5 from '@internal/ai-sdk-v5';
import type * as AIV6 from '@internal/ai-v6';
import type * as AIV7 from '@internal/ai-v7';

import type { CreatedAgentSignal } from '../signals';
import type { MastraDBMessage, MastraMessageV1 } from './state/types';

// Re-export AI SDK types
export type * as AIV5Type from '@internal/ai-sdk-v5';
export type * as AIV6Type from '@internal/ai-v6';
export type * as AIV7Type from '@internal/ai-v7';

// Re-export all message types from state/types for convenience
export type {
  MastraDBMessage,
  MastraMessageV1,
  MastraMessageContentV2,
  MastraMessagePart,
  MastraErrorPart,
  MastraBasePart,
  MessageSource,
  MemoryInfo,
} from './state/types';

// MessageList input types
export type AIV5ResponseMessage = AIV5.AssistantModelMessage | AIV5.ToolModelMessage;
export type AIV6ResponseMessage = AIV6.AssistantModelMessage | AIV6.ToolModelMessage;

export type MessageInput =
  | AIV7.UIMessage
  | AIV7.ModelMessage
  | AIV6.UIMessage
  | AIV6.ModelMessage
  | AIV5.UIMessage
  | AIV5.ModelMessage
  | MastraMessageV1
  | MastraDBMessage;

export type BaseMessageListItem = string | MessageInput;
export type BaseMessageListInput = string | MessageInput | BaseMessageListItem[];
export type MessageListItem = BaseMessageListItem | CreatedAgentSignal;
export type MessageListInput = BaseMessageListInput | CreatedAgentSignal | MessageListItem[];
