// V5 Message types from ai@5.x
export type {
  ModelMessage,
  SystemModelMessage,
  UserModelMessage,
  AssistantModelMessage,
  ToolModelMessage,
  UIMessage,
  UIMessageChunk,
  InferUIMessageChunk,
} from 'ai-v5';

// Re-export prompt types from provider
export type { LanguageModelV2Prompt, LanguageModelV2Message } from '@ai-sdk/provider-v5';
