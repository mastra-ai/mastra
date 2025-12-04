// V5 Stream utilities from ai@5.x
export {
  createTextStreamResponse,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  pipeTextStreamToResponse,
} from 'ai-v5';

export type {
  TextStreamPart,
  ObjectStreamPart,
  UIMessageStreamOptions,
  IdGenerator,
  StepResult,
  LanguageModelUsage,
  FinishReason,
  LanguageModelResponseMetadata,
} from 'ai-v5';

// Re-export stream part type from provider
export type { LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
