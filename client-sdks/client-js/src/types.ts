import type {
  AgentExecutionOptions,
  MultiPrimitiveExecutionOptions,
  AgentGenerateOptions,
  AgentStreamOptions,
  SerializableStructuredOutputOptions,
  ToolsInput,
  UIMessageWithMetadata,
  AgentInstructions,
  AgentEditorConfig,
} from '@mastra/core/agent';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { BuilderModelPolicy, DefaultModelEntry, ProviderModelEntry } from '@mastra/core/agent-builder/ee';
import type { MastraScorerEntry, ScoreRowData } from '@mastra/core/evals';
import type { CoreMessage, Provider as ModelProviderId } from '@mastra/core/llm';
import type { LogLevel } from '@mastra/core/logger';
import type { MCPToolType, ServerInfo } from '@mastra/core/mcp';
import type {
  AiMessageType,
  MastraMessageV1,
  MastraDBMessage,
  MemoryConfig,
  StorageThreadType,
} from '@mastra/core/memory';
import type { TracingOptions } from '@mastra/core/observability';
import type { RequestContext } from '@mastra/core/request-context';

import type {
  AgentInstructionBlock,
  PaginationInfo,
  WorkflowRuns,
  StorageListMessagesInput,
  Rule,
  RuleGroup,
  StorageConditionalVariant,
  StorageConditionalField,
  StoredProcessorGraph,
} from '@mastra/core/storage';
import type { ChunkType } from '@mastra/core/stream';
import type { QueryResult } from '@mastra/core/vector';
import type {
  TimeTravelContext,
  Workflow,
  WorkflowResult,
  WorkflowRunStatus,
  WorkflowState,
} from '@mastra/core/workflows';
import type { PublicSchema } from '@mastra/schema-compat/schema';

import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema as ZodSchemaV3 } from 'zod/v3';
import type { ZodType as ZodTypeV4 } from 'zod/v4';

import type { Body, QueryParams, RouteKey, RouteResponse, Simplify } from './route-types.generated.js';

export type ZodSchema = ZodSchemaV3 | ZodTypeV4;

type OptionalizeUndefined<T> = T extends Date
  ? Date
  : T extends (...args: any[]) => any
    ? T
    : T extends readonly (infer U)[]
      ? OptionalizeUndefined<U>[]
      : T extends object
        ? Simplify<
            {
              [K in keyof T as undefined extends T[K] ? never : K]: OptionalizeUndefined<T[K]>;
            } & {
              [K in keyof T as undefined extends T[K] ? K : never]?: OptionalizeUndefined<Exclude<T[K], undefined>>;
            }
          >
        : T;

type Serialized<T> = T extends Date
  ? string
  : T extends readonly (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? {
          [K in keyof T]: Serialized<T[K]>;
        }
      : T;

type RequestContextOptions = {
  requestContext?: RequestContext | Record<string, any>;
};

type GeneratedRequest<T> = OptionalizeUndefined<T>;
type GeneratedResponse<T extends RouteKey> = Serialized<RouteResponse<T>>;

export interface ClientOptions {
  /** Base URL for API requests */
  baseUrl: string;
  /** API route prefix. Defaults to '/api'. Set this to match your server's apiPrefix configuration. */
  apiPrefix?: string;
  /** Number of retry attempts for failed requests */
  retries?: number;
  /** Initial backoff time in milliseconds between retries */
  backoffMs?: number;
  /** Maximum backoff time in milliseconds between retries */
  maxBackoffMs?: number;
  /** Custom headers to include with requests */
  headers?: Record<string, string>;
  /** Abort signal for request */
  abortSignal?: AbortSignal;
  /** Credentials mode for requests. See https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials for more info. */
  credentials?: 'omit' | 'same-origin' | 'include';
  /** Custom fetch function to use for HTTP requests. Useful for environments like Tauri that require custom fetch implementations. */
  fetch?: typeof fetch;
}

export type AgentVersionIdentifier = { versionId: string } | { status: 'draft' | 'published' };

/**
 * @experimental Agent signals are experimental and may change in a future release.
 */
export type AgentSignalActiveBehavior = 'deliver' | 'persist' | 'discard';

/**
 * @experimental Agent signals are experimental and may change in a future release.
 */
export type AgentSignalIdleBehavior = 'wake' | 'persist' | 'discard';

/**
 * @experimental Agent signals are experimental and may change in a future release.
 */
export type SendAgentSignalParams = GeneratedRequest<Body<'POST /agents/:agentId/signals'>>;

/**
 * @experimental Agent message APIs are experimental and may change in a future release.
 */
export type SendAgentMessageParams = GeneratedRequest<Body<'POST /agents/:agentId/send-message'>>;

/**
 * @experimental Agent message APIs are experimental and may change in a future release.
 */
export type QueueAgentMessageParams = GeneratedRequest<Body<'POST /agents/:agentId/queue-message'>>;

/**
 * @experimental Agent signals are experimental and may change in a future release.
 */
export interface SubscribeAgentThreadParams {
  resourceId?: string;
  threadId: string;
}

export type ListAgentSuspendedRunsParams = GeneratedRequest<QueryParams<'GET /agents/:agentId/suspended-runs'>>;

/**
 * Listed suspended runs as returned by `agent.listSuspendedRuns()`.
 * Date fields (e.g. `suspendedAt`) are ISO strings over the wire, matching
 * the rest of the client SDK.
 */
export type ListAgentSuspendedRunsResponse = GeneratedResponse<'GET /agents/:agentId/suspended-runs'>;

export type AgentSuspendedRun = ListAgentSuspendedRunsResponse['runs'][number];

export type AgentSuspendedRunToolCall = AgentSuspendedRun['toolCalls'][number];

/**
 * @experimental Agent signals are experimental and may change in a future release.
 */
export interface ProcessAgentThreadStreamOptions {
  onChunk: (chunk: ChunkType) => void | Promise<void>;
  reconnect?:
    | boolean
    | {
        /** Maximum reconnect attempts after the initial stream ends or errors. Defaults to Infinity. */
        maxRetries?: number;
        /** Delay between reconnect attempts in milliseconds. Defaults to 1000. */
        delayMs?: number;
      };
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  stream?: boolean;
  /** Credentials mode for requests. See https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials for more info. */
  credentials?: 'omit' | 'same-origin' | 'include';
}

export type ResponseInputTextPart = {
  type: 'input_text' | 'text' | 'output_text';
  text: string;
};

export type ResponseInputMessage = {
  role: 'system' | 'developer' | 'user' | 'assistant';
  content: string | ResponseInputTextPart[];
};

export type ResponseTextFormat =
  | {
      type: 'json_object';
    }
  | {
      type: 'json_schema';
      name: string;
      description?: string;
      schema: Record<string, unknown>;
      strict?: boolean;
    };

export type ResponseTextConfig = {
  format: ResponseTextFormat;
};

export type ResponseOutputText = {
  type: 'output_text';
  text: string;
  annotations?: unknown[];
  logprobs?: unknown[];
};

export type ResponseOutputMessage = {
  id: string;
  type: 'message';
  role: 'assistant';
  status: 'in_progress' | 'completed' | 'incomplete';
  content: ResponseOutputText[];
};

export type ResponseOutputFunctionCall = {
  id: string;
  type: 'function_call';
  call_id: string;
  name: string;
  arguments: string;
  status?: 'in_progress' | 'completed' | 'incomplete';
};

export type ResponseOutputFunctionCallOutput = {
  id: string;
  type: 'function_call_output';
  call_id: string;
  output: string;
};

export type ResponseUsage = {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_tokens_details?: {
    cached_tokens: number;
  };
  output_tokens_details?: {
    reasoning_tokens: number;
  };
};

export type ResponseTool = {
  type: 'function';
  name: string;
  description?: string;
  parameters?: unknown;
};

export type ResponseOutputItem = ResponseOutputMessage | ResponseOutputFunctionCall | ResponseOutputFunctionCallOutput;

export type ConversationItemInputText = {
  type: 'input_text';
  text: string;
};

export type ConversationItemMessage = {
  id: string;
  type: 'message';
  role: 'system' | 'user' | 'assistant';
  status: 'completed';
  content: Array<ConversationItemInputText | ResponseOutputText>;
};

export type ConversationItem = ConversationItemMessage | ResponseOutputFunctionCall | ResponseOutputFunctionCallOutput;

export type ConversationItemsPage = {
  object: 'list';
  data: ConversationItem[];
  first_id: string | null;
  last_id: string | null;
  has_more: boolean;
};

export type ResponsesResponse = {
  id: string;
  object: 'response';
  created_at: number;
  completed_at?: number | null;
  model: string;
  status: 'in_progress' | 'completed' | 'incomplete';
  output: ResponseOutputItem[];
  usage: ResponseUsage | null;
  error?: {
    code?: string;
    message?: string;
  } | null;
  incomplete_details?: {
    reason?: string;
  } | null;
  instructions?: string | null;
  text?: ResponseTextConfig | null;
  previous_response_id?: string | null;
  conversation_id?: string | null;
  /** Provider-returned response state, such as `openai.responseId`, for provider-native continuation. */
  providerOptions?: Record<string, Record<string, unknown> | undefined>;
  tools?: ResponseTool[];
  store?: boolean;
  output_text: string;
};

export type ResponsesDeleteResponse = {
  id: string;
  object: 'response';
  deleted: true;
};

export type CreateResponseParams = {
  /** Optional model override, such as `openai/gpt-5`. When omitted, the agent default model is used. */
  model?: string;
  /** Mastra agent ID for the request. Required on initial requests; stored follow-ups can omit it when using `previous_response_id`. */
  agent_id?: string;
  /** Input text or message history for the current turn. */
  input: string | ResponseInputMessage[];
  /** Request-scoped instructions for the current response. */
  instructions?: string;
  /** Optional text output format. Supports `json_object` and `json_schema`. */
  text?: ResponseTextConfig;
  /** Optional conversation ID. In Mastra this is the raw threadId. */
  conversation_id?: string;
  /** Optional provider-specific options passed through to the underlying model call. */
  providerOptions?: Record<string, Record<string, unknown> | undefined>;
  /** When true, returns a streaming Responses API event stream. */
  stream?: boolean;
  /** Persists the response through the selected agent's memory. Requires a memory-backed agent. */
  store?: boolean;
  /** Continues a previously stored response chain. */
  previous_response_id?: string;
  requestContext?: RequestContext | Record<string, any>;
};

export type Conversation = {
  id: string;
  object: 'conversation';
  thread: StorageThreadType;
};

export type ConversationDeleted = {
  id: string;
  object: 'conversation.deleted';
  deleted: true;
};

export type CreateConversationParams = {
  agent_id: string;
  conversation_id?: string;
  resource_id?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  requestContext?: RequestContext | Record<string, any>;
};

export type ResponsesCreatedEvent = {
  type: 'response.created';
  response: ResponsesResponse;
  sequence_number?: number;
};

export type ResponsesInProgressEvent = {
  type: 'response.in_progress';
  response: ResponsesResponse;
  sequence_number?: number;
};

export type ResponsesOutputItemAddedEvent = {
  type: 'response.output_item.added';
  output_index: number;
  item: ResponseOutputItem;
  sequence_number?: number;
};

export type ResponsesContentPartAddedEvent = {
  type: 'response.content_part.added';
  output_index: number;
  content_index: number;
  item_id: string;
  part: ResponseOutputText;
  sequence_number?: number;
};

export type ResponsesOutputTextDeltaEvent = {
  type: 'response.output_text.delta';
  output_index: number;
  content_index: number;
  item_id: string;
  delta: string;
  sequence_number?: number;
};

export type ResponsesOutputTextDoneEvent = {
  type: 'response.output_text.done';
  output_index: number;
  content_index: number;
  item_id: string;
  text: string;
  sequence_number?: number;
};

export type ResponsesContentPartDoneEvent = {
  type: 'response.content_part.done';
  output_index: number;
  content_index: number;
  item_id: string;
  part: ResponseOutputText;
  sequence_number?: number;
};

export type ResponsesOutputItemDoneEvent = {
  type: 'response.output_item.done';
  output_index: number;
  item: ResponseOutputItem;
  sequence_number?: number;
};

export type ResponsesFunctionCallArgumentsDeltaEvent = {
  type: 'response.function_call_arguments.delta';
  output_index: number;
  item_id: string;
  delta: string;
  sequence_number?: number;
};

export type ResponsesFunctionCallArgumentsDoneEvent = {
  type: 'response.function_call_arguments.done';
  output_index: number;
  item_id: string;
  name: string;
  arguments: string;
  sequence_number?: number;
};

export type ResponsesCompletedEvent = {
  type: 'response.completed';
  response: ResponsesResponse;
  sequence_number?: number;
};

export type ResponsesStreamEvent =
  | ResponsesCreatedEvent
  | ResponsesInProgressEvent
  | ResponsesOutputItemAddedEvent
  | ResponsesContentPartAddedEvent
  | ResponsesOutputTextDeltaEvent
  | ResponsesOutputTextDoneEvent
  | ResponsesContentPartDoneEvent
  | ResponsesOutputItemDoneEvent
  | ResponsesFunctionCallArgumentsDeltaEvent
  | ResponsesFunctionCallArgumentsDoneEvent
  | ResponsesCompletedEvent;

type WithoutMethods<T> = {
  [
    K in keyof T as T[K] extends (...args: any[]) => any
      ? never
      : T[K] extends { (): any }
        ? never
        : T[K] extends undefined | ((...args: any[]) => any)
          ? never
          : K
  ]: T[K];
};

export type NetworkStreamParams<OUTPUT = undefined> = {
  messages: MessageListInput;
  model?: string;
  tracingOptions?: TracingOptions;
} & Omit<MultiPrimitiveExecutionOptions<OUTPUT>, 'model'>;

export interface GetAgentResponse {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  instructions: AgentInstructions;
  tools: Record<string, GetToolResponse>;
  workflows: Record<string, GetWorkflowResponse>;
  agents: Record<string, { id: string; name: string }>;
  skills?: SkillMetadata[];
  workspaceTools?: string[];
  /** Browser tool names available to this agent (if browser is configured) */
  browserTools?: string[];
  /** ID of the agent's workspace (if configured) */
  workspaceId?: string;
  provider: string;
  modelId: string;
  modelVersion: string;
  supportsMemory?: boolean;
  modelList:
    | Array<{
        id: string;
        enabled: boolean;
        maxRetries: number;
        model: {
          modelId: string;
          provider: string;
          modelVersion: string;
        };
      }>
    | undefined;
  inputProcessors?: Array<{ id: string; name: string }>;
  outputProcessors?: Array<{ id: string; name: string }>;
  defaultOptions: WithoutMethods<AgentExecutionOptions>;
  defaultGenerateOptionsLegacy: WithoutMethods<AgentGenerateOptions>;
  defaultStreamOptionsLegacy: WithoutMethods<AgentStreamOptions>;
  /** Serialized JSON schema for request context validation */
  requestContextSchema?: string;
  source?: 'code' | 'stored';
  status?: 'draft' | 'published' | 'archived';
  activeVersionId?: string;
  hasDraft?: boolean;
  editor?: AgentEditorConfig;
}

/**
 * Response from the browser session probe endpoint.
 *
 * Use this to decide whether to open a screencast WebSocket for an agent/thread:
 * - `screencastAvailable`: server has the `ws` / `@hono/node-ws` packages installed.
 *   When false, opening a WS will fail and trigger a reconnect loop — skip it.
 * - `hasSession`: the agent has an active browser session for this thread. When
 *   false, the WS would just sit idle waiting for the agent to invoke a tool.
 */
export interface GetAgentBrowserSessionResponse {
  hasSession: boolean;
  screencastAvailable: boolean;
}

export type GenerateLegacyParams<T extends JSONSchema7 | ZodSchema | undefined = undefined> = {
  messages: string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[];
  model?: string;
  output?: T;
  experimental_output?: T;
  requestContext?: RequestContext | Record<string, any>;
  clientTools?: ToolsInput;
} & WithoutMethods<
  // Use `any` to avoid "Type instantiation is excessively deep" error from complex ZodSchema generics
  Omit<
    AgentGenerateOptions<any>,
    'model' | 'output' | 'experimental_output' | 'requestContext' | 'clientTools' | 'abortSignal'
  >
>;

export type StreamLegacyParams<T extends JSONSchema7 | ZodSchema | undefined = undefined> = {
  messages: string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[];
  model?: string;
  output?: T;
  experimental_output?: T;
  requestContext?: RequestContext | Record<string, any>;
  clientTools?: ToolsInput;
} & WithoutMethods<
  // Use `any` to avoid "Type instantiation is excessively deep" error from complex ZodSchema generics
  Omit<
    AgentStreamOptions<any>,
    'model' | 'output' | 'experimental_output' | 'requestContext' | 'clientTools' | 'abortSignal'
  >
>;

export type StructuredOutputOptions<OUTPUT = undefined> = Omit<
  SerializableStructuredOutputOptions<OUTPUT>,
  'schema'
> & {
  schema: PublicSchema<OUTPUT>;
};
export type StreamParamsBase<OUTPUT = undefined> = {
  model?: string;
  tracingOptions?: TracingOptions;
  requestContext?: RequestContext;
  clientTools?: ToolsInput;
} & WithoutMethods<
  Omit<
    AgentExecutionOptions<OUTPUT>,
    'model' | 'requestContext' | 'clientTools' | 'options' | 'abortSignal' | 'structuredOutput'
  >
>;
export type StreamParamsBaseWithoutMessages<OUTPUT = undefined> = StreamParamsBase<OUTPUT>;
export type StreamParams<OUTPUT = undefined> = StreamParamsBase<OUTPUT> & {
  messages: MessageListInput;
} & (OUTPUT extends undefined ? { structuredOutput?: never } : { structuredOutput: StructuredOutputOptions<OUTPUT> });

/**
 * Provider id widened to accept admin-configured custom gateway providers.
 * Closed unions over the five hard-coded providers are removed in favor of the
 * generated `ModelProviderId` union plus a `(string & {})` escape hatch — this
 * preserves IDE autocomplete on known providers while letting custom gateway
 * ids flow through (see Phase 1 of the admin model configuration plan).
 */
export type AdminProviderId = ModelProviderId | (string & {});

export type UpdateModelParams = {
  modelId: string;
  provider: AdminProviderId;
};

export type UpdateModelInModelListParams = {
  modelConfigId: string;
  model?: {
    modelId: string;
    provider: AdminProviderId;
  };
  maxRetries?: number;
  enabled?: boolean;
};

export type ReorderModelListParams = {
  reorderedModelIds: string[];
};

export interface GetToolResponse {
  id: string;
  description: string;
  inputSchema: string;
  outputSchema: string;
  requestContextSchema?: string;
}

export interface ListWorkflowRunsParams {
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  perPage?: number;
  resourceId?: string;
  status?: WorkflowRunStatus;
  /** @deprecated Use page instead */
  offset?: number;
  /** @deprecated Use perPage instead */
  limit?: number | false;
}

export type ListWorkflowRunsResponse = WorkflowRuns;

export type GetWorkflowRunByIdResponse = WorkflowState;

export interface GetWorkflowResponse {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  steps: {
    [key: string]: {
      id: string;
      description: string;
      inputSchema: string;
      outputSchema: string;
      resumeSchema: string;
      suspendSchema: string;
      stateSchema: string;
      metadata?: Record<string, unknown>;
    };
  };
  allSteps: {
    [key: string]: {
      id: string;
      description: string;
      inputSchema: string;
      outputSchema: string;
      resumeSchema: string;
      suspendSchema: string;
      stateSchema: string;
      isWorkflow: boolean;
      metadata?: Record<string, unknown>;
    };
  };
  stepGraph: Workflow['serializedStepGraph'];
  inputSchema: string;
  outputSchema: string;
  stateSchema: string;
  /** Serialized JSON schema for request context validation */
  requestContextSchema?: string;
  /** Whether this workflow is a processor workflow (auto-generated from agent processors) */
  isProcessorWorkflow?: boolean;
}

export type WorkflowRunResult = WorkflowResult<any, any, any, any>;
export type UpsertVectorParams = GeneratedRequest<Body<'POST /vector/:vectorName/upsert'>>;
export type CreateIndexParams = GeneratedRequest<Body<'POST /vector/:vectorName/create-index'>>;

export interface QueryVectorParams {
  indexName: string;
  queryVector: number[];
  topK?: number;
  filter?: Record<string, any>;
  includeVector?: boolean;
}

export type QueryVectorResponse = QueryResult[];

export type GetVectorIndexResponse = GeneratedResponse<'GET /vector/:vectorName/indexes/:indexName'>;

export interface SaveMessageToMemoryParams {
  messages: (MastraMessageV1 | MastraDBMessage)[];
  agentId: string;
  requestContext?: RequestContext | Record<string, any>;
}

export interface SaveNetworkMessageToMemoryParams {
  messages: (MastraMessageV1 | MastraDBMessage)[];
  networkId: string;
}

export type SaveMessageToMemoryResponse = {
  messages: (MastraMessageV1 | MastraDBMessage)[];
};

export type CreateMemoryThreadParams = GeneratedRequest<
  Body<'POST /memory/threads'> & QueryParams<'POST /memory/threads'>
> &
  RequestContextOptions;

export type CreateMemoryThreadResponse = GeneratedResponse<'POST /memory/threads'>;

export interface ListMemoryThreadsParams {
  /**
   * Optional resourceId to filter threads. When not provided, returns all threads.
   */
  resourceId?: string;
  /**
   * Optional metadata filter. Threads must match all specified key-value pairs (AND logic).
   */
  metadata?: Record<string, unknown>;
  /**
   * Optional agentId. When not provided and storage is configured on the server,
   * threads will be retrieved using storage directly.
   */
  agentId?: string;
  page?: number;
  perPage?: number;
  orderBy?: {
    field?: 'createdAt' | 'updatedAt';
    direction?: 'ASC' | 'DESC';
  };
  requestContext?: RequestContext | Record<string, any>;
}

export type ListMemoryThreadsResponse = GeneratedResponse<'GET /memory/threads'>;

export type GetMemoryConfigParams = GeneratedRequest<QueryParams<'GET /memory/config'>> & RequestContextOptions;

export type GetMemoryConfigResponse = GeneratedResponse<'GET /memory/config'>;

export interface UpdateMemoryThreadParams {
  title: string;
  metadata: Record<string, any>;
  resourceId: string;
  /**
   * Agent ID. Required by the server for write operations. If omitted, the agentId provided
   * to `getMemoryThread({ threadId, agentId })` is used.
   */
  agentId?: string;
  requestContext?: RequestContext | Record<string, any>;
}

export type ListMemoryThreadMessagesParams = Omit<StorageListMessagesInput, 'threadId'> & {
  includeSystemReminders?: boolean;
};

export type ListMemoryThreadMessagesResponse = {
  messages: MastraDBMessage[];
};

export interface CloneMemoryThreadParams {
  newThreadId?: string;
  resourceId?: string;
  title?: string;
  metadata?: Record<string, any>;
  options?: {
    messageLimit?: number;
    messageFilter?: {
      startDate?: Date;
      endDate?: Date;
      messageIds?: string[];
    };
  };
  /**
   * Agent ID. Required by the server for write operations. If omitted, the agentId provided
   * to `getMemoryThread({ threadId, agentId })` is used.
   */
  agentId?: string;
  requestContext?: RequestContext | Record<string, any>;
}

export type CloneMemoryThreadResponse = {
  thread: StorageThreadType;
  clonedMessages: MastraDBMessage[];
};

export type GetLogsParams = GeneratedRequest<QueryParams<'GET /logs'>>;

export interface GetLogParams {
  runId: string;
  transportId: string;
  fromDate?: Date;
  toDate?: Date;
  logLevel?: LogLevel;
  filters?: Record<string, string>;
  page?: number;
  perPage?: number;
}

export type GetLogsResponse = GeneratedResponse<'GET /logs'>;

export type RequestFunction = (path: string, options?: RequestOptions) => Promise<any>;
export interface GetVNextNetworkResponse {
  id: string;
  name: string;
  instructions: string;
  agents: Array<{
    name: string;
    provider: string;
    modelId: string;
  }>;
  routingModel: {
    provider: string;
    modelId: string;
  };
  workflows: Array<{
    name: string;
    description: string;
    inputSchema: string | undefined;
    outputSchema: string | undefined;
  }>;
  tools: Array<{
    id: string;
    description: string;
  }>;
}

export interface GenerateVNextNetworkResponse {
  task: string;
  result: string;
  resourceId: string;
  resourceType: 'none' | 'tool' | 'agent' | 'workflow';
}

export interface GenerateOrStreamVNextNetworkParams {
  message: string;
  threadId?: string;
  resourceId?: string;
  requestContext?: RequestContext | Record<string, any>;
}

export interface LoopStreamVNextNetworkParams {
  message: string;
  threadId?: string;
  resourceId?: string;
  maxIterations?: number;
  requestContext?: RequestContext | Record<string, any>;
}

export interface LoopVNextNetworkResponse {
  status: 'success';
  result: {
    task: string;
    resourceId: string;
    resourceType: 'agent' | 'workflow' | 'none' | 'tool';
    result: string;
    iteration: number;
    isOneOff: boolean;
    prompt: string;
    threadId?: string | undefined;
    threadResourceId?: string | undefined;
    isComplete?: boolean | undefined;
    completionReason?: string | undefined;
  };
  steps: WorkflowResult<any, any, any, any>['steps'];
}

export interface McpServerListResponse {
  servers: ServerInfo[];
  next: string | null;
  total_count: number;
}

export interface McpToolInfo {
  id: string;
  name: string;
  description?: string;
  inputSchema: string;
  toolType?: MCPToolType;
  _meta?: Record<string, unknown>;
}

export interface McpServerToolListResponse {
  tools: McpToolInfo[];
}

/**
 * Client version of ScoreRowData with dates serialized as strings (from JSON)
 */
export type ClientScoreRowData = Omit<ScoreRowData, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

/**
 * Response for listing scores (client version with serialized dates)
 */
export type ListScoresResponse = {
  pagination: PaginationInfo;
  scores: ClientScoreRowData[];
};

// Scores-related types
export interface ListScoresByRunIdParams {
  runId: string;
  page?: number;
  perPage?: number;
}

export interface ListScoresByScorerIdParams {
  scorerId: string;
  entityId?: string;
  entityType?: string;
  page?: number;
  perPage?: number;
}

export interface ListScoresByEntityIdParams {
  entityId: string;
  entityType: string;
  page?: number;
  perPage?: number;
}

export interface SaveScoreParams {
  score: Omit<ScoreRowData, 'id' | 'createdAt' | 'updatedAt'>;
}

export interface SaveScoreResponse {
  score: ClientScoreRowData;
}

export type GetScorerResponse = MastraScorerEntry & {
  agentIds: string[];
  agentNames: string[];
  workflowIds: string[];
  isRegistered: boolean;
  source: 'code' | 'stored';
};

export interface GetScorersResponse {
  scorers: Array<GetScorerResponse>;
}

// Template installation types
export interface TemplateInstallationRequest {
  /** Template repository URL or slug */
  repo: string;
  /** Git ref (branch/tag/commit) to install from */
  ref?: string;
  /** Template slug for identification */
  slug?: string;
  /** Target project path */
  targetPath?: string;
  /** Environment variables for template */
  variables?: Record<string, string>;
}

export interface StreamVNextChunkType {
  type: string;
  payload: any;
  runId: string;
  from: 'AGENT' | 'WORKFLOW';
}
export interface MemorySearchResponse {
  results: MemorySearchResult[];
  count: number;
  query: string;
  searchType?: string;
  searchScope?: 'thread' | 'resource';
}

export interface MemorySearchResult {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  threadId?: string;
  threadTitle?: string;
  context?: {
    before?: Array<{
      id: string;
      role: string;
      content: string;
      createdAt: string;
    }>;
    after?: Array<{
      id: string;
      role: string;
      content: string;
      createdAt: string;
    }>;
  };
}

export interface TimeTravelParams {
  step: string | string[];
  inputData?: Record<string, any>;
  resumeData?: Record<string, any>;
  initialState?: Record<string, any>;
  context?: TimeTravelContext<any, any, any, any>;
  nestedStepsContext?: Record<string, TimeTravelContext<any, any, any, any>>;
  requestContext?: RequestContext | Record<string, any>;
  tracingOptions?: TracingOptions;
  perStep?: boolean;
}

// ============================================================================
// Stored Agents Types
// ============================================================================

/**
 * Semantic recall configuration for vector-based memory retrieval
 */
export interface SemanticRecallConfig {
  topK: number;
  messageRange: number | { before: number; after: number };
  scope?: 'thread' | 'resource';
  threshold?: number;
  indexName?: string;
}

/**
 * Title generation configuration
 */
export type TitleGenerationConfig =
  | boolean
  | {
      model: string; // Model ID in format provider/model-name
      instructions?: string;
    };

/**
 * Serialized memory configuration matching SerializedMemoryConfig from @mastra/core
 *
 * Note: When semanticRecall is enabled, both `vector` (string, not false) and `embedder` must be configured.
 */
/** Serializable observation step config for observational memory */
export interface SerializedObservationConfig {
  model?: string;
  messageTokens?: number;
  modelSettings?: Record<string, unknown>;
  providerOptions?: Record<string, Record<string, unknown> | undefined>;
  maxTokensPerBatch?: number;
  bufferTokens?: number | false;
  bufferActivation?: number;
  blockAfter?: number;
}

/** Serializable reflection step config for observational memory */
export interface SerializedReflectionConfig {
  model?: string;
  observationTokens?: number;
  modelSettings?: Record<string, unknown>;
  providerOptions?: Record<string, Record<string, unknown> | undefined>;
  blockAfter?: number;
  bufferActivation?: number;
}

/** Serializable observational memory configuration */
export interface SerializedObservationalMemoryConfig {
  model?: string;
  scope?: 'resource' | 'thread';
  shareTokenBudget?: boolean;
  observation?: SerializedObservationConfig;
  reflection?: SerializedReflectionConfig;
}

export interface SerializedMemoryConfig {
  /**
   * Vector database identifier. Required when semanticRecall is enabled.
   * Set to false to explicitly disable vector search.
   */
  vector?: string | false;
  options?: {
    readOnly?: boolean;
    lastMessages?: number | false;
    /**
     * Semantic recall configuration. When enabled (true or object),
     * requires both `vector` and `embedder` to be configured.
     */
    semanticRecall?: boolean | SemanticRecallConfig;
    generateTitle?: TitleGenerationConfig;
  };
  /**
   * Embedding model ID in the format "provider/model"
   * (e.g., "openai/text-embedding-3-small")
   * Required when semanticRecall is enabled.
   */
  embedder?: string;
  /**
   * Options to pass to the embedder
   */
  embedderOptions?: Record<string, unknown>;
  /**
   * Serialized observational memory configuration.
   * `true` to enable with defaults, or a config object for customization.
   */
  observationalMemory?: boolean | SerializedObservationalMemoryConfig;
}

/**
 * Default options for agent execution (serializable subset of AgentExecutionOptionsBase)
 */
export interface DefaultOptions {
  runId?: string;
  savePerStep?: boolean;
  maxSteps?: number;
  activeTools?: string[];
  maxProcessorRetries?: number;
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string };
  modelSettings?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stopSequences?: string[];
    seed?: number;
    maxRetries?: number;
  };
  returnScorerData?: boolean;
  tracingOptions?: {
    traceName?: string;
    attributes?: Record<string, unknown>;
    spanId?: string;
    traceId?: string;
  };
  requireToolApproval?: boolean;
  autoResumeSuspendedTools?: boolean;
  toolCallConcurrency?: number;
  includeRawChunks?: boolean;
  [key: string]: unknown; // Allow additional provider-specific options
}

/**
 * Per-tool config for stored agents (e.g., description overrides)
 */
export interface StoredAgentToolConfig {
  description?: string;
  rules?: RuleGroup;
}

/**
 * Per-MCP-client/integration tool configuration stored in agent snapshots.
 * Specifies which tools from an MCP client or integration provider are enabled and their overrides.
 * When `tools` is omitted, all tools from the source are included.
 */
export interface StoredMCPClientToolsConfig {
  /** When omitted, all tools from the source are included. */
  tools?: Record<string, StoredAgentToolConfig>;
}

/**
 * One pinned connection on a `toolProviders[providerId].connections[toolkit]` bucket.
 * Part of the Agent Builder / CMS tool-providers shape
 * (`StoredAgentSnapshot.toolProviders`).
 */
export interface StoredToolProviderConnection {
  /**
   * Identity binding kind.
   *
   * - `'author'` — uses the agent author's connection (v1 default).
   * - `'invoker'` — uses the end-user's connection (v1.5, reserved).
   * - `'platform'` — uses a shared platform account (v2, reserved).
   */
  kind: 'author' | 'invoker' | 'platform';
  /** Parent toolkit slug. Denormalized for callsite clarity. */
  toolkit: string;
  /**
   * Provider-opaque identifier for the OAuth bucket.
   *
   * Required for `'author'` and `'platform'`; reserved (empty) for `'invoker'`.
   */
  connectionId: string;
  /**
   * Display label and LLM disambiguator. Optional when this is the only
   * connection on a `toolkit`; required (non-empty, ≤ 32 chars,
   * `[A-Za-z0-9 _-]+`, case-insensitively unique) once ≥ 2 connections share
   * the same `toolkit`.
   */
  label?: string;
  /**
   * Ownership scope of the underlying OAuth bucket.
   *
   * - `'per-author'` (default) — bucketed under the agent author's id.
   * - `'shared'` — bucketed under a constant shared id; visible to and
   *   usable by anyone with edit access.
   * - `'caller-supplied'` — bucketed under the request-context
   *   `MASTRA_RESOURCE_ID_KEY` value at runtime. Used for multi-tenant
   *   deployments where the host app sets the user id per request.
   */
  scope?: 'per-author' | 'shared' | 'caller-supplied';
}

/** Per-tool override stored alongside the selected tool slug. */
export interface StoredToolProviderToolMeta {
  /**
   * Toolkit this slug belongs to. The runtime groups selected slugs
   * by this field when fanning out across connections.
   */
  toolkit?: string;
  description?: string;
}

/** Stored shape for one tool provider's configuration on one agent. */
export interface StoredToolProviderConfig {
  tools: Record<string, StoredToolProviderToolMeta>;
  connections: Record<string, StoredToolProviderConnection[]>;
}

/**
 * Scorer config for stored agents
 */
export interface StoredAgentScorerConfig {
  description?: string;
  sampling?: { type: 'none' } | { type: 'ratio'; rate: number };
  rules?: RuleGroup;
}

/**
 * Per-skill config stored in agent snapshots.
 * Allows overriding skill description and instructions for a specific agent context.
 */
export interface StoredAgentSkillConfig {
  description?: string;
  instructions?: string;
  /** Pin to a specific version ID. Takes precedence over strategy. */
  pin?: string;
  /** Resolution strategy: 'latest' = latest published version, 'live' = read from filesystem */
  strategy?: 'latest' | 'live';
}

/**
 * Workspace reference stored in agent snapshots.
 * Can reference a stored workspace by ID or provide inline workspace config.
 */
export type StoredWorkspaceRef =
  { type: 'id'; workspaceId: string } | { type: 'inline'; config: Record<string, unknown> };

export interface StoredBrowserConfig {
  provider: string;
  headless?: boolean;
  viewport?: { width: number; height: number };
  timeout?: number;
  screencast?: {
    format?: 'jpeg' | 'png';
    quality?: number;
    maxWidth?: number;
    maxHeight?: number;
    everyNthFrame?: number;
  };
}

export type StoredBrowserRef = { type: 'inline'; config: StoredBrowserConfig };

// ============================================================================
// Conditional Field Types (for rule-based dynamic agent configuration)
// Re-exported from @mastra/core/storage for convenience
// ============================================================================

export type StoredAgentRule = Rule;
export type StoredAgentRuleGroup = RuleGroup;
export type ConditionalVariant<T> = StorageConditionalVariant<T>;
export type ConditionalField<T> = StorageConditionalField<T>;

/**
 * Resolved author identity. Returned by the server when an auth provider is
 * configured and the agent's `authorId` could be looked up. All fields except
 * `id` are optional — providers may not expose every field.
 */
export interface ResolvedAuthor {
  id: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
}

/**
 * Stored agent data returned from API
 */
export interface StoredAgentResponse {
  // Thin agent record fields
  id: string;
  status: string;
  activeVersionId?: string;
  authorId?: string;
  author?: ResolvedAuthor;
  visibility?: 'private' | 'public';
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  // Version snapshot config fields (resolved from active version)
  name: string;
  description?: string;
  instructions: string | AgentInstructionBlock[];
  model: ConditionalField<{
    provider: string;
    name: string;
    [key: string]: unknown;
  }>;
  tools?: ConditionalField<Record<string, StoredAgentToolConfig>>;
  defaultOptions?: ConditionalField<DefaultOptions>;
  workflows?: ConditionalField<Record<string, StoredAgentToolConfig>>;
  agents?: ConditionalField<Record<string, StoredAgentToolConfig>>;
  integrationTools?: ConditionalField<Record<string, StoredMCPClientToolsConfig>>;
  toolProviders?: ConditionalField<Record<string, StoredToolProviderConfig>>;
  mcpClients?: ConditionalField<Record<string, StoredMCPClientToolsConfig>>;
  inputProcessors?: ConditionalField<StoredProcessorGraph>;
  outputProcessors?: ConditionalField<StoredProcessorGraph>;
  memory?: ConditionalField<SerializedMemoryConfig>;
  scorers?: ConditionalField<Record<string, StoredAgentScorerConfig>>;
  skills?: ConditionalField<Record<string, StoredAgentSkillConfig>>;
  workspace?: ConditionalField<StoredWorkspaceRef>;
  browser?: ConditionalField<StoredBrowserRef> | boolean | null;
  requestContextSchema?: Record<string, unknown>;
  // Favorites (EE feature, present when `favorites` feature is enabled)
  isFavorited?: boolean;
  favoriteCount?: number;
}

/**
 * Parameters for listing stored agents
 */
export interface ListStoredAgentsParams {
  page?: number;
  perPage?: number;
  orderBy?: {
    field?: 'createdAt' | 'updatedAt';
    direction?: 'ASC' | 'DESC';
  };
  status?: 'draft' | 'published' | 'archived';
  authorId?: string;
  /**
   * Restrict the list to public records. Only `'public'` is accepted by the
   * server filter; private records are surfaced via the default scope-aware
   * filter (caller's own rows + legacy unowned).
   */
  visibility?: 'public';
  metadata?: Record<string, unknown>;
  /** When true, only return agents favorited by the caller (or by `pinFavoritedFor`). */
  favoritedOnly?: boolean;
  /** When set, sort favorited-first for this user id. Required for `favoritedOnly`. */
  pinFavoritedFor?: string;
}

/**
 * Response from favorite / unfavorite mutations.
 */
export interface FavoriteToggleResponse {
  favorited: boolean;
  favoriteCount: number;
}

/**
 * Response for listing stored agents
 */
export interface ListStoredAgentsResponse {
  agents: StoredAgentResponse[];
  total: number;
  page: number;
  perPage: number | false;
  hasMore: boolean;
}

/**
 * Parameters for cloning an agent to a stored agent
 */
export interface CloneAgentParams {
  /** ID for the cloned agent. If not provided, derived from agent ID. */
  newId?: string;
  /** Name for the cloned agent. Defaults to "{name} (Clone)". */
  newName?: string;
  /** Additional metadata for the cloned agent. */
  metadata?: Record<string, unknown>;
  /** Author identifier for the cloned agent. */
  authorId?: string;
  /** Visibility of the cloned agent. Defaults to 'private'. */
  visibility?: 'private' | 'public';
  /** Request context for resolving dynamic agent configuration (instructions, model, tools, etc.) */
  requestContext?: RequestContext | Record<string, any>;
}

/**
 * Parameters for creating a stored agent.
 * Flat union of agent-record fields and config fields.
 */
export interface CreateStoredAgentParams {
  /** Unique identifier for the agent. If not provided, derived from name via slugify. */
  id?: string;
  authorId?: string;
  /** Visibility of the agent. Defaults to 'private'. */
  visibility?: 'private' | 'public';
  metadata?: Record<string, unknown>;
  name: string;
  description?: string;
  instructions: string | AgentInstructionBlock[];
  model: ConditionalField<{
    provider: string;
    name: string;
    [key: string]: unknown;
  }>;
  tools?: ConditionalField<Record<string, StoredAgentToolConfig>>;
  defaultOptions?: ConditionalField<DefaultOptions>;
  workflows?: ConditionalField<Record<string, StoredAgentToolConfig>>;
  agents?: ConditionalField<Record<string, StoredAgentToolConfig>>;
  integrationTools?: ConditionalField<Record<string, StoredMCPClientToolsConfig>>;
  toolProviders?: ConditionalField<Record<string, StoredToolProviderConfig>>;
  mcpClients?: ConditionalField<Record<string, StoredMCPClientToolsConfig>>;
  inputProcessors?: ConditionalField<StoredProcessorGraph>;
  outputProcessors?: ConditionalField<StoredProcessorGraph>;
  memory?: ConditionalField<SerializedMemoryConfig>;
  scorers?: ConditionalField<Record<string, StoredAgentScorerConfig>>;
  skills?: ConditionalField<Record<string, StoredAgentSkillConfig>>;
  workspace?: ConditionalField<StoredWorkspaceRef>;
  /** Browser config. `true` = use admin default, `false` = no browser. */
  browser?: ConditionalField<StoredBrowserRef> | boolean | null;
  requestContextSchema?: Record<string, unknown>;
}

/**
 * Parameters for updating a stored agent
 */
export type ExportStoredAgentParams = Partial<
  Omit<CreateStoredAgentParams, 'id' | 'authorId' | 'visibility' | 'metadata'>
>;

export type OpenStoredAgentChangeRequestParams = ExportStoredAgentParams & {
  changeMessage?: string;
  userName?: string;
  inspectOnly?: boolean;
};

export interface ExportStoredAgentResponse {
  agentId: string;
  fileName: string;
  content: string;
  config: Record<string, unknown>;
}

export interface OpenStoredAgentChangeRequestResponse {
  id?: string | number;
  url: string;
  ref?: string;
}

export interface UpdateStoredAgentParams {
  authorId?: string;
  /** Visibility of the agent. */
  visibility?: 'private' | 'public';
  metadata?: Record<string, unknown>;
  name?: string;
  description?: string;
  instructions?: string | AgentInstructionBlock[];
  model?: ConditionalField<{
    provider: string;
    name: string;
    [key: string]: unknown;
  }>;
  tools?: ConditionalField<Record<string, StoredAgentToolConfig>>;
  defaultOptions?: ConditionalField<DefaultOptions>;
  workflows?: ConditionalField<Record<string, StoredAgentToolConfig>>;
  agents?: ConditionalField<Record<string, StoredAgentToolConfig>>;
  integrationTools?: ConditionalField<Record<string, StoredMCPClientToolsConfig>>;
  toolProviders?: ConditionalField<Record<string, StoredToolProviderConfig>>;
  mcpClients?: ConditionalField<Record<string, StoredMCPClientToolsConfig>>;
  inputProcessors?: ConditionalField<StoredProcessorGraph>;
  outputProcessors?: ConditionalField<StoredProcessorGraph>;
  memory?: ConditionalField<SerializedMemoryConfig>;
  scorers?: ConditionalField<Record<string, StoredAgentScorerConfig>>;
  skills?: ConditionalField<Record<string, StoredAgentSkillConfig>>;
  workspace?: ConditionalField<StoredWorkspaceRef>;
  /** Browser config. `true` = use admin default, `false` = no browser. */
  browser?: ConditionalField<StoredBrowserRef> | boolean | null;
  requestContextSchema?: Record<string, unknown>;
  /** Optional message describing the changes for the auto-created version */
  changeMessage?: string;
}

/**
 * Response for deleting a stored agent
 */
export interface DeleteStoredAgentResponse {
  success: boolean;
  message: string;
}

/**
 * A single agent that references another agent as a sub-agent. Includes both
 * public and the caller's own private agents — anything the caller can read.
 */
export interface StoredAgentDependent {
  id: string;
  name: string;
}

/**
 * Response for listing dependents of a stored agent.
 * `dependents` lists caller-readable references (with names).
 * `hiddenCount` aggregates dependents the caller cannot read; it is only
 * non-zero when the target agent is public.
 */
export interface StoredAgentDependentsResponse {
  dependents: StoredAgentDependent[];
  hiddenCount: number;
}

// ============================================================================
// Stored Scorer Definition Types
// ============================================================================

/**
 * Sampling configuration for scorers
 */
export type ScorerSamplingConfig = { type: 'none' } | { type: 'ratio'; rate: number };

/**
 * Scorer type discriminator
 */
export type StoredScorerType =
  | 'llm-judge'
  | 'answer-relevancy'
  | 'answer-similarity'
  | 'bias'
  | 'context-precision'
  | 'context-relevance'
  | 'faithfulness'
  | 'hallucination'
  | 'noise-sensitivity'
  | 'prompt-alignment'
  | 'tool-call-accuracy'
  | 'toxicity';

/**
 * Stored scorer definition data returned from API
 */
export interface StoredScorerResponse {
  id: string;
  status: string;
  activeVersionId?: string;
  authorId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  name: string;
  description?: string;
  type: StoredScorerType;
  model?: {
    provider: string;
    name: string;
    [key: string]: unknown;
  };
  instructions?: string;
  scoreRange?: {
    min?: number;
    max?: number;
  };
  presetConfig?: Record<string, unknown>;
  defaultSampling?: ScorerSamplingConfig;
}

/**
 * Parameters for listing stored scorer definitions
 */
export interface ListStoredScorersParams {
  page?: number;
  perPage?: number;
  orderBy?: {
    field?: 'createdAt' | 'updatedAt';
    direction?: 'ASC' | 'DESC';
  };
  authorId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Response for listing stored scorer definitions
 */
export interface ListStoredScorersResponse {
  scorerDefinitions: StoredScorerResponse[];
  total: number;
  page: number;
  perPage: number | false;
  hasMore: boolean;
}

/**
 * Parameters for creating a stored scorer definition
 */
export interface CreateStoredScorerParams {
  id?: string;
  authorId?: string;
  metadata?: Record<string, unknown>;
  name: string;
  description?: string;
  type: StoredScorerType;
  model?: {
    provider: string;
    name: string;
    [key: string]: unknown;
  };
  instructions?: string;
  scoreRange?: {
    min?: number;
    max?: number;
  };
  presetConfig?: Record<string, unknown>;
  defaultSampling?: ScorerSamplingConfig;
}

/**
 * Parameters for updating a stored scorer definition
 */
export interface UpdateStoredScorerParams {
  authorId?: string;
  metadata?: Record<string, unknown>;
  name?: string;
  description?: string;
  type?: StoredScorerType;
  model?: {
    provider: string;
    name: string;
    [key: string]: unknown;
  };
  instructions?: string;
  scoreRange?: {
    min?: number;
    max?: number;
  };
  presetConfig?: Record<string, unknown>;
  defaultSampling?: ScorerSamplingConfig;
}

/**
 * Response for deleting a stored scorer definition
 */
export interface DeleteStoredScorerResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// Stored MCP Client Types
// ============================================================================

/**
 * MCP server transport configuration
 */
export interface StoredMCPServerConfig {
  type: 'stdio' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  timeout?: number;
}

/**
 * Stored MCP client data returned from API
 */
export interface StoredMCPClientResponse {
  id: string;
  status: string;
  activeVersionId?: string;
  authorId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  name: string;
  description?: string;
  servers: Record<string, StoredMCPServerConfig>;
}

/**
 * Parameters for listing stored MCP clients
 */
export interface ListStoredMCPClientsParams {
  page?: number;
  perPage?: number;
  orderBy?: {
    field?: 'createdAt' | 'updatedAt';
    direction?: 'ASC' | 'DESC';
  };
  authorId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Response for listing stored MCP clients
 */
export interface ListStoredMCPClientsResponse {
  mcpClients: StoredMCPClientResponse[];
  total: number;
  page: number;
  perPage: number | false;
  hasMore: boolean;
}

/**
 * Parameters for creating a stored MCP client
 */
export interface CreateStoredMCPClientParams {
  id?: string;
  authorId?: string;
  metadata?: Record<string, unknown>;
  name: string;
  description?: string;
  servers: Record<string, StoredMCPServerConfig>;
}

/**
 * Parameters for updating a stored MCP client
 */
export interface UpdateStoredMCPClientParams {
  authorId?: string;
  metadata?: Record<string, unknown>;
  name?: string;
  description?: string;
  servers?: Record<string, StoredMCPServerConfig>;
}

/**
 * Response for deleting a stored MCP client
 */
export interface DeleteStoredMCPClientResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// Agent Version Types
// ============================================================================

export interface AgentVersionResponse {
  id: string;
  agentId: string;
  versionNumber: number;
  name: string;
  description?: string;
  instructions: string | AgentInstructionBlock[];
  model: ConditionalField<{
    provider: string;
    name: string;
    [key: string]: unknown;
  }>;
  tools?: ConditionalField<Record<string, StoredAgentToolConfig>>;
  defaultOptions?: ConditionalField<DefaultOptions>;
  workflows?: ConditionalField<Record<string, StoredAgentToolConfig>>;
  agents?: ConditionalField<Record<string, StoredAgentToolConfig>>;
  integrationTools?: ConditionalField<Record<string, StoredMCPClientToolsConfig>>;
  toolProviders?: ConditionalField<Record<string, StoredToolProviderConfig>>;
  mcpClients?: ConditionalField<Record<string, StoredMCPClientToolsConfig>>;
  inputProcessors?: ConditionalField<StoredProcessorGraph>;
  outputProcessors?: ConditionalField<StoredProcessorGraph>;
  memory?: ConditionalField<SerializedMemoryConfig>;
  scorers?: ConditionalField<Record<string, StoredAgentScorerConfig>>;
  requestContextSchema?: Record<string, unknown>;
  changedFields?: string[];
  changeMessage?: string;
  createdAt: string;
}

export interface ListAgentVersionsParams {
  page?: number;
  perPage?: number;
  orderBy?: {
    field?: 'versionNumber' | 'createdAt';
    direction?: 'ASC' | 'DESC';
  };
}

export interface ListAgentVersionsResponse {
  versions: AgentVersionResponse[];
  total: number;
  page: number;
  perPage: number | false;
  hasMore: boolean;
}

export interface CreateAgentVersionParams {
  changeMessage?: string;
}

export interface CreateCodeAgentVersionParams {
  instructions?: AgentVersionResponse['instructions'];
  tools?: AgentVersionResponse['tools'];
  changeMessage?: string;
}

export interface CreateAgentVersionResponse {
  version: AgentVersionResponse;
}

export interface ActivateAgentVersionResponse {
  success: boolean;
  message: string;
  activeVersionId: string;
}

export interface RestoreAgentVersionResponse {
  success: boolean;
  message: string;
  version: AgentVersionResponse;
}

export interface DeleteAgentVersionResponse {
  success: boolean;
  message: string;
}

export interface VersionDiff {
  field: string;
  previousValue: any;
  currentValue: any;
  changeType?: 'added' | 'removed' | 'modified';
}

export type AgentVersionDiff = VersionDiff;

export interface CompareVersionsResponse {
  fromVersion: AgentVersionResponse;
  toVersion: AgentVersionResponse;
  diffs: VersionDiff[];
}

// ============================================================================
// Scorer Version Types
// ============================================================================

export interface ScorerVersionResponse {
  id: string;
  scorerDefinitionId: string;
  versionNumber: number;
  name: string;
  description?: string;
  type: StoredScorerType;
  model?: {
    provider: string;
    name: string;
    [key: string]: unknown;
  };
  instructions?: string;
  scoreRange?: {
    min?: number;
    max?: number;
  };
  presetConfig?: Record<string, unknown>;
  defaultSampling?: ScorerSamplingConfig;
  changedFields?: string[];
  changeMessage?: string;
  createdAt: string;
}

export interface ListScorerVersionsParams {
  page?: number;
  perPage?: number;
  orderBy?: {
    field?: 'versionNumber' | 'createdAt';
    direction?: 'ASC' | 'DESC';
  };
}

export interface ListScorerVersionsResponse {
  versions: ScorerVersionResponse[];
  total: number;
  page: number;
  perPage: number | false;
  hasMore: boolean;
}

export interface CreateScorerVersionParams {
  changeMessage?: string;
}

export interface ActivateScorerVersionResponse {
  success: boolean;
  message: string;
  activeVersionId: string;
}

export interface DeleteScorerVersionResponse {
  success: boolean;
  message: string;
}

export interface CompareScorerVersionsResponse {
  fromVersion: ScorerVersionResponse;
  toVersion: ScorerVersionResponse;
  diffs: VersionDiff[];
}

export type ListAgentsModelProvidersResponse = GeneratedResponse<'GET /agents/providers'>;

export interface Provider {
  id: string;
  name: string;
  envVar: string | string[];
  connected: boolean;
  docUrl?: string;
  models: string[];
}

// ============================================================================
// System Types
// ============================================================================

export interface MastraPackage {
  name: string;
  version: string;
}

export type GetSystemPackagesResponse = GeneratedResponse<'GET /system/packages'>;

// ============================================================================
// Workspace Types
// ============================================================================

/**
 * Workspace capabilities
 */
export type WorkspaceCapabilities = ListWorkspacesResponse['workspaces'][number]['capabilities'];

/**
 * Workspace safety configuration
 */
export type WorkspaceSafety = ListWorkspacesResponse['workspaces'][number]['safety'];

/**
 * Response for getting workspace info
 */
export type WorkspaceInfoResponse = GeneratedResponse<'GET /workspaces/:workspaceId'>;

/**
 * Workspace item in list response
 */
export type WorkspaceItem = ListWorkspacesResponse['workspaces'][number];

/**
 * Response for listing all workspaces
 */
export type ListWorkspacesResponse = GeneratedResponse<'GET /workspaces'>;

/**
 * File entry in directory listing
 */
export interface WorkspaceFileEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
}

/**
 * Response for reading a file
 */
export type WorkspaceFsReadResponse = GeneratedResponse<'GET /workspaces/:workspaceId/fs/read'>;

/**
 * Response for writing a file
 */
export type WorkspaceFsWriteResponse = GeneratedResponse<'POST /workspaces/:workspaceId/fs/write'>;

/**
 * Response for listing files
 */
export type WorkspaceFsListResponse = GeneratedResponse<'GET /workspaces/:workspaceId/fs/list'>;

/**
 * Response for deleting a file
 */
export type WorkspaceFsDeleteResponse = GeneratedResponse<'DELETE /workspaces/:workspaceId/fs/delete'>;

/**
 * Response for creating a directory
 */
export type WorkspaceFsMkdirResponse = GeneratedResponse<'POST /workspaces/:workspaceId/fs/mkdir'>;

/**
 * Response for getting file stats
 */
export type WorkspaceFsStatResponse = GeneratedResponse<'GET /workspaces/:workspaceId/fs/stat'>;

/**
 * Workspace search result
 */
export interface WorkspaceSearchResult {
  /** Document identifier (typically the indexed file path) */
  id: string;
  content: string;
  score: number;
  lineRange?: {
    start: number;
    end: number;
  };
  scoreDetails?: {
    vector?: number;
    bm25?: number;
  };
}

/**
 * Parameters for searching workspace content
 */
export type WorkspaceSearchParams = GeneratedRequest<QueryParams<'GET /workspaces/:workspaceId/search'>>;

/**
 * Response for searching workspace
 */
export type WorkspaceSearchResponse = GeneratedResponse<'GET /workspaces/:workspaceId/search'>;

/**
 * Parameters for indexing content
 */
export type WorkspaceIndexParams = GeneratedRequest<Body<'POST /workspaces/:workspaceId/index'>>;

/**
 * Response for indexing content
 */
export type WorkspaceIndexResponse = GeneratedResponse<'POST /workspaces/:workspaceId/index'>;

// ============================================================================
// Skills Types
// ============================================================================

/**
 * Skill source type indicating where the skill comes from
 */
export type SkillSource =
  | { type: 'external'; packagePath: string }
  | { type: 'local'; projectPath: string }
  | { type: 'managed'; mastraPath: string };

/**
 * Skill metadata (without instructions content)
 */
export interface SkillMetadata {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  path: string;
}

/**
 * Full skill data including instructions and file paths
 */
export interface Skill extends SkillMetadata {
  instructions: string;
  source: SkillSource;
  references: string[];
  scripts: string[];
  assets: string[];
}

/**
 * Response for listing skills
 */
export interface ListSkillsResponse {
  skills: SkillMetadata[];
  isSkillsConfigured: boolean;
}

/**
 * Skill search result
 */
export interface SkillSearchResult {
  skillName: string;
  source: string;
  content: string;
  score: number;
  lineRange?: {
    start: number;
    end: number;
  };
  scoreDetails?: {
    vector?: number;
    bm25?: number;
  };
}

/**
 * Parameters for searching skills
 */
export interface SearchSkillsParams {
  query: string;
  topK?: number;
  minScore?: number;
  skillNames?: string[];
  includeReferences?: boolean;
}

/**
 * Response for searching skills
 */
export interface SearchSkillsResponse {
  results: SkillSearchResult[];
  query: string;
}

/**
 * Response for listing skill references
 */
export interface ListSkillReferencesResponse {
  skillName: string;
  references: string[];
}

/**
 * Response for getting skill reference content
 */
export interface GetSkillReferenceResponse {
  skillName: string;
  referencePath: string;
  content: string;
}

// ============================================================================
// Stored Skill Types
// ============================================================================

/**
 * File node for skill workspace
 */
export interface StoredSkillFileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  children?: StoredSkillFileNode[];
}

/**
 * Stored skill data returned from API
 */
export interface StoredSkillResponse {
  id: string;
  status: string;
  authorId?: string;
  visibility?: 'private' | 'public';
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  name: string;
  description?: string;
  instructions: string;
  license?: string;
  files?: StoredSkillFileNode[];
  // Favorites (EE feature, present when `favorites` feature is enabled)
  isFavorited?: boolean;
  favoriteCount?: number;
}

/**
 * Parameters for listing stored skills
 */
export interface ListStoredSkillsParams {
  page?: number;
  perPage?: number;
  orderBy?: {
    field?: 'createdAt' | 'updatedAt';
    direction?: 'ASC' | 'DESC';
  };
  authorId?: string;
  /**
   * Restrict the list to public records. Only `'public'` is accepted by the
   * server filter; private records are surfaced via the default scope-aware
   * filter (caller's own rows + legacy unowned).
   */
  visibility?: 'public';
  metadata?: Record<string, unknown>;
  /** When true, only return skills favorited by the caller (or by `pinFavoritedFor`). */
  favoritedOnly?: boolean;
  /** When set, sort favorited-first for this user id. Required for `favoritedOnly`. */
  pinFavoritedFor?: string;
}

/**
 * Response for listing stored skills
 */
export interface ListStoredSkillsResponse {
  skills: StoredSkillResponse[];
  total: number;
  page: number;
  perPage: number | false;
  hasMore: boolean;
}

/**
 * Parameters for creating a stored skill
 */
export interface CreateStoredSkillParams {
  id?: string;
  authorId?: string;
  /** Visibility of the skill. Defaults to 'private'. */
  visibility?: 'private' | 'public';
  metadata?: Record<string, unknown>;
  name: string;
  /** Required by the server: description of what the skill does and when to use it. */
  description: string;
  instructions: string;
  license?: string;
  files?: StoredSkillFileNode[];
}

/**
 * Parameters for updating a stored skill
 */
export interface UpdateStoredSkillParams {
  authorId?: string;
  /** Visibility of the skill. */
  visibility?: 'private' | 'public';
  metadata?: Record<string, unknown>;
  name?: string;
  description?: string;
  instructions?: string;
  license?: string;
  files?: StoredSkillFileNode[];
}

/**
 * Response for deleting a stored skill
 */
export interface DeleteStoredSkillResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// Stored Workspace Types
// ============================================================================

/**
 * Filesystem configuration in a stored workspace
 */
export interface StoredFilesystemConfig {
  provider: string;
  config: Record<string, unknown>;
  readOnly?: boolean;
}

/**
 * Sandbox configuration in a stored workspace
 */
export interface StoredSandboxConfig {
  provider: string;
  config: Record<string, unknown>;
}

/**
 * Stored workspace data returned from API
 */
export interface StoredWorkspaceResponse {
  id: string;
  status: string;
  activeVersionId?: string;
  authorId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  name: string;
  description?: string;
  filesystem?: StoredFilesystemConfig;
  sandbox?: StoredSandboxConfig;
  mounts?: Record<string, StoredFilesystemConfig>;
  skills?: string[];
  tools?: {
    enabled?: boolean;
    requireApproval?: boolean;
    tools?: Record<string, { enabled?: boolean; requireApproval?: boolean }>;
  };
  autoSync?: boolean;
  operationTimeout?: number;
  /** Whether this workspace is registered at runtime (only present in list responses) */
  runtimeRegistered?: boolean;
}

/**
 * Parameters for listing stored workspaces
 */
export interface ListStoredWorkspacesParams {
  page?: number;
  perPage?: number;
  orderBy?: {
    field?: 'createdAt' | 'updatedAt';
    direction?: 'ASC' | 'DESC';
  };
  authorId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Response for listing stored workspaces
 */
export interface ListStoredWorkspacesResponse {
  workspaces: StoredWorkspaceResponse[];
  total: number;
  page: number;
  perPage: number | false;
  hasMore: boolean;
}

// ============================================================================
// Processor Types
// ============================================================================

/**
 * Processor phase types
 */
export type ProcessorPhase = 'input' | 'inputStep' | 'outputStream' | 'outputResult' | 'outputStep';

/**
 * Processor configuration showing how it's attached to an agent
 */
export interface ProcessorConfiguration {
  agentId: string;
  agentName: string;
  type: 'input' | 'output';
}

/**
 * Processor in list response
 */
export interface GetProcessorResponse {
  id: string;
  name?: string;
  description?: string;
  phases: ProcessorPhase[];
  agentIds: string[];
  isWorkflow: boolean;
}

/**
 * Detailed processor response
 */
export interface GetProcessorDetailResponse {
  id: string;
  name?: string;
  description?: string;
  phases: ProcessorPhase[];
  configurations: ProcessorConfiguration[];
  isWorkflow: boolean;
}

/**
 * Parameters for executing a processor
 */
export interface ExecuteProcessorParams {
  phase: ProcessorPhase;
  messages: MastraDBMessage[];
  agentId?: string;
  requestContext?: RequestContext | Record<string, any>;
}

/**
 * Tripwire result from processor execution
 */
export interface ProcessorTripwireResult {
  triggered: boolean;
  reason?: string;
  metadata?: unknown;
}

/**
 * Response from processor execution
 */
export interface ExecuteProcessorResponse {
  success: boolean;
  phase: string;
  messages?: MastraDBMessage[];
  messageList?: {
    messages: MastraDBMessage[];
  };
  tripwire?: ProcessorTripwireResult;
  error?: string;
}

// ============================================================================
// Observational Memory Types
// ============================================================================

/**
 * Parameters for getting observational memory
 */
export type GetObservationalMemoryParams = Omit<
  GeneratedRequest<QueryParams<'GET /memory/observational-memory'>>,
  'from' | 'to'
> & {
  from?: Date | string;
  to?: Date | string;
} & RequestContextOptions;

/**
 * Response for observational memory endpoint
 */
export type GetObservationalMemoryResponse = GeneratedResponse<'GET /memory/observational-memory'>;

/**
 * Parameters for awaiting buffer status
 */
export type AwaitBufferStatusParams = GeneratedRequest<Body<'POST /memory/observational-memory/buffer-status'>> &
  RequestContextOptions;

/**
 * Response for buffer status endpoint
 */
export type AwaitBufferStatusResponse = GeneratedResponse<'POST /memory/observational-memory/buffer-status'>;

/**
 * Extended memory status response with OM info
 */
export type GetMemoryStatusResponse = GeneratedResponse<'GET /memory/status'>;

/**
 * Extended memory config response with OM config
 */
export interface GetMemoryConfigResponseExtended {
  memoryType?: 'local' | 'gateway';
  config: MemoryConfig & {
    observationalMemory?: {
      enabled: boolean;
      scope?: 'thread' | 'resource';
      messageTokens?: number | { min: number; max: number };
      observationTokens?: number | { min: number; max: number };
      observationModel?: string;
      reflectionModel?: string;
    };
  };
}

// ============================================================================
// Vector & Embedder Types
// ============================================================================

/**
 * Response for listing available vector stores
 */
export type ListVectorsResponse = GeneratedResponse<'GET /vectors'>;

/**
 * Response for listing available embedding models
 */
export type ListEmbeddersResponse = GeneratedResponse<'GET /embedders'>;

// ============================================================================
// Tool Provider Types
// ============================================================================

export type ToolProviderInfo = GeneratedResponse<'GET /tool-providers'>['providers'][number];

export type ToolProviderToolkit = GeneratedResponse<'GET /tool-providers/:providerId/toolkits'>['data'][number];

export type ToolProviderToolInfo = GeneratedResponse<'GET /tool-providers/:providerId/tools'>['data'][number];

export type ToolProviderPagination = NonNullable<
  GeneratedResponse<'GET /tool-providers/:providerId/toolkits'>['pagination']
>;

export type ListToolProvidersResponse = GeneratedResponse<'GET /tool-providers'>;

export type ListToolProviderToolkitsResponse = GeneratedResponse<'GET /tool-providers/:providerId/toolkits'>;

export type ListToolProviderToolsParams = GeneratedRequest<QueryParams<'GET /tool-providers/:providerId/tools'>>;

export type ListToolProviderToolsResponse = GeneratedResponse<'GET /tool-providers/:providerId/tools'>;

export type GetToolProviderToolSchemaResponse =
  GeneratedResponse<'GET /tool-providers/:providerId/tools/:toolSlug/schema'>;

// ── v2 surface: authorize / connections / fields / status / health ──────────

export type AuthorizeToolProviderParams = GeneratedRequest<Body<'POST /tool-providers/:providerId/authorize'>>;

export type AuthorizeToolProviderResponse = GeneratedResponse<'POST /tool-providers/:providerId/authorize'>;

export type ToolProviderAuthStatusResponse = GeneratedResponse<'GET /tool-providers/:providerId/auth-status/:authId'>;

export type ToolProviderConnectionStatusParams = GeneratedRequest<
  Body<'POST /tool-providers/:providerId/connection-status'>
>;

export type ToolProviderConnectionStatusResponse =
  GeneratedResponse<'POST /tool-providers/:providerId/connection-status'>;

export type ListToolProviderConnectionsParams = GeneratedRequest<
  QueryParams<'GET /tool-providers/:providerId/connections'>
>;

export type ListToolProviderConnectionsResponse = GeneratedResponse<'GET /tool-providers/:providerId/connections'>;

export type ListToolProviderConnectionFieldsParams = GeneratedRequest<
  QueryParams<'GET /tool-providers/:providerId/connection-fields'>
>;

export type ListToolProviderConnectionFieldsResponse =
  GeneratedResponse<'GET /tool-providers/:providerId/connection-fields'>;

export type DisconnectToolProviderConnectionParams = GeneratedRequest<
  QueryParams<'DELETE /tool-providers/:providerId/connections/:connectionId'>
>;

export type DisconnectToolProviderConnectionResponse =
  GeneratedResponse<'DELETE /tool-providers/:providerId/connections/:connectionId'>;

export type UpdateToolProviderConnectionParams = GeneratedRequest<
  Body<'PATCH /tool-providers/:providerId/connections/:connectionId'>
>;

export type UpdateToolProviderConnectionResponse =
  GeneratedResponse<'PATCH /tool-providers/:providerId/connections/:connectionId'>;

export type GetToolProviderConnectionUsageParams = GeneratedRequest<
  QueryParams<'GET /tool-providers/:providerId/connections/:connectionId/usage'>
>;

export type GetToolProviderConnectionUsageResponse =
  GeneratedResponse<'GET /tool-providers/:providerId/connections/:connectionId/usage'>;

export type ToolProviderHealthResponse = GeneratedResponse<'GET /tool-providers/:providerId/health'>;

// ============================================================================
// Processor Provider Types
// ============================================================================

/**
 * Provider phase names as returned by the server (prefixed form).
 * Distinct from ProcessorPhase which uses the short/unprefixed form for processor endpoints.
 */
export type ProcessorProviderPhase =
  'processInput' | 'processInputStep' | 'processOutputStream' | 'processOutputResult' | 'processOutputStep';

export interface ProcessorProviderInfo {
  id: string;
  name: string;
  description?: string;
  availablePhases: ProcessorProviderPhase[];
}

export interface GetProcessorProvidersResponse {
  providers: ProcessorProviderInfo[];
}

export interface GetProcessorProviderResponse {
  id: string;
  name: string;
  description?: string;
  availablePhases: ProcessorProviderPhase[];
  configSchema: Record<string, unknown>;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * HTTP error thrown by the Mastra client.
 * Extends Error with additional properties for better error handling.
 *
 * @example
 * ```typescript
 * try {
 *   await client.getWorkspace('my-workspace').listFiles('/invalid-path');
 * } catch (error) {
 *   if (error instanceof MastraClientError) {
 *     if (error.status === 404) {
 *       console.log('Not found:', error.body);
 *     }
 *   }
 * }
 * ```
 */
export class MastraClientError extends Error {
  /** HTTP status code */
  readonly status: number;

  /** HTTP status text (e.g., "Not Found", "Internal Server Error") */
  readonly statusText: string;

  /** Parsed response body if available */
  readonly body?: unknown;

  constructor(status: number, statusText: string, message: string, body?: unknown) {
    // Keep the same message format for backwards compatibility
    super(message);
    this.name = 'MastraClientError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

// ============================================
// Dataset Types
// ============================================

export interface DatasetItemSource {
  type: 'csv' | 'json' | 'trace' | 'llm' | 'experiment-result' | 'candidate-screener';
  referenceId?: string;
}

/** A single item-level static tool mock (agent targets only). */
export interface DatasetItemToolMock {
  /** Name of the tool this mock applies to. */
  toolName: string;
  /** Arguments to match against the tool call (deep equality when matchArgs is 'strict'). */
  args: Record<string, unknown>;
  /** Output served to the agent when this mock is matched and consumed. */
  output: unknown;
  /** Argument matching mode. 'strict' (default) deep-equals args; 'ignore' matches on toolName only. */
  matchArgs?: 'strict' | 'ignore';
}

/** Diagnostic receipt for item-level tool mocks, returned on experiment results. */
export interface ToolMockReport {
  served: Array<{ mockIndex: number; toolName: string; args: unknown }>;
  unconsumed: Array<{ mockIndex: number; toolName: string; args: unknown }>;
  liveCalls: Array<{ toolName: string; args: unknown }>;
  failure?: { code: 'TOOL_MOCK_MISMATCH' | 'TOOL_MOCK_EXHAUSTED'; toolName: string; args: unknown };
}

export interface DatasetItem {
  id: string;
  datasetId: string;
  datasetVersion: number;
  externalId?: string | null;
  input: unknown;
  groundTruth?: unknown;
  expectedTrajectory?: unknown;
  toolMocks?: DatasetItemToolMock[];
  requestContext?: Record<string, unknown>;
  metadata?: unknown;
  source?: DatasetItemSource;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface DatasetRecord {
  id: string;
  name: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  inputSchema?: Record<string, unknown>;
  groundTruthSchema?: Record<string, unknown>;
  requestContextSchema?: Record<string, unknown>;
  tags?: string[] | null;
  targetType?: string | null;
  targetIds?: string[] | null;
  scorerIds?: string[] | null;
  version: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface DatasetExperiment {
  id: string;
  datasetId: string | null;
  datasetVersion: number | null;
  agentVersion: string | null;
  targetType: 'agent' | 'workflow' | 'scorer' | 'processor';
  targetId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalItems: number;
  succeededCount: number;
  failedCount: number;
  startedAt: string | Date | null;
  completedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface DatasetExperimentResult {
  id: string;
  experimentId: string;
  itemId: string;
  itemDatasetVersion: number | null;
  input: unknown;
  output: unknown | null;
  groundTruth: unknown | null;
  error: string | null;
  startedAt: string | Date;
  completedAt: string | Date;
  retryCount: number;
  traceId: string | null;
  status: 'needs-review' | 'reviewed' | 'complete' | null;
  tags: string[] | null;
  toolMockReport?: ToolMockReport | null;
  scores: Array<{
    scorerId: string;
    scorerName: string;
    score: number | null;
    reason: string | null;
    error: string | null;
  }>;
  createdAt: string | Date;
}

export interface UpdateExperimentResultParams {
  datasetId: string;
  experimentId: string;
  resultId: string;
  status?: 'needs-review' | 'reviewed' | 'complete' | null;
  tags?: string[];
}

export interface CreateDatasetParams {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  inputSchema?: Record<string, unknown> | null;
  groundTruthSchema?: Record<string, unknown> | null;
  requestContextSchema?: Record<string, unknown> | null;
  targetType?: string;
  targetIds?: string[];
  scorerIds?: string[];
}

export interface UpdateDatasetParams {
  datasetId: string;
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  inputSchema?: Record<string, unknown> | null;
  groundTruthSchema?: Record<string, unknown> | null;
  requestContextSchema?: Record<string, unknown> | null;
  tags?: string[];
  targetType?: string;
  targetIds?: string[];
  scorerIds?: string[] | null;
  /** Restrict the lookup to a specific tenant organization. */
  organizationId?: string;
  /** Restrict the lookup to a specific tenant project. */
  projectId?: string;
}

export interface AddDatasetItemParams {
  datasetId: string;
  externalId?: string;
  input: unknown;
  groundTruth?: unknown;
  expectedTrajectory?: unknown;
  toolMocks?: DatasetItemToolMock[];
  requestContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  source?: DatasetItemSource;
}

export interface UpdateDatasetItemParams {
  datasetId: string;
  itemId: string;
  input?: unknown;
  groundTruth?: unknown;
  expectedTrajectory?: unknown;
  toolMocks?: DatasetItemToolMock[];
  requestContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  source?: DatasetItemSource;
}

export interface BatchInsertDatasetItemsParams {
  datasetId: string;
  items: Array<{
    externalId?: string;
    input: unknown;
    groundTruth?: unknown;
    expectedTrajectory?: unknown;
    toolMocks?: DatasetItemToolMock[];
    requestContext?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    source?: DatasetItemSource;
  }>;
}

export interface BatchDeleteDatasetItemsParams {
  datasetId: string;
  itemIds: string[];
}

export interface GenerateDatasetItemsParams {
  datasetId: string;
  modelId: string;
  prompt: string;
  count?: number;
  agentContext?: {
    description?: string;
    instructions?: string;
    tools?: string[];
  };
}

export interface GeneratedItem {
  input: unknown;
  groundTruth?: unknown;
}

export interface TriggerDatasetExperimentParams {
  datasetId: string;
  targetType: 'agent' | 'workflow' | 'scorer';
  targetId: string;
  scorerIds?: string[];
  version?: number;
  agentVersion?: string;
  maxConcurrency?: number;
  requestContext?: Record<string, unknown>;
}

export interface CompareExperimentsParams {
  datasetId: string;
  experimentIdA: string;
  experimentIdB: string;
  thresholds?: Record<
    string,
    {
      value: number;
      direction?: 'higher-is-better' | 'lower-is-better';
    }
  >;
}

export interface DatasetItemVersionResponse {
  id: string;
  datasetId: string;
  datasetVersion: number;
  input: unknown;
  groundTruth?: unknown;
  expectedTrajectory?: unknown;
  toolMocks?: DatasetItemToolMock[];
  metadata?: Record<string, unknown>;
  validTo: number | null;
  isDeleted: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface DatasetVersionResponse {
  id: string;
  datasetId: string;
  version: number;
  createdAt: string | Date;
}

export interface CompareExperimentsResponse {
  baselineId: string;
  items: Array<{
    itemId: string;
    input: unknown;
    groundTruth: unknown;
    results: Record<
      string,
      {
        output: unknown;
        scores: Record<string, number | null>;
      } | null
    >;
  }>;
}

// ============================================================================
// Stored Prompt Block Types
// ============================================================================

/**
 * Stored prompt block data returned from API
 */
export interface StoredPromptBlockResponse {
  id: string;
  status: string;
  activeVersionId?: string;
  hasDraft?: boolean;
  authorId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  // Version snapshot config fields (resolved from active version)
  name: string;
  description?: string;
  content: string;
  rules?: RuleGroup;
  requestContextSchema?: Record<string, unknown>;
}

/**
 * Parameters for listing stored prompt blocks
 */
export interface ListStoredPromptBlocksParams {
  page?: number;
  perPage?: number;
  orderBy?: {
    field?: 'createdAt' | 'updatedAt';
    direction?: 'ASC' | 'DESC';
  };
  status?: 'draft' | 'published' | 'archived';
  authorId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Response for listing stored prompt blocks
 */
export interface ListStoredPromptBlocksResponse {
  promptBlocks: StoredPromptBlockResponse[];
  total: number;
  page: number;
  perPage: number | false;
  hasMore: boolean;
}

/**
 * Parameters for creating a stored prompt block
 */
export interface CreateStoredPromptBlockParams {
  id?: string;
  authorId?: string;
  metadata?: Record<string, unknown>;
  name: string;
  description?: string;
  content: string;
  rules?: RuleGroup;
  requestContextSchema?: Record<string, unknown>;
}

/**
 * Parameters for updating a stored prompt block
 */
export interface UpdateStoredPromptBlockParams {
  authorId?: string;
  metadata?: Record<string, unknown>;
  name?: string;
  description?: string;
  content?: string;
  rules?: RuleGroup;
  requestContextSchema?: Record<string, unknown>;
}

/**
 * Response for deleting a stored prompt block
 */
export interface DeleteStoredPromptBlockResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// Prompt Block Version Types
// ============================================================================

export interface PromptBlockVersionResponse {
  id: string;
  blockId: string;
  versionNumber: number;
  name: string;
  description?: string;
  content: string;
  rules?: RuleGroup;
  requestContextSchema?: Record<string, unknown>;
  changedFields?: string[];
  changeMessage?: string;
  createdAt: string;
}

export interface ListPromptBlockVersionsParams {
  page?: number;
  perPage?: number;
  orderBy?: {
    field?: 'versionNumber' | 'createdAt';
    direction?: 'ASC' | 'DESC';
  };
}

export interface ListPromptBlockVersionsResponse {
  versions: PromptBlockVersionResponse[];
  total: number;
  page: number;
  perPage: number | false;
  hasMore: boolean;
}

export interface CreatePromptBlockVersionParams {
  changeMessage?: string;
}

export interface ActivatePromptBlockVersionResponse {
  success: boolean;
  message: string;
  activeVersionId: string;
}

export interface DeletePromptBlockVersionResponse {
  success: boolean;
  message: string;
}

export type BackgroundTaskStatus =
  'pending' | 'running' | 'suspended' | 'completed' | 'failed' | 'cancelled' | 'timed_out';

export type BackgroundTaskDateColumn = 'createdAt' | 'startedAt' | 'completedAt';

export type BackgroundTaskResponse = GeneratedResponse<'GET /background-tasks'>['tasks'][number];

export type ListBackgroundTasksParams = GeneratedRequest<QueryParams<'GET /background-tasks'>>;

export type ListBackgroundTasksResponse = GeneratedResponse<'GET /background-tasks'>;

export type StreamBackgroundTasksParams = GeneratedRequest<QueryParams<'GET /background-tasks/stream'>>;

export type ScheduleStatus = 'active' | 'paused';

export interface ScheduleRunSummary {
  status: WorkflowRunStatus;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  error?: string;
}

/** Attributes rendered onto the signal's XML tag. */
export type ScheduleSignalAttributes = Record<string, string | number | boolean | null | undefined>;

/** Mirrors the core `AgentSignalType` union. */
export type ScheduleSignalType = 'user' | 'state' | 'reactive' | 'notification' | 'user-message' | 'system-reminder';

/** Behavior applied when the thread is already streaming. */
export interface ScheduleIfActive {
  behavior?: 'deliver' | 'persist' | 'discard';
  attributes?: ScheduleSignalAttributes;
}

/**
 * Behavior applied when the thread is idle, plus a serializable subset of
 * stream options forwarded to the woken run.
 */
export interface ScheduleIfIdle {
  behavior?: 'wake' | 'persist' | 'discard';
  attributes?: ScheduleSignalAttributes;
  streamOptions?: {
    requestContext?: Record<string, unknown>;
  };
}

/**
 * Flat agent-schedule view returned by the unified `/schedules` surface.
 * Discriminate from workflow schedules by the presence of `agentId`.
 */
export interface AgentSchedule {
  id: string;
  agentId: string;
  /** Mirror of the workflow-schedule discriminator — always absent on agent schedules. */
  workflowId?: undefined;
  /** Workflow-run summary — never hydrated for agent schedules. */
  lastRun?: undefined;
  name?: string;
  threadId?: string;
  resourceId?: string;
  prompt: string;
  cron: string;
  timezone?: string;
  status: ScheduleStatus;
  nextFireAt: number;
  lastFireAt?: number;
  lastRunId?: string;
  signalType?: ScheduleSignalType;
  tagName?: string;
  attributes?: ScheduleSignalAttributes;
  ifActive?: ScheduleIfActive;
  ifIdle?: ScheduleIfIdle;
  providerOptions?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

/**
 * Flat workflow-schedule view returned by the unified `/schedules` surface.
 * Discriminate from agent schedules by the presence of `workflowId`.
 */
export interface WorkflowSchedule {
  id: string;
  workflowId: string;
  /** Mirror of the agent-schedule discriminator — always absent on workflow schedules. */
  agentId?: undefined;
  cron: string;
  timezone?: string;
  status: ScheduleStatus;
  nextFireAt: number;
  lastFireAt?: number;
  lastRunId?: string;
  lastRun?: ScheduleRunSummary;
  inputData?: unknown;
  initialState?: unknown;
  requestContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

/** Union of the flat views returned by the unified `/schedules` surface. */
export type ScheduleResponse = AgentSchedule | WorkflowSchedule;

export type ScheduleTriggerOutcome =
  'published' | 'succeeded' | 'delivered' | 'persisted' | 'discarded' | 'skipped' | 'aborted' | 'failed';

export type ScheduleTriggerKind = 'schedule-fire' | 'queue-drain' | 'manual';

export interface ScheduleTriggerResponse {
  id?: string;
  scheduleId: string;
  runId: string | null;
  scheduledFireAt: number;
  actualFireAt: number;
  outcome: ScheduleTriggerOutcome;
  error?: string;
  triggerKind?: ScheduleTriggerKind;
  parentTriggerId?: string;
  metadata?: Record<string, unknown>;
  run?: ScheduleRunSummary;
}

export interface ListSchedulesParams {
  /** Scope the list to a single agent's schedules. */
  agentId?: string;
  /** Scope the list to a single workflow's schedules. */
  workflowId?: string;
  status?: ScheduleStatus;
  /** Agent-schedule only: match the target threadId. */
  threadId?: string;
  /** Agent-schedule only: match the target resourceId. */
  resourceId?: string;
  /** Agent-schedule only: match the free-form target name. */
  name?: string;
}

export interface ListSchedulesResponse {
  schedules: ScheduleResponse[];
}

export interface ListScheduleTriggersParams {
  limit?: number;
  fromActualFireAt?: number;
  toActualFireAt?: number;
}

export interface ListScheduleTriggersResponse {
  triggers: ScheduleTriggerResponse[];
}

/**
 * Agent variant of the `client.createSchedule(...)` body — targets an agent
 * by `agentId`. Mirrors `CreateAgentScheduleInput` on the core Schedules
 * service.
 */
export interface CreateAgentScheduleInput {
  /** Optional stable id; normalized to `agent_<slug>`. A random id is generated when omitted. */
  id?: string;
  agentId: string;
  cron: string;
  prompt: string;
  name?: string;
  timezone?: string;
  threadId?: string;
  resourceId?: string;
  signalType?: ScheduleSignalType;
  tagName?: string;
  attributes?: ScheduleSignalAttributes;
  ifActive?: ScheduleIfActive;
  ifIdle?: ScheduleIfIdle;
  providerOptions?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Workflow variant of the `client.createSchedule(...)` body — targets a
 * workflow by `workflowId`. Mirrors `CreateWorkflowScheduleInput` on the
 * core Schedules service.
 */
export interface CreateWorkflowScheduleInput {
  /** Optional stable id; normalized to `schedule_<slug>`. A random id is generated when omitted. */
  id?: string;
  workflowId: string;
  cron: string;
  timezone?: string;
  inputData?: unknown;
  initialState?: unknown;
  requestContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Body for `client.createSchedule(...)`. Discriminated by which target id is
 * present: `agentId` creates an agent schedule, `workflowId` a workflow
 * schedule.
 */
export type CreateScheduleInput = CreateAgentScheduleInput | CreateWorkflowScheduleInput;

/**
 * Patch body for `client.updateSchedule(...)`. Fields apply to the matching
 * target type; agent-only fields on a workflow schedule are rejected by the
 * server. `threadId` / `resourceId` are part of an agent schedule's identity
 * and cannot be changed — to retarget, delete and recreate.
 */
export interface UpdateScheduleInput {
  cron?: string;
  timezone?: string;
  status?: ScheduleStatus;
  metadata?: Record<string, unknown>;
  // Agent-schedule fields
  prompt?: string;
  name?: string;
  signalType?: ScheduleSignalType;
  tagName?: string;
  attributes?: ScheduleSignalAttributes;
  ifActive?: ScheduleIfActive;
  ifIdle?: ScheduleIfIdle;
  providerOptions?: Record<string, unknown>;
  // Workflow-schedule fields
  inputData?: unknown;
  initialState?: unknown;
  requestContext?: Record<string, unknown>;
}

/**
 * Response for POST /schedules/:scheduleId/run.
 *
 * The fire runs asynchronously through the same worker pipeline as scheduled
 * fires. `claimId` is the trigger row's `runId` (used to look up the
 * resulting trigger row via `listScheduleTriggers`).
 */
export interface RunScheduleResponse {
  scheduleId: string;
  claimId: string;
  scheduledFireAt: number;
}

export interface ExperimentReviewCounts {
  experimentId: string;
  total: number;
  needsReview: number;
  reviewed: number;
  complete: number;
}

/**
 * Agent feature flags for the builder.
 *
 * The `GET /editor/builder/settings` response always carries a fully-resolved
 * object. On admin input, omitted keys default to `true` (default-on / allowlist
 * model — admins opt out by setting a key to `false`). Special case: `browser`
 * is only `true` when `configuration.agent.browser` is provided.
 *
 * Clients should still use strict `=== true` checks.
 */
export interface BuilderAgentFeatures {
  tools?: boolean;
  agents?: boolean;
  workflows?: boolean;
  scorers?: boolean;
  skills?: boolean;
  memory?: boolean;
  variables?: boolean;
  favorites?: boolean;
  avatarUpload?: boolean;
  browser?: boolean;
  /**
   * Whether the model picker is visible in the Agent Builder.
   * Omitted/`false` ⇒ picker hidden (locked mode); admin's `models.default` is applied.
   */
  model?: boolean;
}

/**
 * Re-exported from `@mastra/core/agent-builder/ee` so SDK consumers don't need
 * a second import for admin model configuration types. Owned by core.
 */
export type { BuilderModelPolicy, DefaultModelEntry, ProviderModelEntry, ModelProviderId };

/**
 * Response from GET /editor/builder/settings
 */
export interface BuilderSettingsResponse {
  enabled: boolean;
  features?: {
    agent?: BuilderAgentFeatures;
  };
  configuration?: {
    agent?: Record<string, unknown>;
  };
  /**
   * Server-derived model policy. Always present; `{ active: false }` when no
   * builder is configured. UI consumers should read this directly rather than
   * re-deriving from `features` / `configuration`.
   */
  modelPolicy?: BuilderModelPolicy;
  /**
   * Resolved picker visibility for tools, agents, and workflows. Present when
   * the builder is enabled. Each `visible*` field is `null` when unrestricted
   * (show all registered entries) and `string[]` otherwise — making the
   * empty-vs-unrestricted distinction explicit so the UI never has to
   * disambiguate.
   */
  picker?: BuilderPickerResponse;
  /**
   * Non-fatal warnings produced by builder config validation (e.g. allowlist
   * entries with unknown providers that aren't tagged `kind: 'custom'`, or
   * picker allowlist entries that don't match a registered ID).
   * Only present when there is at least one warning.
   */
  modelPolicyWarnings?: string[];
}

/**
 * Response from GET /editor/builder/models/available.
 *
 * Same provider shape as {@link ListAgentsModelProvidersResponse}, but each
 * provider's `models` list is already filtered by the active builder model
 * policy (the server applies the EE allowlist). Providers with no allowed
 * models are omitted, so the picker can render this verbatim.
 */
export type BuilderAvailableModelsResponse = GeneratedResponse<'GET /editor/builder/models/available'>;

/**
 * A valid permission-pattern string (e.g. `agents:read`, `*`).
 *
 * Kept as a string alias so the Playground can name the type while the
 * authoritative set is fetched from the server at runtime.
 */
export type PermissionPattern = string;

/**
 * Response from GET /auth/permission-patterns.
 */
export type PermissionPatternsResponse = GeneratedResponse<'GET /auth/permission-patterns'>;

/**
 * Resolved picker visibility section returned in {@link BuilderSettingsResponse}.
 *
 * Per kind:
 * - `null` ⇒ unrestricted (show all registered entries).
 * - `string[]` ⇒ explicit allowlist (may be empty to show none).
 */
export interface BuilderPickerResponse {
  visibleTools: string[] | null;
  visibleAgents: string[] | null;
  visibleWorkflows: string[] | null;
}

/**
 * Response from GET /editor/builder/infrastructure
 *
 * Agent Builder infrastructure configuration plus lightweight runtime resolution state.
 */
export interface InfrastructureStatusResponse {
  channels: {
    providers: Array<{
      id: string;
      name: string;
      isConfigured: boolean;
      routeCount: number;
    }>;
  };
  browser: {
    type: string | null;
    provider: string | null;
    env: string | null;
    registered: boolean;
    availableProviders: string[];
    config: Array<{ key: string; value: string }>;
  };
  workspace: {
    type: string | null;
    workspaceId: string | null;
    name: string | null;
    source: string | null;
    registered: boolean;
    hasFilesystem: boolean;
    hasSandbox: boolean;
    filesystemProvider: string | null;
    sandboxProvider: string | null;
    config: Array<{ key: string; value: string }>;
  };
  registries: {
    skillsSh: {
      enabled: boolean;
    };
  };
}

// ============================================================================
// Builder registries (skills.sh and other external skill catalogs)
// ============================================================================

/**
 * One known skill registry surfaced from the Agent Builder config.
 */
export interface BuilderRegistryDescriptor {
  id: string;
  enabled: boolean;
  label: string;
}

/**
 * Response from `GET /editor/builder/registries`.
 */
export interface ListBuilderRegistriesResponse {
  registries: BuilderRegistryDescriptor[];
}

/**
 * Single skill summary returned from a registry search/popular endpoint.
 * Wire shape matches the upstream skills.sh proxy.
 */
export interface BuilderRegistrySkillSummary {
  id: string;
  name: string;
  installs: number;
  /** Repository identifier in `owner/repo` or `owner/repo/path` form. */
  topSource: string;
}

/**
 * Response from `GET /editor/builder/registries/:registryId/search`.
 */
export interface BuilderRegistrySearchResponse {
  query: string;
  searchType: string;
  skills: BuilderRegistrySkillSummary[];
  count: number;
}

/**
 * Response from `GET /editor/builder/registries/:registryId/popular`.
 */
export interface BuilderRegistryPopularResponse {
  skills: BuilderRegistrySkillSummary[];
  count: number;
  limit: number;
  offset: number;
}

/**
 * Response from `GET /editor/builder/registries/:registryId/preview`.
 */
export interface BuilderRegistryPreviewResponse {
  content: string;
}

/**
 * Body for `POST /editor/builder/registries/:registryId/install`.
 */
export interface BuilderRegistryInstallBody {
  owner: string;
  repo: string;
  skillName: string;
  visibility?: 'private' | 'public';
}

/**
 * Response from `POST /editor/builder/registries/:registryId/install`.
 */
export interface BuilderRegistryInstallResponse {
  storedSkillId: string;
  name: string;
  filesWritten: number;
}
