import type {
  AgentExecutionOptions,
  MultiPrimitiveExecutionOptions,
  AgentGenerateOptions,
  AgentStreamOptions,
  SerializableStructuredOutputOptions,
  ToolsInput,
  UIMessageWithMetadata,
  AgentInstructions,
} from '@mastra/core/agent';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { MastraScorerEntry, ScoreRowData } from '@mastra/core/evals';
import type { CoreMessage } from '@mastra/core/llm';
import type { BaseLogMessage, LogLevel } from '@mastra/core/logger';
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
  PaginationInfo,
  WorkflowRuns,
  StorageListMessagesInput,
  Rule,
  RuleGroup,
  StorageConditionalVariant,
  StorageConditionalField,
} from '@mastra/core/storage';

import type { QueryResult } from '@mastra/core/vector';
import type {
  TimeTravelContext,
  Workflow,
  WorkflowResult,
  WorkflowRunStatus,
  WorkflowState,
} from '@mastra/core/workflows';
import type { PublicSchema } from '@mastra/schema-compat/schema';

import type {
  ResponseInputMessage,
  ResponseTextFormat,
  ResponseTextConfig,
  ResponseUsage,
  ResponseTool,
  ResponseOutputItem,
  ConversationItem,
  ConversationDeleted,
  // Stored Agents
  StoredAgentResponse,
  ListStoredAgentsParams,
  ListStoredAgentsResponse,
  CreateStoredAgentParams,
  UpdateStoredAgentParams,
  DeleteStoredAgentResponse,
  // Stored Scorers
  StoredScorerResponse,
  ListStoredScorersParams,
  ListStoredScorersResponse,
  CreateStoredScorerParams,
  UpdateStoredScorerParams,
  DeleteStoredScorerResponse,
  // Stored MCP Clients
  StoredMCPClientResponse,
  ListStoredMCPClientsParams,
  ListStoredMCPClientsResponse,
  CreateStoredMCPClientParams,
  UpdateStoredMCPClientParams,
  DeleteStoredMCPClientResponse,
  // Stored Skills
  StoredSkillResponse,
  ListStoredSkillsParams,
  ListStoredSkillsResponse,
  CreateStoredSkillParams,
  UpdateStoredSkillParams,
  DeleteStoredSkillResponse,
  // Stored Prompt Blocks
  StoredPromptBlockResponse,
  ListStoredPromptBlocksParams,
  ListStoredPromptBlocksResponse,
  CreateStoredPromptBlockParams,
  UpdateStoredPromptBlockParams,
  DeleteStoredPromptBlockResponse,
  // Stored Workspaces
  WorkspaceSnapshotConfig,
  // Agent Versions
  AgentVersionResponse,
  ListAgentVersionsParams,
  ListAgentVersionsResponse,
  CreateAgentVersionParams,
  ActivateAgentVersionResponse,
  DeleteAgentVersionResponse,
  VersionDiff,
  CompareVersionsResponse,
  // Scorer Versions
  ScorerVersionResponse,
  ListScorerVersionsParams,
  ListScorerVersionsResponse,
  CreateScorerVersionParams,
  ActivateScorerVersionResponse,
  DeleteScorerVersionResponse,
  CompareScorerVersionsResponse,
  // Prompt Block Versions
  PromptBlockVersionResponse,
  ListPromptBlockVersionsParams,
  ListPromptBlockVersionsResponse,
  CreatePromptBlockVersionParams,
  ActivatePromptBlockVersionResponse,
  DeletePromptBlockVersionResponse,
  // System
  GetSystemPackagesResponse,
  // Workspace
  WorkspaceInfoResponse,
  ListWorkspacesResponse,
  WorkspaceFileEntry,
  WorkspaceFsReadResponse,
  WorkspaceFsWriteResponse,
  WorkspaceFsListResponse,
  WorkspaceFsDeleteResponse,
  WorkspaceFsMkdirResponse,
  WorkspaceFsStatResponse,
  WorkspaceSearchResult,
  WorkspaceSearchParams,
  WorkspaceSearchResponse,
  WorkspaceIndexParams,
  WorkspaceIndexResponse,
  // Skills
  SkillSource,
  SkillMetadata,
  Skill,
  ListSkillsResponse,
  SkillSearchResult,
  SearchSkillsParams,
  SearchSkillsResponse,
  ListSkillReferencesResponse,
  GetSkillReferenceResponse,
  // Processors
  ProcessorConfiguration,
  GetProcessorResponse,
  GetProcessorDetailResponse,
  ExecuteProcessorParams,
  ExecuteProcessorResponse,
  // Processor Providers
  GetProcessorProvidersResponse,
  GetProcessorProviderResponse,
  // Tool Providers
  ListToolProvidersResponse,
  ListToolProviderToolkitsResponse,
  ListToolProviderToolsParams,
  ListToolProviderToolsResponse,
  GetToolProviderToolSchemaResponse,
  // Vectors & Embedders
  ListVectorsResponse,
  ListEmbeddersResponse,
  // Memory
  GetObservationalMemoryResponse,
  AwaitBufferStatusResponse,
  GetMemoryStatusResponse,
  GetMemoryConfigResponseExtended,
  // Datasets
  DatasetItem,
  DatasetRecord,
  DatasetExperiment,
  CreateDatasetParams,
  UpdateDatasetBody,
  AddItemBody,
  UpdateItemBody,
  TriggerExperimentBody,
  CompareExperimentsBody,
  UpdateExperimentResultBody,
  BatchInsertItemsBody,
  BatchDeleteItemsBody,
  GenerateItemsBody,
  GeneratedItem,
  DatasetItemVersionResponse,
  DatasetVersionResponse,
  CompareExperimentsResponse,
} from '@mastra/server/schemas';
import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema } from 'zod/v3';
import type { ZodType as ZodTypeV4 } from 'zod/v4';

export type { ZodSchema };
export type ZodSchemaVersions = ZodSchema | ZodTypeV4;

// ============================================================================
// ============================================================================
// Client Types
// ============================================================================

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

export type { ResponseInputMessage, ResponseTextFormat, ResponseTextConfig };

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

export type { ResponseUsage, ResponseTool, ResponseOutputItem };

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

export type { ConversationItem };

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

export type { ConversationDeleted };

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
  tracingOptions?: TracingOptions;
} & MultiPrimitiveExecutionOptions<OUTPUT>;

export interface GetAgentResponse {
  id: string;
  name: string;
  description?: string;
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
}

export type GenerateLegacyParams<T extends JSONSchema7 | ZodSchema | undefined = undefined> = {
  messages: string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[];
  output?: T;
  experimental_output?: T;
  requestContext?: RequestContext | Record<string, any>;
  clientTools?: ToolsInput;
} & WithoutMethods<
  // Use `any` to avoid "Type instantiation is excessively deep" error from complex ZodSchema generics
  Omit<AgentGenerateOptions<any>, 'output' | 'experimental_output' | 'requestContext' | 'clientTools' | 'abortSignal'>
>;

export type StreamLegacyParams<T extends JSONSchema7 | ZodSchema | undefined = undefined> = {
  messages: string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[];
  output?: T;
  experimental_output?: T;
  requestContext?: RequestContext | Record<string, any>;
  clientTools?: ToolsInput;
} & WithoutMethods<
  // Use `any` to avoid "Type instantiation is excessively deep" error from complex ZodSchema generics
  Omit<AgentStreamOptions<any>, 'output' | 'experimental_output' | 'requestContext' | 'clientTools' | 'abortSignal'>
>;

export type StructuredOutputOptions<OUTPUT = undefined> = Omit<
  SerializableStructuredOutputOptions<OUTPUT>,
  'schema'
> & {
  schema: PublicSchema<OUTPUT>;
};
export type StreamParamsBase<OUTPUT = undefined> = {
  tracingOptions?: TracingOptions;
  requestContext?: RequestContext;
  clientTools?: ToolsInput;
} & WithoutMethods<
  Omit<AgentExecutionOptions<OUTPUT>, 'requestContext' | 'clientTools' | 'options' | 'abortSignal' | 'structuredOutput'>
>;
export type StreamParamsBaseWithoutMessages<OUTPUT = undefined> = StreamParamsBase<OUTPUT>;
export type StreamParams<OUTPUT = undefined> = StreamParamsBase<OUTPUT> & {
  messages: MessageListInput;
} & (OUTPUT extends undefined ? { structuredOutput?: never } : { structuredOutput: StructuredOutputOptions<OUTPUT> });

export type UpdateModelParams = {
  modelId: string;
  provider: 'openai' | 'anthropic' | 'groq' | 'xai' | 'google';
};

export type UpdateModelInModelListParams = {
  modelConfigId: string;
  model?: {
    modelId: string;
    provider: 'openai' | 'anthropic' | 'groq' | 'xai' | 'google';
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
export interface UpsertVectorParams {
  indexName: string;
  vectors: number[][];
  metadata?: Record<string, any>[];
  ids?: string[];
}
export interface CreateIndexParams {
  indexName: string;
  dimension: number;
  metric?: 'cosine' | 'euclidean' | 'dotproduct';
}

export interface QueryVectorParams {
  indexName: string;
  queryVector: number[];
  topK?: number;
  filter?: Record<string, any>;
  includeVector?: boolean;
}

export interface QueryVectorResponse {
  results: QueryResult[];
}

export interface GetVectorIndexResponse {
  dimension: number;
  metric: 'cosine' | 'euclidean' | 'dotproduct';
  count: number;
}

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

export interface CreateMemoryThreadParams {
  title?: string;
  metadata?: Record<string, any>;
  resourceId: string;
  threadId?: string;
  agentId: string;
  requestContext?: RequestContext | Record<string, any>;
}

export type CreateMemoryThreadResponse = StorageThreadType;

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
  orderBy?: 'createdAt' | 'updatedAt';
  sortDirection?: 'ASC' | 'DESC';
  requestContext?: RequestContext | Record<string, any>;
}

export type ListMemoryThreadsResponse = PaginationInfo & {
  threads: StorageThreadType[];
};

export interface GetMemoryConfigParams {
  agentId: string;
  requestContext?: RequestContext | Record<string, any>;
}

export type GetMemoryConfigResponse = { config: MemoryConfig };

export interface UpdateMemoryThreadParams {
  title: string;
  metadata: Record<string, any>;
  resourceId: string;
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
  requestContext?: RequestContext | Record<string, any>;
}

export type CloneMemoryThreadResponse = {
  thread: StorageThreadType;
  clonedMessages: MastraDBMessage[];
};

export interface GetLogsParams {
  transportId: string;
  fromDate?: Date;
  toDate?: Date;
  logLevel?: LogLevel;
  filters?: Record<string, string>;
  page?: number;
  perPage?: number;
}

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

export type GetLogsResponse = {
  logs: BaseLogMessage[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
};

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
 * Inline config type derived from server's workspaceSnapshotConfigSchema.
 */
export type StoredWorkspaceRef =
  | { type: 'id'; workspaceId: string }
  | { type: 'inline'; config: WorkspaceSnapshotConfig };

// ============================================================================
// Conditional Field Types (for rule-based dynamic agent configuration)
// Re-exported from @mastra/core/storage for convenience
// ============================================================================

export type StoredAgentRule = Rule;
export type StoredAgentRuleGroup = RuleGroup;
export type ConditionalVariant<T> = StorageConditionalVariant<T>;
export type ConditionalField<T> = StorageConditionalField<T>;

export type {
  StoredAgentResponse,
  ListStoredAgentsParams,
  ListStoredAgentsResponse,
  CreateStoredAgentParams,
  UpdateStoredAgentParams,
  DeleteStoredAgentResponse,
};

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
  /** Request context for resolving dynamic agent configuration (instructions, model, tools, etc.) */
  requestContext?: RequestContext | Record<string, any>;
}

export type {
  StoredScorerResponse,
  ListStoredScorersParams,
  ListStoredScorersResponse,
  CreateStoredScorerParams,
  UpdateStoredScorerParams,
  DeleteStoredScorerResponse,
};

export type {
  StoredMCPClientResponse,
  ListStoredMCPClientsParams,
  ListStoredMCPClientsResponse,
  CreateStoredMCPClientParams,
  UpdateStoredMCPClientParams,
  DeleteStoredMCPClientResponse,
};

/**
 * MCP server configuration (stdio or http transport).
 * Extracted from StoredMCPClientResponse's servers field.
 */
export type StoredMCPServerConfig = StoredMCPClientResponse['servers'][string];

export type {
  AgentVersionResponse,
  ListAgentVersionsParams,
  ListAgentVersionsResponse,
  CreateAgentVersionParams,
  ActivateAgentVersionResponse,
  DeleteAgentVersionResponse,
  VersionDiff,
  CompareVersionsResponse,
};

/**
 * Response for creating an agent version.
 */
export interface CreateAgentVersionResponse {
  version: AgentVersionResponse;
}

/**
 * Response for restoring an agent version.
 */
export interface RestoreAgentVersionResponse {
  success: boolean;
  message: string;
  version: AgentVersionResponse;
}

export type AgentVersionDiff = VersionDiff;

export type {
  ScorerVersionResponse,
  ListScorerVersionsParams,
  ListScorerVersionsResponse,
  CreateScorerVersionParams,
  ActivateScorerVersionResponse,
  DeleteScorerVersionResponse,
  CompareScorerVersionsResponse,
};

/**
 * Response for listing agent model providers.
 * NOTE: The server's providerSchema is incomplete — it omits envVar, connected, docUrl, models
 * fields that the handler actually returns. We keep the full type here until the server schema is fixed.
 */
export interface ListAgentsModelProvidersResponse {
  providers: Provider[];
}

/**
 * Individual model provider.
 * NOTE: Server's providerSchema is incomplete — keeping manual definition with all fields.
 */
export interface Provider {
  id: string;
  name: string;
  envVar: string;
  connected: boolean;
  docUrl?: string;
  models: string[];
}

export type { GetSystemPackagesResponse };

// ============================================================================
// Workspace Types
// ============================================================================

/**
 * Workspace capabilities
 */
export interface WorkspaceCapabilities {
  hasFilesystem: boolean;
  hasSandbox: boolean;
  canBM25: boolean;
  canVector: boolean;
  canHybrid: boolean;
  hasSkills: boolean;
}

/**
 * Workspace safety configuration
 */
export interface WorkspaceSafety {
  readOnly: boolean;
}

export type {
  WorkspaceInfoResponse,
  ListWorkspacesResponse,
  WorkspaceFileEntry,
  WorkspaceFsReadResponse,
  WorkspaceFsWriteResponse,
  WorkspaceFsListResponse,
  WorkspaceFsDeleteResponse,
  WorkspaceFsMkdirResponse,
  WorkspaceFsStatResponse,
  WorkspaceSearchResult,
  WorkspaceSearchParams,
  WorkspaceSearchResponse,
  WorkspaceIndexParams,
  WorkspaceIndexResponse,
};

export type {
  SkillSource,
  SkillMetadata,
  Skill,
  ListSkillsResponse,
  SkillSearchResult,
  SearchSkillsParams,
  SearchSkillsResponse,
  ListSkillReferencesResponse,
  GetSkillReferenceResponse,
};

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

export type {
  StoredSkillResponse,
  ListStoredSkillsParams,
  ListStoredSkillsResponse,
  CreateStoredSkillParams,
  UpdateStoredSkillParams,
  DeleteStoredSkillResponse,
};

// ============================================================================
// Processor Types
// ============================================================================

/**
 * Phases that a processor can handle.
 */
export type ProcessorPhase = 'input' | 'inputStep' | 'outputStream' | 'outputResult' | 'outputStep';

export type {
  ProcessorConfiguration,
  GetProcessorResponse,
  GetProcessorDetailResponse,
  ExecuteProcessorParams,
  ExecuteProcessorResponse,
};

/**
 * Processor tripwire result.
 * Extracted from ExecuteProcessorResponse's tripwire field.
 */
export type ProcessorTripwireResult = NonNullable<ExecuteProcessorResponse['tripwire']>;

// ============================================================================
// Observational Memory Types
// ============================================================================

/**
 * Parameters for getting observational memory
 */
export interface GetObservationalMemoryParams {
  agentId: string;
  resourceId?: string;
  threadId?: string;
  from?: Date | string;
  to?: Date | string;
  offset?: number;
  limit?: number;
  requestContext?: RequestContext | Record<string, any>;
}

export type {
  GetObservationalMemoryResponse,
  AwaitBufferStatusResponse,
  GetMemoryStatusResponse,
  GetMemoryConfigResponseExtended,
};

/**
 * Parameters for awaiting buffer status
 */
export interface AwaitBufferStatusParams {
  agentId: string;
  resourceId?: string;
  threadId?: string;
  requestContext?: RequestContext;
}

export type { ListVectorsResponse, ListEmbeddersResponse };

export type {
  ListToolProvidersResponse,
  ListToolProviderToolkitsResponse,
  ListToolProviderToolsParams,
  ListToolProviderToolsResponse,
  GetToolProviderToolSchemaResponse,
};

export type { GetProcessorProvidersResponse, GetProcessorProviderResponse };

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

export type {
  DatasetItem,
  DatasetRecord,
  DatasetExperiment,
  GeneratedItem,
  DatasetItemVersionResponse,
  DatasetVersionResponse,
  CompareExperimentsResponse,
  CreateDatasetParams,
  UpdateDatasetBody,
  AddItemBody,
  UpdateItemBody,
  BatchInsertItemsBody,
  BatchDeleteItemsBody,
  GenerateItemsBody,
  TriggerExperimentBody,
  CompareExperimentsBody,
  UpdateExperimentResultBody,
};

/**
 * Dataset experiment result response.
 * NOTE: Kept as manual interface because server's experimentResultResponseSchema is
 * incomplete (missing `scores` field, and `error` is a structured object in the schema
 * but string in the actual API response).
 */
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
  scores: Array<{
    scorerId: string;
    scorerName: string;
    score: number | null;
    reason: string | null;
    error: string | null;
  }>;
  createdAt: string | Date;
}

/**
 * Parameters for updating an experiment result.
 * Includes datasetId, experimentId, resultId for routing + body fields.
 */
export type UpdateExperimentResultParams = {
  datasetId: string;
  experimentId: string;
  resultId: string;
} & UpdateExperimentResultBody;

/**
 * Parameters for updating a dataset.
 * Includes datasetId for routing + body fields.
 */
export type UpdateDatasetParams = { datasetId: string } & UpdateDatasetBody;

/**
 * Parameters for adding a dataset item.
 * Includes datasetId for routing + body fields.
 */
export type AddDatasetItemParams = { datasetId: string } & AddItemBody;

/**
 * Parameters for updating a dataset item.
 * Includes datasetId and itemId for routing + body fields.
 */
export type UpdateDatasetItemParams = { datasetId: string; itemId: string } & UpdateItemBody;

/**
 * Parameters for batch inserting dataset items.
 * Includes datasetId for routing + body fields.
 */
export type BatchInsertDatasetItemsParams = { datasetId: string } & BatchInsertItemsBody;

/**
 * Parameters for batch deleting dataset items.
 * Includes datasetId for routing + body fields.
 */
export type BatchDeleteDatasetItemsParams = { datasetId: string } & BatchDeleteItemsBody;

/**
 * Parameters for generating dataset items via AI.
 * Includes datasetId for routing + body fields.
 */
export type GenerateDatasetItemsParams = { datasetId: string } & GenerateItemsBody;

/**
 * Parameters for triggering a dataset experiment.
 * Includes datasetId for routing + body fields.
 */
export type TriggerDatasetExperimentParams = { datasetId: string } & TriggerExperimentBody;

/**
 * Parameters for comparing experiments.
 * Includes datasetId for routing + body fields.
 */
export type CompareExperimentsParams = { datasetId: string } & CompareExperimentsBody;

export type {
  StoredPromptBlockResponse,
  ListStoredPromptBlocksParams,
  ListStoredPromptBlocksResponse,
  CreateStoredPromptBlockParams,
  UpdateStoredPromptBlockParams,
  DeleteStoredPromptBlockResponse,
};

export type {
  PromptBlockVersionResponse,
  ListPromptBlockVersionsParams,
  ListPromptBlockVersionsResponse,
  CreatePromptBlockVersionParams,
  ActivatePromptBlockVersionResponse,
  DeletePromptBlockVersionResponse,
};

export type BackgroundTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timed_out';

export type BackgroundTaskDateColumn = 'createdAt' | 'startedAt' | 'completedAt';

export interface BackgroundTaskResponse {
  id: string;
  status: BackgroundTaskStatus;
  toolName: string;
  toolCallId: string;
  args: Record<string, unknown>;
  agentId: string;
  threadId?: string;
  resourceId?: string;
  runId: string;
  result?: unknown;
  error?: { message: string; stack?: string };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  retryCount: number;
  maxRetries: number;
  timeoutMs: number;
}

export interface ListBackgroundTasksParams {
  agentId?: string;
  status?: BackgroundTaskStatus;
  runId?: string;
  threadId?: string;
  resourceId?: string;
  fromDate?: Date;
  toDate?: Date;
  dateFilterBy?: BackgroundTaskDateColumn;
  orderBy?: BackgroundTaskDateColumn;
  orderDirection?: 'asc' | 'desc';
  page?: number;
  perPage?: number;
}

export interface ListBackgroundTasksResponse {
  tasks: BackgroundTaskResponse[];
  total: number;
}

export interface StreamBackgroundTasksParams {
  agentId?: string;
  runId?: string;
  threadId?: string;
  resourceId?: string;
}

export interface ExperimentReviewCounts {
  experimentId: string;
  total: number;
  needsReview: number;
  reviewed: number;
  complete: number;
}
