import type { JSONValue, ToolInvocationUIPart } from '@ai-sdk/ui-utils';
import type {
  AgentExecutionOptions,
  MultiPrimitiveExecutionOptions,
  AgentGenerateOptions,
  AgentStreamOptions,
  SerializableStructuredOutputOptions,
  ToolsInput,
  UIMessageWithMetadata,
} from '@mastra/core/agent';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { BuilderModelPolicy, DefaultModelEntry, ProviderModelEntry } from '@mastra/core/agent-builder/ee';
import type { ScoreRowData } from '@mastra/core/evals';
import type { CoreMessage, Provider as ModelProviderId } from '@mastra/core/llm';
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
  Rule,
  RuleGroup,
  StorageConditionalVariant,
  StorageConditionalField,
  StoredProcessorGraph,
} from '@mastra/core/storage';
import type { ChunkType } from '@mastra/core/stream';
import type { QueryResult } from '@mastra/core/vector';
import type { WorkflowResult, WorkflowRunStatus, WorkflowState } from '@mastra/core/workflows';
import type { PublicSchema } from '@mastra/schema-compat/schema';

import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema as ZodSchemaV3 } from 'zod/v3';
import type { ZodType as ZodTypeV4 } from 'zod/v4';

import type { Body, PathParams, QueryParams, RouteKey, RouteResponse, Simplify } from './route-types.generated.js';

export type ZodSchema = ZodSchemaV3 | ZodTypeV4;

/**
 * Provider metadata as it travels on a message part: a two-level map of
 * provider namespace -> key -> value (e.g. `{ vertex: { thoughtSignature: '...' } }`).
 */
export type PartProviderMetadata = Record<string, Record<string, JSONValue>>;

/** Stream chunk payloads may carry provider metadata; the AI SDK payload types don't declare it. */
export type MaybeProviderMetadata = { providerMetadata?: PartProviderMetadata };

/**
 * `ToolInvocationUIPart` from `@ai-sdk/ui-utils` has no `providerMetadata` field, but the
 * server reads provider metadata from the part itself (not from the nested `toolInvocation`),
 * so the SDK has to be able to set it there.
 */
export type ToolInvocationUIPartWithMeta = ToolInvocationUIPart & MaybeProviderMetadata;

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
export type SerializedRouteResponse<T extends RouteKey> = GeneratedResponse<T>;
type WithoutIndexSignatures<T> = {
  [K in keyof T as string extends K ? never : number extends K ? never : symbol extends K ? never : K]: T[K];
};

export type ListFeedbackResponse = GeneratedResponse<'GET /observability/feedback'>;
export type FeedbackItem = ListFeedbackResponse['feedback'][number];
export type GetMetricTimeSeriesResponse = GeneratedResponse<'POST /observability/metrics/timeseries'>;

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

export type GetAgentPlanResponse = GeneratedResponse<'GET /agents/:agentId/plans/file'>;

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

type ResponseInput = Body<'POST /v1/responses'>['input'];
type ResponseInputMessageFromRoute = Exclude<ResponseInput, string>[number];
type ResponsePayload = GeneratedResponse<'POST /v1/responses'>;

export type ResponseInputTextPart = Exclude<ResponseInputMessageFromRoute['content'], string>[number];
export type ResponseInputMessage = ResponseInputMessageFromRoute;
export type ResponseTextConfig = NonNullable<Body<'POST /v1/responses'>['text']>;
export type ResponseTextFormat = ResponseTextConfig['format'];
export type ResponseOutputItem = ResponsePayload['output'][number];
export type ResponseOutputMessage = Extract<ResponseOutputItem, { type: 'message' }>;
export type ResponseOutputText = ResponseOutputMessage['content'][number];
export type ResponseOutputFunctionCall = Extract<ResponseOutputItem, { type: 'function_call' }>;
export type ResponseOutputFunctionCallOutput = Extract<ResponseOutputItem, { type: 'function_call_output' }>;
export type ResponseUsage = NonNullable<ResponsePayload['usage']>;
export type ResponseTool = NonNullable<ResponsePayload['tools']>[number];

export type ConversationItem = GeneratedResponse<'GET /v1/conversations/:conversationId/items'>['data'][number];
export type ConversationItemMessage = Extract<ConversationItem, { type: 'message' }>;
export type ConversationItemInputText = Extract<ConversationItemMessage['content'][number], { type: 'input_text' }>;
export type ConversationItemsPage = GeneratedResponse<'GET /v1/conversations/:conversationId/items'>;

/** Response payload augmented by the SDK with concatenated message text. */
export type ResponsesResponse = ResponsePayload & { output_text: string };
export type ResponsesDeleteResponse = GeneratedResponse<'DELETE /v1/responses/:responseId'>;
export type CreateResponseParams = GeneratedRequest<WithoutIndexSignatures<Body<'POST /v1/responses'>>> &
  RequestContextOptions;
export type Conversation = GeneratedResponse<'POST /v1/conversations'>;
export type ConversationDeleted = GeneratedResponse<'DELETE /v1/conversations/:conversationId'>;
export type CreateConversationParams = GeneratedRequest<Body<'POST /v1/conversations'>> & RequestContextOptions;

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
  [K in keyof T as T[K] extends (...args: any[]) => any
    ? never
    : T[K] extends { (): any }
      ? never
      : T[K] extends undefined | ((...args: any[]) => any)
        ? never
        : K]: T[K];
};

export type NetworkStreamParams<OUTPUT = undefined> = {
  messages: MessageListInput;
  model?: string;
  tracingOptions?: TracingOptions;
} & Omit<MultiPrimitiveExecutionOptions<OUTPUT>, 'model'>;

export type GetAgentResponse = GeneratedResponse<'GET /agents/:agentId'>;

/**
 * Response from the deployer-provided browser session probe endpoint.
 *
 * This route is registered dynamically by deployer adapters rather than the
 * server route registry, so it has no generated contract. Use it to decide
 * whether to open a screencast WebSocket for an agent/thread:
 * - `screencastAvailable`: server has the `ws` / `@hono/node-ws` packages installed.
 *   When false, opening a WS will fail and trigger a reconnect loop — skip it.
 * - `hasSession`: the agent has an active browser session for this thread. When
 *   false, the WS would just sit idle waiting for the agent to invoke a tool.
 */
export interface GetAgentBrowserSessionResponse {
  hasSession: boolean;
  screencastAvailable: boolean;
}

export type ClientToolsResolver = () => ToolsInput | undefined;

export type GenerateLegacyParams<T extends JSONSchema7 | ZodSchema | undefined = undefined> = {
  messages: string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[];
  model?: string;
  output?: T;
  experimental_output?: T;
  requestContext?: RequestContext | Record<string, any>;
  clientTools?: ToolsInput;
  clientToolsResolver?: ClientToolsResolver;
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
  clientToolsResolver?: ClientToolsResolver;
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
  clientToolsResolver?: ClientToolsResolver;
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

export type UpdateModelParams = GeneratedRequest<Body<'POST /agents/:agentId/model'>>;

export type UpdateModelInModelListParams = Omit<PathParams<'POST /agents/:agentId/models/:modelConfigId'>, 'agentId'> &
  GeneratedRequest<Body<'POST /agents/:agentId/models/:modelConfigId'>>;

export type ReorderModelListParams = GeneratedRequest<Body<'POST /agents/:agentId/models/reorder'>>;

export type GetToolResponse = GeneratedResponse<'GET /tools/:toolId'>;

/** Query contract with the SDK's legacy `false` sentinel for `limit`. */
export type ListWorkflowRunsParams = Omit<GeneratedRequest<QueryParams<'GET /workflows/:workflowId/runs'>>, 'limit'> & {
  limit?: number | false;
};
export type ListWorkflowRunsResponse = GeneratedResponse<'GET /workflows/:workflowId/runs'> & Serialized<WorkflowRuns>;
export type WorkflowRunCounts = GeneratedResponse<'GET /workflows/run-counts'>[string];
export type ListWorkflowRunCountsResponse = GeneratedResponse<'GET /workflows/run-counts'>;
export type GetWorkflowRunByIdResponse = GeneratedResponse<'GET /workflows/:workflowId/runs/:runId'> &
  Serialized<WorkflowState>;

export type ListDynamicWorkflowsParams = GeneratedRequest<QueryParams<'GET /stored/workflows'>>;
export type ListDynamicWorkflowsResponse = GeneratedResponse<'GET /stored/workflows'>;
export type UpsertDynamicWorkflowParams = GeneratedRequest<Body<'POST /stored/workflows'>>;
export type UpsertDynamicWorkflowResponse = GeneratedResponse<'POST /stored/workflows'>;
type DynamicWorkflowDefinitionField =
  | 'description'
  | 'inputSchema'
  | 'outputSchema'
  | 'stateSchema'
  | 'requestContextSchema'
  | 'graph';
export type DynamicWorkflowDefinition = Omit<
  GeneratedResponse<'GET /stored/workflows/:dynamicWorkflowId'>,
  DynamicWorkflowDefinitionField
> &
  Pick<UpsertDynamicWorkflowParams, DynamicWorkflowDefinitionField>;
export type DeleteDynamicWorkflowResponse = GeneratedResponse<'DELETE /stored/workflows/:dynamicWorkflowId'>;

export type GetWorkflowResponse = GeneratedResponse<'GET /workflows/:workflowId'>;

export type WorkflowRunResult = WorkflowResult<any, any, any, any>;
export type UpsertVectorParams = GeneratedRequest<Body<'POST /vector/:vectorName/upsert'>>;
export type CreateIndexParams = GeneratedRequest<Body<'POST /vector/:vectorName/create-index'>>;

export type QueryVectorParams = GeneratedRequest<Body<'POST /vector/:vectorName/query'>>;

/** The server schema currently represents vector-store-specific result rows as `unknown`. */
export type QueryVectorResponse = GeneratedResponse<'POST /vector/:vectorName/query'> & QueryResult[];

export type GetVectorIndexResponse = GeneratedResponse<'GET /vector/:vectorName/indexes/:indexName'>;

export type SaveMessageToMemoryParams = GeneratedRequest<
  Body<'POST /memory/save-messages'> & QueryParams<'POST /memory/save-messages'>
> &
  RequestContextOptions & {
    messages: (MastraMessageV1 | MastraDBMessage)[];
  };

export type SaveNetworkMessageToMemoryParams = GeneratedRequest<
  Body<'POST /memory/network/save-messages'> & QueryParams<'POST /memory/network/save-messages'>
> & {
  messages: (MastraMessageV1 | MastraDBMessage)[];
};

/** The server schema currently represents persisted message payloads as `unknown`. */
export type SaveMessageToMemoryResponse = GeneratedResponse<'POST /memory/save-messages'> & {
  messages: (MastraMessageV1 | MastraDBMessage)[];
};

export type CreateMemoryThreadParams = GeneratedRequest<
  Body<'POST /memory/threads'> & QueryParams<'POST /memory/threads'>
> &
  RequestContextOptions;

export type CreateMemoryThreadResponse = GeneratedResponse<'POST /memory/threads'>;

export type ListMemoryThreadsParams = GeneratedRequest<QueryParams<'GET /memory/threads'>> & RequestContextOptions;

export type ListMemoryThreadsResponse = GeneratedResponse<'GET /memory/threads'>;

export type GetMemoryConfigParams = GeneratedRequest<QueryParams<'GET /memory/config'>> & RequestContextOptions;

export type GetMemoryConfigResponse = GeneratedResponse<'GET /memory/config'>;

export type UpdateMemoryThreadParams = Omit<
  GeneratedRequest<Body<'PATCH /memory/threads/:threadId'> & QueryParams<'PATCH /memory/threads/:threadId'>>,
  'agentId'
> &
  RequestContextOptions & {
    /** Resolved from the resource constructor when omitted. */
    agentId?: string;
  };

export type ListMemoryThreadMessagesParams = GeneratedRequest<QueryParams<'GET /memory/threads/:threadId/messages'>>;

/** The route schema intentionally keeps persisted message payloads opaque. */
export type ListMemoryThreadMessagesResponse = GeneratedResponse<'GET /memory/threads/:threadId/messages'> & {
  messages: MastraDBMessage[];
};

export type CloneMemoryThreadParams = Omit<
  GeneratedRequest<Body<'POST /memory/threads/:threadId/clone'> & QueryParams<'POST /memory/threads/:threadId/clone'>>,
  'agentId'
> &
  RequestContextOptions & {
    /** Resolved from the resource constructor when omitted. */
    agentId?: string;
  };

/** The route schema intentionally keeps cloned persisted message payloads opaque. */
export type CloneMemoryThreadResponse = GeneratedResponse<'POST /memory/threads/:threadId/clone'> & {
  thread: StorageThreadType;
  clonedMessages: MastraDBMessage[];
};

export type TransferMemoryThreadParams = GeneratedRequest<
  Body<'POST /memory/threads/:threadId/transfer'> & QueryParams<'POST /memory/threads/:threadId/transfer'>
> &
  RequestContextOptions;

export type GetLogsParams = GeneratedRequest<QueryParams<'GET /logs'>>;

export type GetLogParams = Omit<
  PathParams<'GET /logs/:runId'> & GeneratedRequest<QueryParams<'GET /logs/:runId'>>,
  'fromDate' | 'toDate'
> & {
  /** SDK convenience inputs serialized to the route's ISO date query values. */
  fromDate?: Date;
  toDate?: Date;
};

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

export type McpServerListResponse = GeneratedResponse<'GET /mcp/v0/servers'>;

export type McpToolInfo = GeneratedResponse<'GET /mcp/:serverId/tools/:toolId'>;

export type McpServerToolListResponse = GeneratedResponse<'GET /mcp/:serverId/tools'>;

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
export type ListScoresByRunIdParams = GeneratedRequest<
  PathParams<'GET /scores/run/:runId'> & QueryParams<'GET /scores/run/:runId'>
>;

export type ListScoresByScorerIdParams = GeneratedRequest<
  PathParams<'GET /scores/scorer/:scorerId'> & QueryParams<'GET /scores/scorer/:scorerId'>
>;

export type ListScoresByEntityIdParams = GeneratedRequest<
  PathParams<'GET /scores/entity/:entityType/:entityId'> & QueryParams<'GET /scores/entity/:entityType/:entityId'>
>;

/** Score records remain opaque in the route schema because their shape is scorer-specific. */
export type SaveScoreParams = GeneratedRequest<Body<'POST /scores'>> & {
  score: Omit<ScoreRowData, 'id' | 'createdAt' | 'updatedAt'>;
};

/** Score records remain opaque in the route schema because their shape is scorer-specific. */
export type SaveScoreResponse = GeneratedResponse<'POST /scores'> & {
  score: ClientScoreRowData;
};

export type GetScorerResponse = GeneratedResponse<'GET /scores/scorers/:scorerId'>;

export type GetScorersResponse = GeneratedResponse<'GET /scores/scorers'>;

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

export type TimeTravelParams = Omit<Body<'POST /workflows/:workflowId/time-travel'>, 'requestContext'> & {
  requestContext?: RequestContext | Record<string, any>;
};

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
  | { type: 'id'; workspaceId: string }
  | { type: 'inline'; config: Record<string, unknown> };

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
 * Serializable durable-execution opt-in for a stored agent.
 *
 * `cache` and `pubsub` are live runtime objects and cannot be sent over the API —
 * the server inherits them from its Mastra instance.
 */
export type StoredAgentDurableConfig =
  | boolean
  | {
      /** Maximum steps for the durable agentic loop. */
      maxSteps?: number;
      /** Auto-cleanup timer for durable stream state (ms). `0` disables cleanup. */
      cleanupTimeoutMs?: number;
    };

/**
 * Stored agent data returned from API
 */
export type StoredAgentResponse = GeneratedResponse<'GET /stored/agents/:storedAgentId'>;

/**
 * Parameters for listing stored agents
 */
export type ListStoredAgentsParams = GeneratedRequest<QueryParams<'GET /stored/agents'>>;

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
export type ListStoredAgentsResponse = GeneratedResponse<'GET /stored/agents'>;

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
export type CreateStoredAgentParams = GeneratedRequest<Body<'POST /stored/agents'>>;

/**
 * Parameters for updating a stored agent
 */
export type ExportStoredAgentParams = Partial<
  Omit<CreateStoredAgentParams, 'id' | 'authorId' | 'visibility' | 'metadata' | 'autoPublish'>
>;

export type OpenStoredAgentChangeRequestParams = ExportStoredAgentParams & {
  changeMessage?: string;
  userName?: string;
  inspectOnly?: boolean;
};

export type ExportStoredAgentResponse = GeneratedResponse<'POST /stored/agents/:storedAgentId/export'>;

export type OpenStoredAgentChangeRequestResponse =
  GeneratedResponse<'POST /stored/agents/:storedAgentId/change-request'>;

export type UpdateStoredAgentParams = GeneratedRequest<Body<'PATCH /stored/agents/:storedAgentId'>>;

/**
 * Response for deleting a stored agent
 */
export type DeleteStoredAgentResponse = GeneratedResponse<'DELETE /stored/agents/:storedAgentId'>;

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
export type StoredAgentDependentsResponse = GeneratedResponse<'GET /stored/agents/:storedAgentId/dependents'>;

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
export type StoredScorerResponse = GeneratedResponse<'GET /stored/scorers/:storedScorerId'>;

/**
 * Parameters for listing stored scorer definitions
 */
export type ListStoredScorersParams = GeneratedRequest<QueryParams<'GET /stored/scorers'>>;

/**
 * Response for listing stored scorer definitions
 */
export type ListStoredScorersResponse = GeneratedResponse<'GET /stored/scorers'>;

/**
 * Parameters for creating a stored scorer definition
 */
export type CreateStoredScorerParams = GeneratedRequest<Body<'POST /stored/scorers'>>;

/**
 * Parameters for updating a stored scorer definition
 */
export type UpdateStoredScorerParams = GeneratedRequest<Body<'PATCH /stored/scorers/:storedScorerId'>>;

/**
 * Response for deleting a stored scorer definition
 */
export type DeleteStoredScorerResponse = GeneratedResponse<'DELETE /stored/scorers/:storedScorerId'>;

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
export type StoredMCPClientResponse = GeneratedResponse<'GET /stored/mcp-clients/:storedMCPClientId'>;

/**
 * Parameters for listing stored MCP clients
 */
export type ListStoredMCPClientsParams = GeneratedRequest<QueryParams<'GET /stored/mcp-clients'>>;

/**
 * Response for listing stored MCP clients
 */
export type ListStoredMCPClientsResponse = GeneratedResponse<'GET /stored/mcp-clients'>;

/**
 * Parameters for creating a stored MCP client
 */
export type CreateStoredMCPClientParams = GeneratedRequest<Body<'POST /stored/mcp-clients'>>;

/**
 * Parameters for updating a stored MCP client
 */
export type UpdateStoredMCPClientParams = GeneratedRequest<Body<'PATCH /stored/mcp-clients/:storedMCPClientId'>>;

/**
 * Response for deleting a stored MCP client
 */
export type DeleteStoredMCPClientResponse = GeneratedResponse<'DELETE /stored/mcp-clients/:storedMCPClientId'>;

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
export type GetAgentBuilderActionsResponse = GeneratedResponse<'GET /agent-builder'>;

export type Provider = ListAgentsModelProvidersResponse['providers'][number];

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
export type StoredSkillResponse = GeneratedResponse<'GET /stored/skills/:storedSkillId'>;

/**
 * Parameters for listing stored skills
 */
export type ListStoredSkillsParams = GeneratedRequest<QueryParams<'GET /stored/skills'>>;

/**
 * Response for listing stored skills
 */
export type ListStoredSkillsResponse = GeneratedResponse<'GET /stored/skills'>;

/**
 * Parameters for creating a stored skill
 */
export type CreateStoredSkillParams = GeneratedRequest<Body<'POST /stored/skills'>>;

/**
 * Parameters for updating a stored skill
 */
export type UpdateStoredSkillParams = GeneratedRequest<Body<'PATCH /stored/skills/:storedSkillId'>>;

/**
 * Response for deleting a stored skill
 */
export type DeleteStoredSkillResponse = GeneratedResponse<'DELETE /stored/skills/:storedSkillId'>;

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
export type StoredWorkspaceResponse = GeneratedResponse<'GET /stored/workspaces/:storedWorkspaceId'>;

/**
 * Parameters for listing stored workspaces
 */
export type ListStoredWorkspacesParams = GeneratedRequest<QueryParams<'GET /stored/workspaces'>>;

/**
 * Response for listing stored workspaces
 */
export type ListStoredWorkspacesResponse = GeneratedResponse<'GET /stored/workspaces'>;

// ============================================================================
// Processor Types
// ============================================================================

/** Processor phases are defined by the processor detail route. */
export type ProcessorPhase = GeneratedResponse<'GET /processors/:processorId'>['phases'][number];

/** Processor attachment configuration returned by the detail route. */
export type ProcessorConfiguration = GeneratedResponse<'GET /processors/:processorId'>['configurations'][number];

/** Processor summary returned from the processor collection route. */
export type GetProcessorResponse = GeneratedResponse<'GET /processors'>[string];

/** Detailed processor response. */
export type GetProcessorDetailResponse = GeneratedResponse<'GET /processors/:processorId'>;

/** Parameters for executing a processor. */
export type ExecuteProcessorParams = GeneratedRequest<Body<'POST /processors/:processorId/execute'>> &
  RequestContextOptions;

/** Tripwire result returned from processor execution. */
export type ProcessorTripwireResult = NonNullable<
  GeneratedResponse<'POST /processors/:processorId/execute'>['tripwire']
>;

/** Response from processor execution. */
export type ExecuteProcessorResponse = GeneratedResponse<'POST /processors/:processorId/execute'>;

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
  | 'processInput'
  | 'processInputStep'
  | 'processOutputStream'
  | 'processOutputResult'
  | 'processOutputStep';

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

export type DatasetItem = GeneratedResponse<'GET /datasets/:datasetId/items/:itemId'>;

export type DatasetRecord = GeneratedResponse<'GET /datasets/:datasetId'>;

export type ExperimentTargetType = NonNullable<QueryParams<'GET /experiments'>['targetType']>;

export interface ExperimentProvenance {
  source?: string;
  sourceId?: string;
  sourceVersion?: string;
  metadata?: Record<string, unknown>;
}

export interface ExperimentRunnerAttestation {
  runnerId: string;
  invocationId: string;
  runnerVersion?: string;
}

export interface ExperimentGrouping {
  experimentSetId?: string;
  comparisonId?: string;
  variantId?: string;
  trialIndex?: number;
}

export type ListExperimentsParams = GeneratedRequest<QueryParams<'GET /experiments'>>;

export type ListDatasetsParams = GeneratedRequest<QueryParams<'GET /datasets'>>;

export type DatasetExperiment = GeneratedResponse<'GET /experiments'>['experiments'][number];

export type DatasetExperimentResult =
  GeneratedResponse<'GET /datasets/:datasetId/experiments/:experimentId/results'>['results'][number] & {
    /**
     * Aggregated scorer runs are a client convenience: score records are fetched
     * from the scores store rather than embedded in the route response.
     */
    scores?: Array<{
      scorerId: string;
      scorerName: string;
      score: number | null;
      reason: string | null;
      error: string | null;
    }>;
  };

export type UpdateExperimentResultParams =
  PathParams<'PATCH /datasets/:datasetId/experiments/:experimentId/results/:resultId'> &
    WithoutIndexSignatures<
      GeneratedRequest<Body<'PATCH /datasets/:datasetId/experiments/:experimentId/results/:resultId'>>
    >;

export type CreateDatasetParams = WithoutIndexSignatures<GeneratedRequest<Body<'POST /datasets'>>>;

export type UpdateDatasetParams = PathParams<'PATCH /datasets/:datasetId'> &
  WithoutIndexSignatures<GeneratedRequest<Body<'PATCH /datasets/:datasetId'>>> &
  GeneratedRequest<QueryParams<'PATCH /datasets/:datasetId'>>;

export type AddDatasetItemParams = PathParams<'POST /datasets/:datasetId/items'> &
  WithoutIndexSignatures<GeneratedRequest<Body<'POST /datasets/:datasetId/items'>>>;

export type UpdateDatasetItemParams = PathParams<'PATCH /datasets/:datasetId/items/:itemId'> &
  WithoutIndexSignatures<GeneratedRequest<Body<'PATCH /datasets/:datasetId/items/:itemId'>>>;

export type BatchInsertDatasetItemsParams = PathParams<'POST /datasets/:datasetId/items/batch'> &
  WithoutIndexSignatures<GeneratedRequest<Body<'POST /datasets/:datasetId/items/batch'>>>;

export type BatchDeleteDatasetItemsParams = PathParams<'DELETE /datasets/:datasetId/items/batch'> &
  WithoutIndexSignatures<GeneratedRequest<Body<'DELETE /datasets/:datasetId/items/batch'>>>;

export type GenerateDatasetItemsParams = PathParams<'POST /datasets/:datasetId/generate-items'> &
  WithoutIndexSignatures<GeneratedRequest<Body<'POST /datasets/:datasetId/generate-items'>>>;

export type GeneratedItem = GeneratedResponse<'POST /datasets/:datasetId/generate-items'>['items'][number];

export type UpdateDatasetExperimentParams = PathParams<'PATCH /datasets/:datasetId/experiments/:experimentId'> &
  WithoutIndexSignatures<GeneratedRequest<Body<'PATCH /datasets/:datasetId/experiments/:experimentId'>>>;

export type TriggerDatasetExperimentParams = PathParams<'POST /datasets/:datasetId/experiments'> &
  WithoutIndexSignatures<GeneratedRequest<Body<'POST /datasets/:datasetId/experiments'>>>;

export type CreateDatasetExperimentParams = PathParams<'POST /datasets/:datasetId/experiments'> &
  WithoutIndexSignatures<GeneratedRequest<Body<'POST /datasets/:datasetId/experiments'>>>;

export type CreateDatasetExperimentResponse = GeneratedResponse<'POST /datasets/:datasetId/experiments'>;

export type RunExperimentItemParams =
  PathParams<'POST /datasets/:datasetId/experiments/:experimentId/items/:itemId/run'> &
    WithoutIndexSignatures<
      GeneratedRequest<Body<'POST /datasets/:datasetId/experiments/:experimentId/items/:itemId/run'>>
    >;

/**
 * A single experiment result row as the server returns it: structured
 * `error` object and no aggregated `scores` (scores live in the scores
 * store, keyed by `runId = experimentId`).
 */
export type DatasetExperimentResultRow = Omit<DatasetExperimentResult, 'scores'>;

export type RunExperimentItemResponse =
  GeneratedResponse<'POST /datasets/:datasetId/experiments/:experimentId/items/:itemId/run'>;

export type SubmitExperimentResultParams = PathParams<'POST /datasets/:datasetId/experiments/:experimentId/results'> &
  WithoutIndexSignatures<GeneratedRequest<Body<'POST /datasets/:datasetId/experiments/:experimentId/results'>>>;

export type FinalizeExperimentParams = PathParams<'POST /datasets/:datasetId/experiments/:experimentId/finalize'>;

export type CompareExperimentsParams = PathParams<'POST /datasets/:datasetId/compare'> &
  WithoutIndexSignatures<GeneratedRequest<Body<'POST /datasets/:datasetId/compare'>>>;

export type DatasetItemVersionResponse =
  GeneratedResponse<'GET /datasets/:datasetId/items/:itemId/versions/:datasetVersion'>;

export type DatasetVersionResponse = GeneratedResponse<'GET /datasets/:datasetId/versions'>['versions'][number];

export type CompareExperimentsResponse = GeneratedResponse<'POST /datasets/:datasetId/compare'>;

// ============================================================================
// Stored Prompt Block Types
// ============================================================================

/**
 * Stored prompt block data returned from API
 */
export type StoredPromptBlockResponse = GeneratedResponse<'GET /stored/prompt-blocks/:storedPromptBlockId'>;

/**
 * Parameters for listing stored prompt blocks
 */
export type ListStoredPromptBlocksParams = GeneratedRequest<QueryParams<'GET /stored/prompt-blocks'>>;

/**
 * Response for listing stored prompt blocks
 */
export type ListStoredPromptBlocksResponse = GeneratedResponse<'GET /stored/prompt-blocks'>;

/**
 * Parameters for creating a stored prompt block
 */
export type CreateStoredPromptBlockParams = GeneratedRequest<Body<'POST /stored/prompt-blocks'>>;

/**
 * Parameters for updating a stored prompt block
 */
export type UpdateStoredPromptBlockParams = GeneratedRequest<Body<'PATCH /stored/prompt-blocks/:storedPromptBlockId'>>;

/**
 * Response for deleting a stored prompt block
 */
export type DeleteStoredPromptBlockResponse = GeneratedResponse<'DELETE /stored/prompt-blocks/:storedPromptBlockId'>;

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
  | 'pending'
  | 'running'
  | 'suspended'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out';

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
export type AgentSchedule = Extract<GeneratedResponse<'GET /schedules'>['schedules'][number], { agentId: string }>;

/**
 * Flat workflow-schedule view returned by the unified `/schedules` surface.
 * Discriminate from agent schedules by the presence of `workflowId`.
 */
export type WorkflowSchedule = Extract<
  GeneratedResponse<'GET /schedules'>['schedules'][number],
  { workflowId: string }
>;

/** Union of the flat views returned by the unified `/schedules` surface. */
export type ScheduleResponse = AgentSchedule | WorkflowSchedule;

export type ScheduleTriggerOutcome =
  | 'published'
  | 'succeeded'
  | 'delivered'
  | 'persisted'
  | 'discarded'
  | 'skipped'
  | 'aborted'
  | 'failed';

export type ScheduleTriggerKind = 'schedule-fire' | 'queue-drain' | 'manual';

export type ScheduleTriggerResponse = GeneratedResponse<'GET /schedules/:scheduleId/triggers'>['triggers'][number];

export type ListSchedulesParams = GeneratedRequest<QueryParams<'GET /schedules'>>;

export type ListSchedulesResponse = GeneratedResponse<'GET /schedules'>;

export type ListScheduleTriggersParams = GeneratedRequest<QueryParams<'GET /schedules/:scheduleId/triggers'>>;

export type ListScheduleTriggersResponse = GeneratedResponse<'GET /schedules/:scheduleId/triggers'>;

/**
 * Agent variant of the `client.createSchedule(...)` body — targets an agent
 * by `agentId`. Mirrors `CreateAgentScheduleInput` on the core Schedules
 * service.
 */
export type CreateAgentScheduleInput = Extract<
  WithoutIndexSignatures<GeneratedRequest<Body<'POST /schedules'>>>,
  { agentId: string }
>;

/**
 * Workflow variant of the `client.createSchedule(...)` body — targets a
 * workflow by `workflowId`. Mirrors `CreateWorkflowScheduleInput` on the
 * core Schedules service.
 */
export type CreateWorkflowScheduleInput = Extract<
  WithoutIndexSignatures<GeneratedRequest<Body<'POST /schedules'>>>,
  { workflowId: string }
>;

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
export type UpdateScheduleInput = WithoutIndexSignatures<GeneratedRequest<Body<'PATCH /schedules/:scheduleId'>>>;

/**
 * Response for POST /schedules/:scheduleId/run.
 *
 * The fire runs asynchronously through the same worker pipeline as scheduled
 * fires. `claimId` is the trigger row's `runId` (used to look up the
 * resulting trigger row via `listScheduleTriggers`).
 */
export type RunScheduleResponse = GeneratedResponse<'POST /schedules/:scheduleId/run'>;

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
export type BuilderSettingsResponse = GeneratedResponse<'GET /editor/builder/settings'>;

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
export type WorkflowBuilderSettingsResponse = GeneratedResponse<'GET /editor/workflow-builder/settings'>;

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
export type InfrastructureStatusResponse = GeneratedResponse<'GET /editor/builder/infrastructure'>;

// ============================================================================
// Builder registries (skills.sh and other external skill catalogs)
// ============================================================================

/**
 * One known skill registry surfaced from the Agent Builder config.
 */
export type BuilderRegistryDescriptor = GeneratedResponse<'GET /editor/builder/registries'>['registries'][number];
export type ListBuilderRegistriesResponse = GeneratedResponse<'GET /editor/builder/registries'>;
export type BuilderRegistrySkillSummary =
  GeneratedResponse<'GET /editor/builder/registries/:registryId/search'>['skills'][number];
export type BuilderRegistrySearchResponse = GeneratedResponse<'GET /editor/builder/registries/:registryId/search'>;
export type BuilderRegistryPopularResponse = GeneratedResponse<'GET /editor/builder/registries/:registryId/popular'>;
export type BuilderRegistryPreviewResponse = GeneratedResponse<'GET /editor/builder/registries/:registryId/preview'>;
export type BuilderRegistryInstallBody = GeneratedRequest<Body<'POST /editor/builder/registries/:registryId/install'>>;
export type BuilderRegistryInstallResponse = GeneratedResponse<'POST /editor/builder/registries/:registryId/install'>;

// ============================================================================
// AgentController
// ============================================================================

// Wire shapes derive from the published route contracts, vocabulary from core.
// Event-stream types can't derive this way (SSE routes carry no response
// schema) and stay hand-written in `resources/agent-controller`.
export type { PermissionPolicy, ToolCategory } from '@mastra/core/agent-controller';
export type { TaskItemSnapshot as AgentControllerTaskSnapshot } from '@mastra/core/tools';

export type AgentControllerInfo = GeneratedResponse<'GET /agent-controller'>['agentControllers'][number];

export type CreateAgentControllerSessionResponse = GeneratedResponse<'POST /agent-controller/:controllerId/sessions'>;

export type AgentControllerSessionState = GeneratedResponse<'GET /agent-controller/:controllerId/sessions/:resourceId'>;

/**
 * Agent behavior settings, mirroring the TUI's `/settings` toggles. An absent
 * `thinkingLevel` means the session inherits the configured default rather than
 * overriding it.
 */
export type AgentControllerSessionSettings = NonNullable<AgentControllerSessionState['settings']>;

/**
 * Status-line relevant slice of observational-memory progress, mirroring the
 * TUI status line. `msg` reads `pendingTokens/threshold ↓projectedMessageRemoval`
 * (the active message window before an observation fires); `mem` reads
 * `observationTokens/reflectionThreshold ↓projectedReflectionSavings`
 * (accumulated observations before a reflection fires).
 */
export type AgentControllerOMProgress = NonNullable<AgentControllerSessionState['omProgress']>;

export type AgentControllerModeInfo = GeneratedResponse<'GET /agent-controller/:controllerId/modes'>['modes'][number];

export type AgentControllerAvailableModel =
  GeneratedResponse<'GET /agent-controller/:controllerId/models'>['models'][number];

export type AgentControllerActiveRun =
  GeneratedResponse<'GET /agent-controller/:controllerId/active-runs'>['runs'][number];

/**
 * A thread as it appears in `listThreads()`. Carries the session scoping tags
 * it was stamped with (e.g. `{ projectPath }`) and whether a run is currently
 * executing on it, so one listing can report activity across every scope
 * sharing the resourceId.
 */
export type AgentControllerThreadInfo =
  GeneratedResponse<'GET /agent-controller/:controllerId/sessions/:resourceId/threads'>['threads'][number];

/** A thread as returned by `createThread()` and `cloneThread()`. */
export type CreateAgentControllerThreadResponse =
  GeneratedResponse<'POST /agent-controller/:controllerId/sessions/:resourceId/threads'>;

export type AgentControllerWorkspaceStatus = GeneratedResponse<'GET /agent-controller/:controllerId/workspace'>;

export type AgentControllerGoalRecord = NonNullable<
  GeneratedResponse<'GET /agent-controller/:controllerId/sessions/:resourceId/goal'>['goal']
>;

/** Per-category and per-tool approval policies. */
export type PermissionRules = GeneratedResponse<'GET /agent-controller/:controllerId/sessions/:resourceId/permissions'>;

export type SendNotificationInput = GeneratedRequest<
  Body<'POST /agent-controller/:controllerId/sessions/:resourceId/notifications'>
>;

export type SendNotificationResult =
  GeneratedResponse<'POST /agent-controller/:controllerId/sessions/:resourceId/notifications'>;
