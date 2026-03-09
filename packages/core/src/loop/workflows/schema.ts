import type { ReasoningPart } from '@ai-sdk/provider-utils-v5';
import type {
  LanguageModelV2FinishReason,
  LanguageModelV2CallWarning,
  SharedV2ProviderMetadata,
  LanguageModelV2Source,
} from '@ai-sdk/provider-v5';
import type { LanguageModelRequestMetadata, LogProbs as LanguageModelV1LogProbs } from '@internal/ai-sdk-v4';
import type {
  StepResult,
  ModelMessage,
  LanguageModelUsage,
  ToolSet,
  TypedToolCall,
  TypedToolResult,
  StaticToolCall,
  StaticToolResult,
  DynamicToolCall,
  DynamicToolResult,
  GeneratedFile,
} from '@internal/ai-sdk-v5';
import z from 'zod';

// Type definitions for the workflow data
export interface LLMIterationStepResult {
  /** Includes 'tripwire' and 'retry' for processor scenarios */
  reason: LanguageModelV2FinishReason | 'tripwire' | 'retry';
  warnings: LanguageModelV2CallWarning[];
  isContinued: boolean;
  logprobs?: LanguageModelV1LogProbs;
  totalUsage: LanguageModelUsage;
  headers?: Record<string, string>;
  messageId?: string;
  request?: LanguageModelRequestMetadata;
}

export interface LLMIterationOutput<Tools extends ToolSet = ToolSet, OUTPUT = undefined> {
  text?: string;
  reasoning?: ReasoningPart[];
  reasoningText?: string;
  files?: GeneratedFile[];
  toolCalls?: TypedToolCall<Tools>[];
  toolResults?: TypedToolResult<Tools>[];
  sources?: LanguageModelV2Source[];
  staticToolCalls?: StaticToolCall<Tools>[];
  dynamicToolCalls?: DynamicToolCall[];
  staticToolResults?: StaticToolResult<Tools>[];
  dynamicToolResults?: DynamicToolResult[];
  usage: LanguageModelUsage;
  steps: StepResult<Tools>[];
  object?: OUTPUT;
}

export interface LLMIterationMetadata {
  id?: string;
  model?: string;
  modelId?: string; // Required by LanguageModelResponseMetadata
  modelMetadata?: {
    modelId: string;
    modelVersion: string;
    modelProvider: string;
  };
  timestamp?: Date;
  providerMetadata?: SharedV2ProviderMetadata;
  headers?: Record<string, string>;
  request?: LanguageModelRequestMetadata;
}

export interface LLMIterationData<Tools extends ToolSet = ToolSet, OUTPUT = undefined> {
  messageId: string;
  messages: {
    all: ModelMessage[];
    user: ModelMessage[];
    nonUser: ModelMessage[];
  };
  output: LLMIterationOutput<Tools, OUTPUT>;
  metadata: LLMIterationMetadata;
  stepResult: LLMIterationStepResult;
  /**
   * Number of times processors have triggered retry for this generation.
   * Used to enforce maxProcessorRetries limit.
   */
  processorRetryCount?: number;
  /**
   * Feedback message from processor to be added as system message on retry.
   * This is passed through workflow state so it survives the system message reset.
   */
  processorRetryFeedback?: string;
}

// Zod schemas for common types used in validation

const languageModelUsageSchema = z.object({
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  totalTokens: z.number().optional(),
  reasoningTokens: z.number().optional(),
  cachedInputTokens: z.number().optional(),
});

// Zod schemas for runtime validation
export const llmIterationStepResultSchema = z.object({
  reason: z.string(),
  warnings: z.array(z.any()),
  isContinued: z.boolean(),
  logprobs: z.any().optional(),
  totalUsage: languageModelUsageSchema.optional(),
  headers: z.record(z.string()).optional(),
  messageId: z.string().optional(),
  request: z.record(z.any()).optional(),
});

export const llmIterationOutputSchema = z.object({
  messageId: z.string(),
  messages: z.object({
    all: z.array(z.any()), // ModelMessage[] but too complex to validate at runtime
    user: z.array(z.any()),
    nonUser: z.array(z.any()),
  }),
  output: z.object({
    text: z.string().optional(),
    reasoning: z.array(z.any()).optional(),
    reasoningText: z.string().optional(),
    files: z.array(z.any()).optional(), // GeneratedFile[]
    toolCalls: z.array(z.any()).optional(), // TypedToolCall[]
    toolResults: z.array(z.any()).optional(), // TypedToolResult[]
    sources: z.array(z.any()).optional(), // LanguageModelV2Source[]
    staticToolCalls: z.array(z.any()).optional(),
    dynamicToolCalls: z.array(z.any()).optional(),
    staticToolResults: z.array(z.any()).optional(),
    dynamicToolResults: z.array(z.any()).optional(),
    usage: languageModelUsageSchema,
    steps: z.array(z.any()), // StepResult[]
  }),
  metadata: z.object({
    id: z.string().optional(),
    model: z.string().optional(),
    modelId: z.string().optional(),
    modelMetadata: z
      .object({
        modelId: z.string(),
        modelVersion: z.string(),
        modelProvider: z.string(),
      })
      .optional(),
    timestamp: z.date().optional(),
    providerMetadata: z.record(z.any()).optional(),
    headers: z.record(z.string()).optional(),
    request: z.record(z.any()).optional(),
  }),
  stepResult: llmIterationStepResultSchema,
  processorRetryCount: z.number().optional(),
  processorRetryFeedback: z.string().optional(),
  isTaskCompleteCheckFailed: z.boolean().optional(), //true if the isTaskComplete check failed and LLM has to run again
});

export const toolCallInputSchema = z.object({
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.record(z.any()),
  providerMetadata: z.record(z.any()).optional(),
  providerExecuted: z.boolean().optional(),
  output: z.any().optional(),
});

export const toolCallOutputSchema = toolCallInputSchema.extend({
  result: z.any(),
  error: z.any().optional(),
});
