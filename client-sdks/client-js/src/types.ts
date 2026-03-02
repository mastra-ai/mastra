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
  AgentInstructionBlock,
  PaginationInfo,
  WorkflowRuns,
  StorageListMessagesInput,
  ObservationalMemoryRecord,
  Rule,
  RuleGroup,
  StorageConditionalVariant,
  StorageConditionalField,
  StoredProcessorGraph,
} from '@mastra/core/storage';

import type { QueryResult } from '@mastra/core/vector';
import type {
  TimeTravelContext,
  Workflow,
  WorkflowResult,
  WorkflowRunStatus,
  WorkflowState,
} from '@mastra/core/workflows';

import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema } from 'zod';

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

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  stream?: boolean;
  /** Credentials mode for requests. See https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials for more info. */
  credentials?: 'omit' | 'same-origin' | 'include';
}

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
  Omit<AgentGenerateOptions<T>, 'output' | 'experimental_output' | 'requestContext' | 'clientTools' | 'abortSignal'>
>;

export type StreamLegacyParams<T extends JSONSchema7 | ZodSchema | undefined = undefined> = {
  messages: string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[];
  output?: T;
  experimental_output?: T;
  requestContext?: RequestContext | Record<string, any>;
  clientTools?: ToolsInput;
} & WithoutMethods<
  Omit<AgentStreamOptions<T>, 'output' | 'experimental_output' | 'requestContext' | 'clientTools' | 'abortSignal'>
>;

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
} & (OUTPUT extends undefined
    ? { structuredOutput?: never }
    : { structuredOutput: SerializableStructuredOutputOptions<OUTPUT> });

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

export type GetMemoryConfigResponse = {
  config: MemoryConfig & {
    observationalMemory?: {
      enabled: boolean;
      scope?: 'thread' | 'resource';
      shareTokenBudget?: boolean;
      messageTokens?: number | { min: number; max: number };
      observationTokens?: number | { min: number; max: number };
      observationModel?: string;
      reflectionModel?: string;
    };
  };
};

export interface UpdateMemoryThreadParams {
  title: string;
  metadata: Record<string, any>;
  resourceId: string;
  requestContext?: RequestContext | Record<string, any>;
}

export type ListMemoryThreadMessagesParams = Omit<StorageListMessagesInput, 'threadId'>;

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
 */
export type StoredWorkspaceRef =
  | { type: 'id'; workspaceId: string }
  | { type: 'inline'; config: Record<string, unknown> };

// ============================================================================
// Conditional Field Types (for rule-based dynamic agent configuration)
// Re-exported from @mastra/core/storage for convenience
// ============================================================================

export type StoredAgentRule = Rule;
export type StoredAgentRuleGroup = RuleGroup;
export type ConditionalVariant<T> = StorageConditionalVariant<T>;
export type ConditionalField<T> = StorageConditionalField<T>;

/**
 * Stored agent data returned from API
 */
export interface StoredAgentResponse {
  // Thin agent record fields
  id: string;
  status: string;
  activeVersionId?: string;
  authorId?: string;
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
  mcpClients?: ConditionalField<Record<string, StoredMCPClientToolsConfig>>;
  inputProcessors?: ConditionalField<StoredProcessorGraph>;
  outputProcessors?: ConditionalField<StoredProcessorGraph>;
  memory?: ConditionalField<SerializedMemoryConfig>;
  scorers?: ConditionalField<Record<string, StoredAgentScorerConfig>>;
  skills?: ConditionalField<Record<string, StoredAgentSkillConfig>>;
  workspace?: ConditionalField<StoredWorkspaceRef>;
  requestContextSchema?: Record<string, unknown>;
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
  authorId?: string;
  metadata?: Record<string, unknown>;
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
  mcpClients?: ConditionalField<Record<string, StoredMCPClientToolsConfig>>;
  inputProcessors?: ConditionalField<StoredProcessorGraph>;
  outputProcessors?: ConditionalField<StoredProcessorGraph>;
  memory?: ConditionalField<SerializedMemoryConfig>;
  scorers?: ConditionalField<Record<string, StoredAgentScorerConfig>>;
  skills?: ConditionalField<Record<string, StoredAgentSkillConfig>>;
  workspace?: ConditionalField<StoredWorkspaceRef>;
  requestContextSchema?: Record<string, unknown>;
}

/**
 * Parameters for updating a stored agent
 */
export interface UpdateStoredAgentParams {
  authorId?: string;
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
  mcpClients?: ConditionalField<Record<string, StoredMCPClientToolsConfig>>;
  inputProcessors?: ConditionalField<StoredProcessorGraph>;
  outputProcessors?: ConditionalField<StoredProcessorGraph>;
  memory?: ConditionalField<SerializedMemoryConfig>;
  scorers?: ConditionalField<Record<string, StoredAgentScorerConfig>>;
  skills?: ConditionalField<Record<string, StoredAgentSkillConfig>>;
  workspace?: ConditionalField<StoredWorkspaceRef>;
  requestContextSchema?: Record<string, unknown>;
}

/**
 * Response for deleting a stored agent
 */
export interface DeleteStoredAgentResponse {
  success: boolean;
  message: string;
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
  orderBy?: 'versionNumber' | 'createdAt';
  sortDirection?: 'ASC' | 'DESC';
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
  orderBy?: 'versionNumber' | 'createdAt';
  sortDirection?: 'ASC' | 'DESC';
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

export interface ListAgentsModelProvidersResponse {
  providers: Provider[];
}

export interface Provider {
  id: string;
  name: string;
  envVar: string;
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

export interface GetSystemPackagesResponse {
  packages: MastraPackage[];
}

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

/**
 * Response for getting workspace info
 */
export interface WorkspaceInfoResponse {
  isWorkspaceConfigured: boolean;
  id?: string;
  name?: string;
  status?: string;
  capabilities?: WorkspaceCapabilities;
  safety?: WorkspaceSafety;
}

/**
 * Workspace item in list response
 */
export interface WorkspaceItem {
  id: string;
  name: string;
  status: string;
  source: 'mastra' | 'agent';
  agentId?: string;
  agentName?: string;
  capabilities: WorkspaceCapabilities;
  safety: WorkspaceSafety;
}

/**
 * Response for listing all workspaces
 */
export interface ListWorkspacesResponse {
  workspaces: WorkspaceItem[];
}

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
export interface WorkspaceFsReadResponse {
  path: string;
  content: string;
  type: 'file' | 'directory';
  size?: number;
  mimeType?: string;
}

/**
 * Response for writing a file
 */
export interface WorkspaceFsWriteResponse {
  success: boolean;
  path: string;
}

/**
 * Response for listing files
 */
export interface WorkspaceFsListResponse {
  path: string;
  entries: WorkspaceFileEntry[];
}

/**
 * Response for deleting a file
 */
export interface WorkspaceFsDeleteResponse {
  success: boolean;
  path: string;
}

/**
 * Response for creating a directory
 */
export interface WorkspaceFsMkdirResponse {
  success: boolean;
  path: string;
}

/**
 * Response for getting file stats
 */
export interface WorkspaceFsStatResponse {
  path: string;
  type: 'file' | 'directory';
  size?: number;
  createdAt?: string;
  modifiedAt?: string;
  mimeType?: string;
}

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
export interface WorkspaceSearchParams {
  query: string;
  topK?: number;
  mode?: 'bm25' | 'vector' | 'hybrid';
  minScore?: number;
}

/**
 * Response for searching workspace
 */
export interface WorkspaceSearchResponse {
  results: WorkspaceSearchResult[];
  query: string;
  mode: 'bm25' | 'vector' | 'hybrid';
}

/**
 * Parameters for indexing content
 */
export interface WorkspaceIndexParams {
  path: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Response for indexing content
 */
export interface WorkspaceIndexResponse {
  success: boolean;
  path: string;
}

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
}

/**
 * Full skill data including instructions and file paths
 */
export interface Skill extends SkillMetadata {
  path: string;
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
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  name: string;
  description?: string;
  instructions: string;
  license?: string;
  files?: StoredSkillFileNode[];
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
  metadata?: Record<string, unknown>;
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
  metadata?: Record<string, unknown>;
  name: string;
  description?: string;
  instructions: string;
  license?: string;
  files?: StoredSkillFileNode[];
}

/**
 * Parameters for updating a stored skill
 */
export interface UpdateStoredSkillParams {
  authorId?: string;
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
export interface GetObservationalMemoryParams {
  agentId: string;
  resourceId?: string;
  threadId?: string;
  requestContext?: RequestContext | Record<string, any>;
}

/**
 * Response for observational memory endpoint
 */
export interface GetObservationalMemoryResponse {
  record: ObservationalMemoryRecord | null;
  history?: ObservationalMemoryRecord[];
}

/**
 * Parameters for awaiting buffer status
 */
export interface AwaitBufferStatusParams {
  agentId: string;
  resourceId?: string;
  threadId?: string;
  requestContext?: RequestContext;
}

/**
 * Response for buffer status endpoint
 */
export interface AwaitBufferStatusResponse {
  record: ObservationalMemoryRecord | null;
}

/**
 * Extended memory status response with OM info
 */
export interface GetMemoryStatusResponse {
  result: boolean;
  observationalMemory?: {
    enabled: boolean;
    hasRecord?: boolean;
    originType?: string;
    lastObservedAt?: Date | null;
    tokenCount?: number;
    observationTokenCount?: number;
    isObserving?: boolean;
    isReflecting?: boolean;
  };
}

/**
 * Extended memory config response with OM config
 */
export interface GetMemoryConfigResponseExtended {
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
export interface ListVectorsResponse {
  vectors: Array<{
    name: string;
    id: string;
    type: string;
  }>;
}

/**
 * Response for listing available embedding models
 */
export interface ListEmbeddersResponse {
  embedders: Array<{
    id: string;
    provider: string;
    name: string;
    description: string;
    dimensions: number;
    maxInputTokens: number;
  }>;
}

// ============================================================================
// Tool Provider Types
// ============================================================================

export interface ToolProviderInfo {
  id: string;
  name: string;
  description?: string;
}

export interface ToolProviderToolkit {
  slug: string;
  name: string;
  description?: string;
  icon?: string;
}

export interface ToolProviderToolInfo {
  slug: string;
  name: string;
  description?: string;
  toolkit?: string;
}

export interface ToolProviderPagination {
  total?: number;
  page?: number;
  perPage?: number;
  hasMore: boolean;
}

export interface ListToolProvidersResponse {
  providers: ToolProviderInfo[];
}

export interface ListToolProviderToolkitsResponse {
  data: ToolProviderToolkit[];
  pagination?: ToolProviderPagination;
}

export interface ListToolProviderToolsParams {
  toolkit?: string;
  search?: string;
  page?: number;
  perPage?: number;
}

export interface ListToolProviderToolsResponse {
  data: ToolProviderToolInfo[];
  pagination?: ToolProviderPagination;
}

export type GetToolProviderToolSchemaResponse = Record<string, unknown>;

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

export interface DatasetItem {
  id: string;
  datasetId: string;
  datasetVersion: number;
  input: unknown;
  groundTruth?: unknown;
  metadata?: unknown;
  requestContext?: unknown;
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
  defaultRequestContext?: unknown;
  requestContextSchema?: Record<string, unknown>;
  version: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface DatasetExperiment {
  id: string;
  datasetId: string | null;
  datasetVersion: number | null;
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
  scores: Array<{
    scorerId: string;
    scorerName: string;
    score: number | null;
    reason: string | null;
    error: string | null;
  }>;
  createdAt: string | Date;
}

export interface CreateDatasetParams {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  inputSchema?: Record<string, unknown> | null;
  groundTruthSchema?: Record<string, unknown> | null;
  defaultRequestContext?: unknown;
  requestContextSchema?: Record<string, unknown> | null;
}

export interface UpdateDatasetParams {
  datasetId: string;
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  inputSchema?: Record<string, unknown> | null;
  groundTruthSchema?: Record<string, unknown> | null;
  defaultRequestContext?: unknown;
  requestContextSchema?: Record<string, unknown> | null;
}

export interface AddDatasetItemParams {
  datasetId: string;
  input: unknown;
  groundTruth?: unknown;
  metadata?: Record<string, unknown>;
  requestContext?: unknown;
}

export interface UpdateDatasetItemParams {
  datasetId: string;
  itemId: string;
  input?: unknown;
  groundTruth?: unknown;
  metadata?: Record<string, unknown>;
  requestContext?: unknown;
}

export interface BatchInsertDatasetItemsParams {
  datasetId: string;
  items: Array<{
    input: unknown;
    groundTruth?: unknown;
    metadata?: Record<string, unknown>;
    requestContext?: unknown;
  }>;
}

export interface BatchDeleteDatasetItemsParams {
  datasetId: string;
  itemIds: string[];
}

export interface TriggerDatasetExperimentParams {
  datasetId: string;
  targetType: 'agent' | 'workflow' | 'scorer';
  targetId: string;
  scorerIds?: string[];
  version?: number;
  maxConcurrency?: number;
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
  metadata?: Record<string, unknown>;
  requestContext?: unknown;
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
  orderBy?: 'versionNumber' | 'createdAt';
  sortDirection?: 'ASC' | 'DESC';
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
