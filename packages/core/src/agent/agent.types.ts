import type { LanguageModelV1ProviderMetadata } from '@ai-sdk/provider';
import type { IDGenerator, Message, TelemetrySettings } from 'ai';
import type { ZodSchema } from 'zod';
import type { CoreMessage } from '../llm';
import type { StreamTextOnFinishCallback, StreamTextOnStepFinishCallback } from '../llm/model/base.types';
import type { RuntimeContext } from '../runtime-context';
import type { AgentMemoryOption, ToolsetsInput, ToolsInput } from './types';

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
