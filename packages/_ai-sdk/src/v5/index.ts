// V5 main exports (ai@5.x with LanguageModelV2)

// Model generation functions
export { generateText, streamText, generateObject, streamObject, Output } from 'ai-v5';

// Schema utilities
export { asSchema, jsonSchema, isDeepEqualData, parsePartialJson } from 'ai-v5';
export type { JSONSchema7, Schema } from 'ai-v5';

// Tool utilities
export { tool, dynamicTool, stepCountIs, isToolUIPart } from 'ai-v5';

// Stream utilities
export {
  createTextStreamResponse,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  pipeTextStreamToResponse,
} from 'ai-v5';

// Errors
export { APICallError, NoObjectGeneratedError } from 'ai-v5';

// Types from ai-v5
export type {
  // Model types
  LanguageModel,
  GenerateTextResult,
  GenerateObjectResult,
  StreamTextResult,
  StreamObjectResult,
  // Message types
  ModelMessage,
  SystemModelMessage,
  UserModelMessage,
  AssistantModelMessage,
  ToolModelMessage,
  UIMessage,
  UIMessageChunk,
  InferUIMessageChunk,
  // Tool types
  Tool,
  ToolSet,
  ToolChoice,
  UIToolInvocation,
  TypedToolCall,
  StaticToolCall,
  StaticToolResult,
  DynamicToolCall,
  DynamicToolResult,
  // Stream types
  TextStreamPart,
  ObjectStreamPart,
  UIMessageStreamOptions,
  IdGenerator,
  StepResult,
  LanguageModelUsage,
  FinishReason,
  LanguageModelResponseMetadata,
  // Embed types
  EmbedResult,
  EmbedManyResult,
  EmbeddingModel,
  // Voice types
  TranscriptionModel,
  SpeechModel,
  // Other
  CallSettings,
  StopCondition,
  DataContent,
  FilePart,
  ImagePart,
} from 'ai-v5';

// Provider types from @ai-sdk/provider-v5
export type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2CallWarning,
  LanguageModelV2StreamPart,
  LanguageModelV2Prompt,
  LanguageModelV2Message,
  LanguageModelV2Usage,
  LanguageModelV2TextPart,
  LanguageModelV2FilePart,
  LanguageModelV2DataContent,
  EmbeddingModelV2,
  SharedV2ProviderOptions,
  SharedV2ProviderMetadata,
} from '@ai-sdk/provider-v5';

export { getErrorMessage, TypeValidationError } from '@ai-sdk/provider-v5';

// Provider utils from @ai-sdk/provider-utils-v5
export {
  convertBase64ToUint8Array,
  convertUint8ArrayToBase64,
  injectJsonInstructionIntoMessages,
  isAbortError,
  delay,
  isUrlSupported,
} from '@ai-sdk/provider-utils-v5';

export type { ReasoningPart } from '@ai-sdk/provider-utils-v5';

// Re-export the entire namespace for advanced usage
export * as AIV5 from 'ai-v5';
