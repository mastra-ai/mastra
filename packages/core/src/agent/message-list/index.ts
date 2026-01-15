// Main class export
export { MessageList } from './message-list';

// Type exports
export type { AIV5ResponseMessage, MessageInput, MessageListInput } from './types';

// Re-export types from state/types (canonical source)
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

// Re-export AI SDK types for convenience
export type { AIV5Type, AIV4Type, CoreMessageV4, UIMessageV4 } from './types';

// Utility exports
export { convertMessages, resolveNetworkMessages } from './utils/convert-messages';
export type { OutputFormat } from './utils/convert-messages';

// Conversion exports
export {
  aiV4CoreMessageToV1PromptMessage,
  aiV5ModelMessageToV2PromptMessage,
  coreContentToString,
  messagesAreEqual,
} from './conversion';

// Adapter exports
export { AIV4Adapter, AIV5Adapter } from './adapters';
export type { AIV4AdapterContext, AIV5AdapterContext, AdapterContext } from './adapters';

// Provider compatibility exports
export {
  ensureGeminiCompatibleMessages,
  ensureAnthropicCompatibleMessages,
  hasOpenAIReasoningItemId,
  getOpenAIReasoningItemId,
  findToolCallArgs,
} from './utils/provider-compat';
export type { ToolResultWithInput } from './utils/provider-compat';

// State management exports
export { MessageStateManager } from './state';

// Detection exports
export { TypeDetector } from './detection';

// Cache exports
export { CacheKeyGenerator } from './cache';

// Merge exports
export { MessageMerger } from './merge';
