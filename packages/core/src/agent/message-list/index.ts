// Main class export
export { MessageList } from './message-list';

// Type exports
export type { AIV5ResponseMessage, AIV6ResponseMessage, MessageInput, MessageListInput } from './types';

// Re-export types from state/types (canonical source)
export type {
  MastraDBMessage,
  MastraLegacyMessageAnnotations,
  MastraLegacyMessageAttachments,
  MastraLegacyMessageContent,
  MastraLegacyReasoning,
  MastraLegacyToolInvocations,
  MastraMessageV1,
  MastraMessageContentV2,
  MastraMessageContentV2WithLegacyFields,
  MastraMessagePart,
  MastraToolApproval,
  MastraToolInvocation,
  MastraToolInvocationPart,
  UIMessageV4Part,
  MessageSource,
  MemoryInfo,
  UIMessageWithMetadata,
} from './state/types';

// Re-export AI SDK types for convenience
export type { AIV6Type, AIV5Type, AIV4Type, CoreMessageV4, UIMessageV4 } from './types';

// Utility exports
export { convertMessages } from './utils/convert-messages';
export {
  addLegacyGettersToMessage,
  addLegacyGettersToMessages,
  addLegacyGettersToContent,
  getLegacyAnnotations,
  getLegacyContent,
  getLegacyExperimentalAttachments,
  getLegacyReasoning,
  getLegacyToolInvocations,
  stripLegacyMessageFields,
  stripLegacyMessageFieldsPreservingInstance,
  stripLegacyMessageFieldsInPlace,
  stripLegacyMessagesFields,
} from './utils/legacy-fields';
export type { OutputFormat } from './utils/convert-messages';

// Conversion exports
export {
  aiV4CoreMessageToV1PromptMessage,
  aiV5ModelMessageToV2PromptMessage,
  coreContentToString,
  messagesAreEqual,
} from './conversion';

// Adapter exports
export { AIV4Adapter, AIV5Adapter, AIV6Adapter } from './adapters';
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
