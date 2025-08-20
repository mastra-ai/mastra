import type { JSONSchema7, LanguageModelV1ProviderMetadata } from '@ai-sdk/provider';
import type { IDGenerator, Message, TelemetrySettings } from 'ai';
import type { ModelMessage, ToolChoice } from 'ai-v5';
import type { z, ZodSchema } from 'zod';
import type { CoreMessage } from '../llm';
import type { StreamTextOnFinishCallback, StreamTextOnStepFinishCallback } from '../llm/model/base.types';
import type { LoopConfig, LoopOptions } from '../loop/types';
import type { InputProcessor, OutputProcessor } from '../processors';
import type { RuntimeContext } from '../runtime-context';
import type { MastraScorers } from '../scores';
import type { ChunkType } from '../stream/types';
import type { MessageListInput } from './message-list';
import type { AgentMemoryOption, ToolsetsInput, ToolsInput, StructuredOutputOptions } from './types';

export type CallSettings = {
  /**
Maximum number of tokens to generate.
   */
  maxTokens?: number;
  /**
Temperature setting. This is a number between 0 (almost no randomness) and
1 (very random).

It is recommended to set either `temperature` or `topP`, but not both.

@default 0
   */
  temperature?: number;
  /**
Nucleus sampling. This is a number between 0 and 1.

E.g. 0.1 would mean that only tokens with the top 10% probability mass
are considered.

It is recommended to set either `temperature` or `topP`, but not both.
   */
  topP?: number;
  /**
Only sample from the top K options for each subsequent token.

Used to remove "long tail" low probability responses.
Recommended for advanced use cases only. You usually only need to use temperature.
   */
  topK?: number;
  /**
Presence penalty setting. It affects the likelihood of the model to
repeat information that is already in the prompt.

The presence penalty is a number between -1 (increase repetition)
and 1 (maximum penalty, decrease repetition). 0 means no penalty.
   */
  presencePenalty?: number;
  /**
Frequency penalty setting. It affects the likelihood of the model
to repeatedly use the same words or phrases.

The frequency penalty is a number between -1 (increase repetition)
and 1 (maximum penalty, decrease repetition). 0 means no penalty.
   */
  frequencyPenalty?: number;
  /**
Stop sequences.
If set, the model will stop generating text when one of the stop sequences is generated.
Providers may have limits on the number of stop sequences.
   */
  stopSequences?: string[];
  /**
The seed (integer) to use for random sampling. If set and supported
by the model, calls will generate deterministic results.
   */
  seed?: number;
  /**
Maximum number of retries. Set to 0 to disable retries.

@default 2
   */
  maxRetries?: number;
  /**
Abort signal.
   */
  abortSignal?: AbortSignal;
  /**
Additional HTTP headers to be sent with the request.
Only applicable for HTTP-based providers.
   */
  headers?: Record<string, string | undefined>;
};

type Prompt = {
  /**
System message to include in the prompt. Can be used with `prompt` or `messages`.
   */
  system?: string;
  /**
A simple text prompt. You can either use `prompt` or `messages` but not both.
 */
  prompt?: string;
  /**
A list of messages. You can either use `prompt` or `messages` but not both.
   */
  messages?: Array<CoreMessage> | Array<Omit<Message, 'id'>>;
};

export type AgentExecutionOptions<
  OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  STRUCTURED_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  FORMAT extends 'mastra' | 'aisdk' = 'mastra' | 'aisdk',
> = {
  instructions?: string;
  context?: ModelMessage[];

  memory?: AgentMemoryOption;

  runId?: string;

  savePerStep?: boolean;
  runtimeContext?: RuntimeContext;
  format?: FORMAT;
  output?: OUTPUT;
  experimental_output?: STRUCTURED_OUTPUT;
  resourceId?: string;
  threadId?: string;

  telemetry?: TelemetrySettings;

  stopWhen?: LoopOptions['stopWhen'];

  abortSignal?: AbortSignal;

  onStepFinish?: FORMAT extends 'aisdk' ? StreamTextOnStepFinishCallback<any> : LoopConfig['onStepFinish'];

  onFinish?: FORMAT extends 'aisdk' ? StreamTextOnFinishCallback<any> : LoopConfig['onFinish'];

  /** Input processors to use for this stream call (overrides agent's default) */
  inputProcessors?: InputProcessor[];
  /** Output processors to use for this stream call (overrides agent's default) */
  outputProcessors?: OutputProcessor[];
  structuredOutput?: STRUCTURED_OUTPUT extends z.ZodTypeAny ? StructuredOutputOptions<STRUCTURED_OUTPUT> : never;
  /** Additional tool sets that can be used for this generation */
  toolsets?: ToolsetsInput;
  clientTools?: ToolsInput;
  toolChoice?: ToolChoice<any>;

  modelSettings?: LoopOptions['modelSettings'];

  scorers?: MastraScorers;
  returnScorerData?: boolean;
};

export type InnerAgentExecutionOptions = AgentExecutionOptions & {
  writableStream?: WritableStream<ChunkType>;
  messages: MessageListInput;
};

/**
 * Options for streaming responses with an agent
 * @template OUTPUT - The schema type for structured output (Zod schema)
 */
export type AgentVNextStreamOptions<
  Output extends ZodSchema | undefined = undefined,
  StructuredOutput extends ZodSchema | undefined = undefined,
> = {
  /** Optional instructions to override the agent's default instructions */
  instructions?: string;
  /** Additional tool sets that can be used for this generation */
  toolsets?: ToolsetsInput;
  clientTools?: ToolsInput;
  /** Additional context messages to include */
  context?: CoreMessage[];
  /** New memory options (preferred) */
  memory?: AgentMemoryOption;
  /** Unique ID for this generation run */
  runId?: string;
  /** Callback fired when streaming completes */
  onFinish?: StreamTextOnFinishCallback<any>;
  /** Callback fired after each generation step completes */
  onStepFinish?: StreamTextOnStepFinishCallback<any>;
  /** Controls how tools are selected during generation */
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string };
  /** Telemetry settings */
  telemetry?: TelemetrySettings;
  /** RuntimeContext for dependency injection */
  runtimeContext?: RuntimeContext;
  /** Generate a unique ID for each message. */
  experimental_generateMessageId?: IDGenerator;
  /**
    Additional provider-specific options. They are passed through
    to the provider from the AI SDK and enable provider-specific
    functionality that can be fully encapsulated in the provider.
   */
  providerOptions?: LanguageModelV1ProviderMetadata;

  /** Whether to save messages incrementally on step finish */
  savePerStep?: boolean;
  /** Input processors to use for this stream call (overrides agent's default) */
  inputProcessors?: InputProcessor[];
  /** Output processors to use for this stream call (overrides agent's default) */
  outputProcessors?: OutputProcessor[];
  /**
   * Structured output configuration using StructuredOutputProcessor.
   * This provides better DX than manually creating the processor.
   */
  structuredOutput?: StructuredOutput extends z.ZodTypeAny ? StructuredOutputOptions<StructuredOutput> : never;
} & CallSettings &
  Prompt &
  (Output extends undefined
    ? {
        experimental_output?: StructuredOutput;
        maxSteps?: number;
        output?: never;
      }
    : {
        output: Output;
        experimental_output?: never;
        maxSteps?: never;
      });
