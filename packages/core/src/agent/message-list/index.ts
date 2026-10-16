// Main class export
export { MessageList } from './message-list';

// Type exports
export type {
  AIV5ResponseMessage,
  AIV6ResponseMessage,
  BaseMessageListInput,
  BaseMessageListItem,
  MessageInput,
  MessageListInput,
  MessageListItem,
} from './types';

// Re-export types from state/types (canonical source)
export type {
  MastraDBMessage,
  MastraMessageV1,
  MastraMessageContentV2,
  MastraMessagePart,
  MastraErrorPart,
  MastraToolApproval,
  MastraToolInvocation,
  MastraToolInvocationPart,
  MastraBasePart,
  MessageSource,
  MemoryInfo,
} from './state/types';

// Re-export AI SDK types for convenience
export type { AIV6Type, AIV5Type } from './types';

// Utility exports
export { convertMessages } from './utils/convert-messages';
export type { OutputFormat } from './utils/convert-messages';

// Conversion exports
export { aiV5ModelMessageToV2PromptMessage, coreContentToString, messagesAreEqual } from './conversion';

// Adapter exports
export { AIV5Adapter, AIV6Adapter, MastraV1Adapter } from './adapters';
export type { AIV5AdapterContext, AdapterContext, MastraV1AdapterContext } from './adapters';

// Provider compatibility exports
export {
  ensureAnthropicCompatibleMessages,
  sanitizeOrphanedToolPairs,
  pairOrphanedToolCalls,
  hasOpenAIReasoningItemId,
  getOpenAIReasoningItemId,
  hasResponseProviderItemId,
  getResponseProviderItemIdFromPart,
  findToolCallArgs,
  dropCrossProviderExecutedParts,
} from './utils/provider-compat';
export {
  getResponseProviderItemId,
  getResponseProviderItemKey,
  getResponseProviderItemIds,
  getResponseProviderItemKeys,
} from './utils/response-item-metadata';
export type { ResponseItemIdProvider } from './utils/response-item-metadata';
export type { ToolResultWithInput } from './utils/provider-compat';

// State management exports
export { MessageStateManager } from './state';

// Detection exports
export { TypeDetector } from './detection';

// Cache exports
export { CacheKeyGenerator } from './cache';

// Merge exports
export { MessageMerger } from './merge';
