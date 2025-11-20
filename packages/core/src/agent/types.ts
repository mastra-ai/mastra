import type { GenerateTextOnStepFinishCallback, ToolSet } from '@internal/ai-sdk-v4';
import type { ProviderDefinedTool } from '@internal/external-types';
import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema } from 'zod';
import type { MastraScorer, MastraScorers, ScoringSamplingConfig } from '../evals';
import type {
  CoreMessage,
  DefaultLLMStreamOptions,
  DefaultLLMStreamObjectOptions,
  DefaultLLMTextObjectOptions,
  DefaultLLMTextOptions,
  OutputType,
  SystemMessage,
  MastraModelConfig,
  OpenAICompatibleConfig,
} from '../llm';
import type { ModelRouterModelId } from '../llm/model';
import type {
  StreamTextOnFinishCallback,
  StreamTextOnStepFinishCallback,
  StreamObjectOnFinishCallback,
} from '../llm/model/base.types';
import type { ProviderOptions } from '../llm/model/provider-options';
import type { Mastra } from '../mastra';
import type { MastraMemory } from '../memory/memory';
import type { MemoryConfig, StorageThreadType } from '../memory/types';
import type { Span, SpanType, TracingContext, TracingOptions, TracingPolicy } from '../observability';
import type { InputProcessor, OutputProcessor } from '../processors/index';
import type { RequestContext } from '../request-context';
import type { OutputSchema } from '../stream';
import type { InferSchemaOutput } from '../stream/base/schema';
import type { ModelManagerModelConfig } from '../stream/types';
import type { ToolAction, VercelTool, VercelToolV5 } from '../tools';
import type { DynamicArgument } from '../types';
import type { CompositeVoice } from '../voice';
import type { Workflow } from '../workflows';
import type { Agent } from './agent';
import type { AgentExecutionOptions } from './agent.types';
import type { MessageList } from './message-list/index';
import type { SaveQueueManager } from './save-queue';

export type { MastraDBMessage, MastraMessageContentV2, UIMessageWithMetadata, MessageList } from './message-list/index';
export type { Message as AiMessageType } from '@internal/ai-sdk-v4';
export type { LLMStepResult } from '../stream/types';

/**
 * Accepts Mastra tools, Vercel AI SDK tools, and provider-defined tools
 * (e.g., google.tools.googleSearch()).
 */
export type ToolsInput = Record<string, ToolAction<any, any, any> | VercelTool | VercelToolV5 | ProviderDefinedTool>;

export type AgentInstructions = SystemMessage;
export type DynamicAgentInstructions = DynamicArgument<AgentInstructions>;

export type ToolsetsInput = Record<string, ToolsInput>;

type FallbackFields<OUTPUT extends OutputSchema = undefined> =
  | { errorStrategy?: 'strict' | 'warn'; fallbackValue?: never }
  | { errorStrategy: 'fallback'; fallbackValue: InferSchemaOutput<OUTPUT> };

export type StructuredOutputOptions<OUTPUT extends OutputSchema = undefined> = {
  /** Zod schema to validate the output against */
  schema: OUTPUT;

  /** Model to use for the internal structuring agent. If not provided, falls back to the agent's model */
  model?: MastraModelConfig;

  /**
   * Custom instructions for the structuring agent.
   * If not provided, will generate instructions based on the schema.
   */
  instructions?: string;

  /**
   * Whether to use system prompt injection instead of native response format to coerce the LLM to respond with json text if the LLM does not natively support structured outputs.
   */
  jsonPromptInjection?: boolean;
} & FallbackFields<OUTPUT>;

export type SerializableStructuredOutputOptions<OUTPUT extends OutputSchema = undefined> = Omit<
  StructuredOutputOptions<OUTPUT>,
  'model'
> & { model?: ModelRouterModelId | OpenAICompatibleConfig };

/**
 * Provide options while creating an agent.
 */
export interface AgentCreateOptions {
  tracingPolicy?: TracingPolicy;
}

// This is used in place of DynamicArgument so that model router IDE autocomplete works.
// Without this TS doesn't understand the function/string union type from DynamicArgument
type DynamicModel = ({
  requestContext,
  mastra,
}: {
  requestContext: RequestContext;
  mastra?: Mastra;
}) => Promise<MastraModelConfig> | MastraModelConfig;

type ModelWithRetries = {
  id?: string;
  model: MastraModelConfig | DynamicModel;
  maxRetries?: number; //defaults to 0
  enabled?: boolean; //defaults to true
};

export interface AgentConfig<TAgentId extends string = string, TTools extends ToolsInput = ToolsInput> {
  /**
   * Identifier for the agent.
   * @defaultValue Uses `name` if not provided.
   */
  id?: TAgentId;
  /**
   * Unique identifier for the agent.
   */
  name: TAgentId;
  /**
   * Description of the agent's purpose and capabilities.
   */
  description?: string;
  /**
   * Instructions that guide the agent's behavior. Can be a string, array of strings, system message object,
   * array of system messages, or a function that returns any of these types dynamically.
   */
  instructions: DynamicAgentInstructions;
  /**
   * The language model used by the agent. Can be provided statically or resolved at runtime.
   */
  model: MastraModelConfig | DynamicModel | ModelWithRetries[];
  /**
   * Maximum number of retries for model calls in case of failure.
   * @defaultValue 0
   */
  maxRetries?: number;
  /**
   * Tools that the agent can access. Can be provided statically or resolved dynamically.
   */
  tools?: DynamicArgument<TTools>;
  /**
   * Workflows that the agent can execute. Can be static or dynamically resolved.
   */
  workflows?: DynamicArgument<Record<string, Workflow<any, any, any, any, any, any>>>;
  /**
   * Default options used when calling `generate()`.
   */
  defaultGenerateOptionsLegacy?: DynamicArgument<AgentGenerateOptions>;
  /**
   * Default options used when calling `stream()`.
   */
  defaultStreamOptionsLegacy?: DynamicArgument<AgentStreamOptions>;
  /**
   * Default options used when calling `stream()` in vNext mode.
   */
  defaultOptions?: DynamicArgument<AgentExecutionOptions>;
  /**
   * Reference to the Mastra runtime instance (injected automatically).
   */
  mastra?: Mastra;
  /**
   * Sub-Agents that the agent can access. Can be provided statically or resolved dynamically.
   */
  agents?: DynamicArgument<Record<string, Agent>>;
  /**
   * Scoring configuration for runtime evaluation and observability. Can be static or dynamically provided.
   */
  scorers?: DynamicArgument<MastraScorers>;

  /**
   * Memory module used for storing and retrieving stateful context.
   */
  memory?: DynamicArgument<MastraMemory>;
  /**
   * Voice settings for speech input and output.
   */
  voice?: CompositeVoice;
  /**
   * Input processors that can modify or validate messages before they are processed by the agent. These processors need to implement the `processInput` function.
   */
  inputProcessors?: DynamicArgument<InputProcessor[]>;
  /**
   * Output processors that can modify or validate messages from the agent, before it is sent to the client. These processors need to implement either (or both) of the `processOutputResult` and `processOutputStream` functions.
   */
  outputProcessors?: DynamicArgument<OutputProcessor[]>;
  /**
   * Options to pass to the agent upon creation.
   */
  options?: AgentCreateOptions;
}

export type AgentMemoryOption = {
  thread: string | (Partial<StorageThreadType> & { id: string });
  resource: string;
  options?: MemoryConfig;
  readOnly?: boolean;
};

/**
 * Options for generating responses with an agent
 * @template OUTPUT - The schema type for structured output (Zod schema or JSON schema)
 * @template EXPERIMENTAL_OUTPUT - The schema type for structured output generation alongside tool calls (Zod schema or JSON schema)
 */
export type AgentGenerateOptions<
  OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
> = {
  /** Optional instructions to override the agent's default instructions */
  instructions?: SystemMessage;
  /** Additional tool sets that can be used for this generation */
  toolsets?: ToolsetsInput;
  clientTools?: ToolsInput;
  /** Additional context messages to include */
  context?: CoreMessage[];
  /** New memory options (preferred) */
  memory?: AgentMemoryOption;
  /** Unique ID for this generation run */
  runId?: string;
  /** Callback fired after each generation step completes */
  onStepFinish?: OUTPUT extends undefined ? GenerateTextOnStepFinishCallback<any> : never;
  /** Maximum number of steps allowed for generation */
  maxSteps?: number;
  /** Schema for structured output, does not work with tools, use experimental_output instead */
  output?: OutputType | OUTPUT;
  /** Schema for structured output generation alongside tool calls. */
  experimental_output?: EXPERIMENTAL_OUTPUT;
  /** Controls how tools are selected during generation */
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string };
  /** RequestContext for dependency injection */
  requestContext?: RequestContext;
  /** Scorers to use for this generation */
  scorers?: MastraScorers | Record<string, { scorer: MastraScorer['name']; sampling?: ScoringSamplingConfig }>;
  /** Whether to return the input required to run scorers for agents, defaults to false */
  returnScorerData?: boolean;
  /**
   * Whether to save messages incrementally on step finish
   * @default false
   */
  savePerStep?: boolean;
  /** Input processors to use for this generation call (overrides agent's default) */
  inputProcessors?: InputProcessor[];
  /** Output processors to use for this generation call (overrides agent's default) */
  outputProcessors?: OutputProcessor[];
  /** tracing context for span hierarchy and metadata */
  tracingContext?: TracingContext;
  /** tracing options for starting new traces */
  tracingOptions?: TracingOptions;
  /** Provider-specific options for supported AI SDK packages (Anthropic, Google, OpenAI, xAI) */
  providerOptions?: ProviderOptions;
} & (
  | {
      /**
       * @deprecated Use the `memory` property instead for all memory-related options.
       */
      resourceId?: undefined;
      /**
       * @deprecated Use the `memory` property instead for all memory-related options.
       */
      threadId?: undefined;
    }
  | {
      /**
       * @deprecated Use the `memory` property instead for all memory-related options.
       */
      resourceId: string;
      /**
       * @deprecated Use the `memory` property instead for all memory-related options.
       */
      threadId: string;
    }
) &
  (OUTPUT extends undefined ? DefaultLLMTextOptions : DefaultLLMTextObjectOptions);

/**
 * Options for streaming responses with an agent
 * @template OUTPUT - The schema type for structured output (Zod schema or JSON schema)
 * @template EXPERIMENTAL_OUTPUT - The schema type for structured output generation alongside tool calls (Zod schema or JSON schema)
 */
export type AgentStreamOptions<
  OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
> = {
  /** Optional instructions to override the agent's default instructions */
  instructions?: SystemMessage;
  /** Additional tool sets that can be used for this generation */
  toolsets?: ToolsetsInput;
  clientTools?: ToolsInput;
  /** Additional context messages to include */
  context?: CoreMessage[];
  /**
   * @deprecated Use the `memory` property instead for all memory-related options.
   */
  memoryOptions?: MemoryConfig;
  /** New memory options (preferred) */
  memory?: AgentMemoryOption;
  /** Unique ID for this generation run */
  runId?: string;
  /** Callback fired when streaming completes */
  onFinish?: OUTPUT extends undefined ? StreamTextOnFinishCallback<any> : StreamObjectOnFinishCallback<OUTPUT>;
  /** Callback fired after each generation step completes */
  onStepFinish?: OUTPUT extends undefined ? StreamTextOnStepFinishCallback<any> : never;
  /** Maximum number of steps allowed for generation */
  maxSteps?: number;
  /** Schema for structured output */
  output?: OutputType | OUTPUT;
  /** Temperature parameter for controlling randomness */
  temperature?: number;
  /** Controls how tools are selected during generation */
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string };
  /** Experimental schema for structured output */
  experimental_output?: EXPERIMENTAL_OUTPUT;
  /** RequestContext for dependency injection */
  requestContext?: RequestContext;
  /**
   * Whether to save messages incrementally on step finish
   * @default false
   */
  savePerStep?: boolean;
  /** Input processors to use for this generation call (overrides agent's default) */
  inputProcessors?: InputProcessor[];
  /** tracing context for span hierarchy and metadata */
  tracingContext?: TracingContext;
  /** tracing options for starting new traces */
  tracingOptions?: TracingOptions;
  /** Scorers to use for this generation */
  scorers?: MastraScorers | Record<string, { scorer: MastraScorer['name']; sampling?: ScoringSamplingConfig }>;
  /** Provider-specific options for supported AI SDK packages (Anthropic, Google, OpenAI, xAI) */
  providerOptions?: ProviderOptions;
} & (
  | {
      /**
       * @deprecated Use the `memory` property instead for all memory-related options.
       */
      resourceId?: undefined;
      /**
       * @deprecated Use the `memory` property instead for all memory-related options.
       */
      threadId?: undefined;
    }
  | {
      /**
       * @deprecated Use the `memory` property instead for all memory-related options.
       */
      resourceId: string;
      /**
       * @deprecated Use the `memory` property instead for all memory-related options.
       */
      threadId: string;
    }
) &
  (OUTPUT extends undefined ? DefaultLLMStreamOptions : DefaultLLMStreamObjectOptions);

export type AgentModelManagerConfig = ModelManagerModelConfig & { enabled: boolean };

export type AgentExecuteOnFinishOptions = {
  runId: string;
  result: Parameters<StreamTextOnFinishCallback<ToolSet>>[0] & { object?: unknown };
  thread: StorageThreadType | null | undefined;
  readOnlyMemory?: boolean;
  threadId?: string;
  resourceId?: string;
  requestContext: RequestContext;
  agentSpan?: Span<SpanType.AGENT_RUN>;
  memoryConfig: MemoryConfig | undefined;
  outputText: string;
  messageList: MessageList;
  threadExists: boolean;
  structuredOutput?: boolean;
  saveQueueManager: SaveQueueManager;
  overrideScorers?: MastraScorers | Record<string, { scorer: MastraScorer['name']; sampling?: ScoringSamplingConfig }>;
};

export type AgentMethodType = 'generate' | 'stream' | 'generateLegacy' | 'streamLegacy';
