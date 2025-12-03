// V5 Model exports from ai@5.x
export { generateText, streamText, generateObject, streamObject, Output } from 'ai-v5';
export type {
  GenerateTextResult,
  GenerateObjectResult,
  StreamTextResult,
  StreamObjectResult,
  LanguageModel,
} from 'ai-v5';

// Re-export from @ai-sdk/provider-v5 (@ai-sdk/provider@2.x)
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
} from '@ai-sdk/provider-v5';
