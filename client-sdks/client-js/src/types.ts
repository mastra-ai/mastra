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
import type { PublicSchema } from '@mastra/schema-compat';

import type {
  // Stored Agents
  storedAgentSchema,
  listStoredAgentsResponseSchema,
  createStoredAgentBodySchema,
  updateStoredAgentBodySchema,
  deleteStoredAgentResponseSchema,
  listStoredAgentsQuerySchema,
  // Stored Scorers
  storedScorerSchema,
  listStoredScorersResponseSchema,
  createStoredScorerBodySchema,
  updateStoredScorerBodySchema,
  deleteStoredScorerResponseSchema,
  listStoredScorersQuerySchema,
  // Stored MCP Clients
  storedMCPClientSchema,
  listStoredMCPClientsResponseSchema,
  createStoredMCPClientBodySchema,
  updateStoredMCPClientBodySchema,
  deleteStoredMCPClientResponseSchema,
  listStoredMCPClientsQuerySchema,
  // Stored Skills
  storedSkillSchema,
  listStoredSkillsResponseSchema,
  createStoredSkillBodySchema,
  updateStoredSkillBodySchema,
  deleteStoredSkillResponseSchema,
  listStoredSkillsQuerySchema,
  // Stored Prompt Blocks
  storedPromptBlockSchema,
  listStoredPromptBlocksResponseSchema,
  createStoredPromptBlockBodySchema,
  updateStoredPromptBlockBodySchema,
  deleteStoredPromptBlockResponseSchema,
  listStoredPromptBlocksQuerySchema,
  // Agent Versions
  agentVersionSchema,
  listVersionsQuerySchema,
  listVersionsResponseSchema,
  createVersionBodySchema,
  activateVersionResponseSchema,
  deleteVersionResponseSchema,
  versionDiffEntrySchema,
  compareVersionsResponseSchema,
  // Scorer Versions
  scorerVersionSchema,
  listScorerVersionsQuerySchema,
  listScorerVersionsResponseSchema,
  createScorerVersionBodySchema,
  activateScorerVersionResponseSchema,
  deleteScorerVersionResponseSchema,
  compareScorerVersionsResponseSchema,
  // Prompt Block Versions
  promptBlockVersionSchema,
  listPromptBlockVersionsQuerySchema,
  listPromptBlockVersionsResponseSchema,
  createPromptBlockVersionBodySchema,
  activatePromptBlockVersionResponseSchema,
  deletePromptBlockVersionResponseSchema,
  // System
  systemPackagesResponseSchema,
  // Processors
  processorSerializedSchema,
  processorConfigurationSchema,
  serializedProcessorDetailSchema,
  executeProcessorBodySchema,
  executeProcessorResponseSchema,
  // Processor Providers
  getProcessorProvidersResponseSchema,
  getProcessorProviderResponseSchema,
  // Tool Providers
  listToolProvidersResponseSchema,
  listToolProviderToolkitsResponseSchema,
  listToolProviderToolsQuerySchema,
  listToolProviderToolsResponseSchema,
  getToolProviderToolSchemaResponseSchema,
  // Vectors & Embedders
  listVectorsResponseSchema,
  listEmbeddersResponseSchema,
  // Workspace
  workspaceSnapshotConfigSchema,
  workspaceInfoResponseSchema,
  listWorkspacesResponseSchema,
  fsReadResponseSchema,
  fsWriteResponseSchema,
  fsListResponseSchema,
  fsDeleteResponseSchema,
  fsMkdirResponseSchema,
  fsStatResponseSchema,
  searchResponseSchema,
  searchQuerySchema,
  indexResponseSchema,
  searchResultSchema,
  indexBodySchema,
  fileEntrySchema,
  // Skills (workspace)
  skillSourceSchema,
  skillMetadataSchema,
  skillSchema,
  listSkillsResponseSchema,
  skillSearchResultSchema,
  searchSkillsQuerySchema,
  searchSkillsResponseSchema,
  skillReferenceResponseSchema,
  listReferencesResponseSchema,
  // Memory
  memoryStatusResponseSchema,
  memoryConfigResponseSchema,
  getObservationalMemoryResponseSchema,
  awaitBufferStatusResponseSchema,
  // Datasets
  datasetResponseSchema,
  datasetItemResponseSchema,
  experimentResponseSchema,
  experimentResultResponseSchema,
  createDatasetBodySchema,
  updateDatasetBodySchema,
  addItemBodySchema,
  updateItemBodySchema,
  triggerExperimentBodySchema,
  compareExperimentsBodySchema,
  comparisonResponseSchema,
  itemVersionResponseSchema,
  batchInsertItemsBodySchema,
  batchDeleteItemsBodySchema,
  datasetVersionResponseSchema,
} from '@mastra/server/schemas';
import type { JSONSchema7 } from 'json-schema';
import type { z } from 'zod';
import type { ZodSchema } from 'zod/v3';
import type { JsonSerialized } from './serialization';

// ============================================================================
// Server Schema Imports (for type derivation)
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
 * Inline config type derived from server's workspaceSnapshotConfigSchema.
 */
export type StoredWorkspaceRef =
  | { type: 'id'; workspaceId: string }
  | { type: 'inline'; config: z.input<typeof workspaceSnapshotConfigSchema> };

// ============================================================================
// Conditional Field Types (for rule-based dynamic agent configuration)
// Re-exported from @mastra/core/storage for convenience
// ============================================================================

export type StoredAgentRule = Rule;
export type StoredAgentRuleGroup = RuleGroup;
export type ConditionalVariant<T> = StorageConditionalVariant<T>;
export type ConditionalField<T> = StorageConditionalField<T>;

/**
 * Stored agent data returned from API.
 * Derived from server's storedAgentSchema with Date→string serialization for JSON transport.
 */
export type StoredAgentResponse = JsonSerialized<z.infer<typeof storedAgentSchema>>;

/**
 * Parameters for listing stored agents.
 * Derived from server's listStoredAgentsQuerySchema.
 */
export type ListStoredAgentsParams = z.input<typeof listStoredAgentsQuerySchema>;

/**
 * Response for listing stored agents.
 * Derived from server's listStoredAgentsResponseSchema with Date→string serialization.
 */
export type ListStoredAgentsResponse = JsonSerialized<z.infer<typeof listStoredAgentsResponseSchema>>;

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
 * Derived from server's createStoredAgentBodySchema.
 */
export type CreateStoredAgentParams = z.input<typeof createStoredAgentBodySchema>;

/**
 * Parameters for updating a stored agent.
 * Derived from server's updateStoredAgentBodySchema.
 */
export type UpdateStoredAgentParams = z.input<typeof updateStoredAgentBodySchema>;

/**
 * Response for deleting a stored agent.
 * Derived from server's deleteStoredAgentResponseSchema.
 */
export type DeleteStoredAgentResponse = z.infer<typeof deleteStoredAgentResponseSchema>;

// ============================================================================
// Stored Scorer Definition Types (derived from @mastra/server/schemas)
// ============================================================================

/**
 * Stored scorer definition data returned from API.
 * Derived from server's storedScorerSchema with Date→string serialization.
 */
export type StoredScorerResponse = JsonSerialized<z.infer<typeof storedScorerSchema>>;

/**
 * Parameters for listing stored scorer definitions.
 * Derived from server's listStoredScorersQuerySchema.
 */
export type ListStoredScorersParams = z.input<typeof listStoredScorersQuerySchema>;

/**
 * Response for listing stored scorer definitions.
 * Derived from server's listStoredScorersResponseSchema with Date→string serialization.
 */
export type ListStoredScorersResponse = JsonSerialized<z.infer<typeof listStoredScorersResponseSchema>>;

/**
 * Parameters for creating a stored scorer definition.
 * Derived from server's createStoredScorerBodySchema.
 */
export type CreateStoredScorerParams = z.input<typeof createStoredScorerBodySchema>;

/**
 * Parameters for updating a stored scorer definition.
 * Derived from server's updateStoredScorerBodySchema.
 */
export type UpdateStoredScorerParams = z.input<typeof updateStoredScorerBodySchema>;

/**
 * Response for deleting a stored scorer definition.
 * Derived from server's deleteStoredScorerResponseSchema.
 */
export type DeleteStoredScorerResponse = z.infer<typeof deleteStoredScorerResponseSchema>;

// ============================================================================
// Stored MCP Client Types (derived from @mastra/server/schemas)
// ============================================================================

/**
 * Stored MCP client data returned from API.
 * Derived from server's storedMCPClientSchema with Date→string serialization.
 */
export type StoredMCPClientResponse = JsonSerialized<z.infer<typeof storedMCPClientSchema>>;

/**
 * MCP server configuration (stdio or http transport).
 * Extracted from StoredMCPClientResponse's servers field.
 */
export type StoredMCPServerConfig = StoredMCPClientResponse['servers'][string];

/**
 * Parameters for listing stored MCP clients.
 * Derived from server's listStoredMCPClientsQuerySchema.
 */
export type ListStoredMCPClientsParams = z.input<typeof listStoredMCPClientsQuerySchema>;

/**
 * Response for listing stored MCP clients.
 * Derived from server's listStoredMCPClientsResponseSchema with Date→string serialization.
 */
export type ListStoredMCPClientsResponse = JsonSerialized<z.infer<typeof listStoredMCPClientsResponseSchema>>;

/**
 * Parameters for creating a stored MCP client.
 * Derived from server's createStoredMCPClientBodySchema.
 */
export type CreateStoredMCPClientParams = z.input<typeof createStoredMCPClientBodySchema>;

/**
 * Parameters for updating a stored MCP client.
 * Derived from server's updateStoredMCPClientBodySchema.
 */
export type UpdateStoredMCPClientParams = z.input<typeof updateStoredMCPClientBodySchema>;

/**
 * Response for deleting a stored MCP client.
 * Derived from server's deleteStoredMCPClientResponseSchema.
 */
export type DeleteStoredMCPClientResponse = z.infer<typeof deleteStoredMCPClientResponseSchema>;

// ============================================================================
// Agent Version Types (derived from @mastra/server/schemas)
// ============================================================================

/**
 * Agent version data returned from API.
 * Derived from server's agentVersionSchema with Date→string serialization.
 */
export type AgentVersionResponse = JsonSerialized<z.infer<typeof agentVersionSchema>>;

/**
 * Parameters for listing agent versions.
 * Derived from server's listVersionsQuerySchema.
 */
export type ListAgentVersionsParams = z.input<typeof listVersionsQuerySchema>;

/**
 * Response for listing agent versions.
 * Derived from server's listVersionsResponseSchema with Date→string serialization.
 */
export type ListAgentVersionsResponse = JsonSerialized<z.infer<typeof listVersionsResponseSchema>>;

/**
 * Parameters for creating an agent version.
 * Derived from server's createVersionBodySchema.
 */
export type CreateAgentVersionParams = z.input<typeof createVersionBodySchema>;

/**
 * Response for creating an agent version.
 */
export interface CreateAgentVersionResponse {
  version: AgentVersionResponse;
}

/**
 * Response for activating an agent version.
 * Derived from server's activateVersionResponseSchema.
 */
export type ActivateAgentVersionResponse = z.infer<typeof activateVersionResponseSchema>;

/**
 * Response for restoring an agent version.
 */
export interface RestoreAgentVersionResponse {
  success: boolean;
  message: string;
  version: AgentVersionResponse;
}

/**
 * Response for deleting an agent version.
 * Derived from server's deleteVersionResponseSchema.
 */
export type DeleteAgentVersionResponse = z.infer<typeof deleteVersionResponseSchema>;

/**
 * Version diff entry.
 * Derived from server's versionDiffEntrySchema.
 */
export type VersionDiff = z.infer<typeof versionDiffEntrySchema>;

export type AgentVersionDiff = VersionDiff;

/**
 * Response for comparing agent versions.
 * Derived from server's compareVersionsResponseSchema with Date→string serialization.
 */
export type CompareVersionsResponse = JsonSerialized<z.infer<typeof compareVersionsResponseSchema>>;

// ============================================================================
// Scorer Version Types (derived from @mastra/server/schemas)
// ============================================================================

/**
 * Scorer version data returned from API.
 * Derived from server's scorerVersionSchema with Date→string serialization.
 */
export type ScorerVersionResponse = JsonSerialized<z.infer<typeof scorerVersionSchema>>;

/**
 * Parameters for listing scorer versions.
 * Derived from server's listScorerVersionsQuerySchema.
 */
export type ListScorerVersionsParams = z.input<typeof listScorerVersionsQuerySchema>;

/**
 * Response for listing scorer versions.
 * Derived from server's listScorerVersionsResponseSchema with Date→string serialization.
 */
export type ListScorerVersionsResponse = JsonSerialized<z.infer<typeof listScorerVersionsResponseSchema>>;

/**
 * Parameters for creating a scorer version.
 * Derived from server's createScorerVersionBodySchema.
 */
export type CreateScorerVersionParams = z.input<typeof createScorerVersionBodySchema>;

/**
 * Response for activating a scorer version.
 * Derived from server's activateScorerVersionResponseSchema.
 */
export type ActivateScorerVersionResponse = z.infer<typeof activateScorerVersionResponseSchema>;

/**
 * Response for deleting a scorer version.
 * Derived from server's deleteScorerVersionResponseSchema.
 */
export type DeleteScorerVersionResponse = z.infer<typeof deleteScorerVersionResponseSchema>;

/**
 * Response for comparing scorer versions.
 * Derived from server's compareScorerVersionsResponseSchema with Date→string serialization.
 */
export type CompareScorerVersionsResponse = JsonSerialized<z.infer<typeof compareScorerVersionsResponseSchema>>;

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

// ============================================================================
// System Types (derived from @mastra/server/schemas)
// ============================================================================

// MastraPackage is exported from @mastra/server/schemas via re-export in index.ts

export type GetSystemPackagesResponse = z.infer<typeof systemPackagesResponseSchema>;

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
 * Response for getting workspace info.
 * Derived from server's workspaceInfoResponseSchema.
 */
export type WorkspaceInfoResponse = z.infer<typeof workspaceInfoResponseSchema>;

/**
 * Response for listing all workspaces.
 * Derived from server's listWorkspacesResponseSchema.
 */
export type ListWorkspacesResponse = z.infer<typeof listWorkspacesResponseSchema>;

/**
 * File entry in directory listing.
 * Derived from server's fileEntrySchema.
 */
export type WorkspaceFileEntry = z.infer<typeof fileEntrySchema>;

/**
 * Response for reading a file.
 * Derived from server's fsReadResponseSchema.
 */
export type WorkspaceFsReadResponse = z.infer<typeof fsReadResponseSchema>;

/**
 * Response for writing a file.
 * Derived from server's fsWriteResponseSchema.
 */
export type WorkspaceFsWriteResponse = z.infer<typeof fsWriteResponseSchema>;

/**
 * Response for listing files.
 * Derived from server's fsListResponseSchema.
 */
export type WorkspaceFsListResponse = z.infer<typeof fsListResponseSchema>;

/**
 * Response for deleting a file.
 * Derived from server's fsDeleteResponseSchema.
 */
export type WorkspaceFsDeleteResponse = z.infer<typeof fsDeleteResponseSchema>;

/**
 * Response for creating a directory.
 * Derived from server's fsMkdirResponseSchema.
 */
export type WorkspaceFsMkdirResponse = z.infer<typeof fsMkdirResponseSchema>;

/**
 * Response for getting file stats.
 * Derived from server's fsStatResponseSchema.
 */
export type WorkspaceFsStatResponse = z.infer<typeof fsStatResponseSchema>;

/**
 * Workspace search result.
 * Derived from server's searchResultSchema.
 */
export type WorkspaceSearchResult = z.infer<typeof searchResultSchema>;

/**
 * Parameters for searching workspace content.
 * Derived from server's searchQuerySchema.
 */
export type WorkspaceSearchParams = z.input<typeof searchQuerySchema>;

/**
 * Response for searching workspace.
 * Derived from server's searchResponseSchema.
 */
export type WorkspaceSearchResponse = z.infer<typeof searchResponseSchema>;

/**
 * Parameters for indexing content.
 * Derived from server's indexBodySchema.
 */
export type WorkspaceIndexParams = z.input<typeof indexBodySchema>;

/**
 * Response for indexing content.
 * Derived from server's indexResponseSchema.
 */
export type WorkspaceIndexResponse = z.infer<typeof indexResponseSchema>;

// ============================================================================
// Skills Types
// ============================================================================

/**
 * Skill source type indicating where the skill comes from.
 * Derived from server's skillSourceSchema.
 */
export type SkillSource = z.infer<typeof skillSourceSchema>;

/**
 * Skill metadata (without instructions content).
 * Derived from server's skillMetadataSchema.
 */
export type SkillMetadata = z.infer<typeof skillMetadataSchema>;

/**
 * Full skill data including instructions and file paths.
 * Derived from server's skillSchema.
 */
export type Skill = z.infer<typeof skillSchema>;

/**
 * Response for listing skills.
 * Derived from server's listSkillsResponseSchema.
 */
export type ListSkillsResponse = z.infer<typeof listSkillsResponseSchema>;

/**
 * Skill search result.
 * Derived from server's skillSearchResultSchema.
 */
export type SkillSearchResult = z.infer<typeof skillSearchResultSchema>;

/**
 * Parameters for searching skills.
 * Derived from server's searchSkillsQuerySchema.
 */
export type SearchSkillsParams = z.input<typeof searchSkillsQuerySchema>;

/**
 * Response for searching skills.
 * Derived from server's searchSkillsResponseSchema.
 */
export type SearchSkillsResponse = z.infer<typeof searchSkillsResponseSchema>;

/**
 * Response for listing skill references.
 * Derived from server's listReferencesResponseSchema.
 */
export type ListSkillReferencesResponse = z.infer<typeof listReferencesResponseSchema>;

/**
 * Response for getting skill reference content.
 * Derived from server's skillReferenceResponseSchema.
 */
export type GetSkillReferenceResponse = z.infer<typeof skillReferenceResponseSchema>;

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
 * Stored skill data returned from API.
 * Derived from server's storedSkillSchema with Date→string serialization.
 */
export type StoredSkillResponse = JsonSerialized<z.infer<typeof storedSkillSchema>>;

/**
 * Parameters for listing stored skills.
 * Derived from server's listStoredSkillsQuerySchema.
 */
export type ListStoredSkillsParams = z.input<typeof listStoredSkillsQuerySchema>;

/**
 * Response for listing stored skills.
 * Derived from server's listStoredSkillsResponseSchema with Date→string serialization.
 */
export type ListStoredSkillsResponse = JsonSerialized<z.infer<typeof listStoredSkillsResponseSchema>>;

/**
 * Parameters for creating a stored skill.
 * Derived from server's createStoredSkillBodySchema.
 */
export type CreateStoredSkillParams = z.input<typeof createStoredSkillBodySchema>;

/**
 * Parameters for updating a stored skill.
 * Derived from server's updateStoredSkillBodySchema.
 */
export type UpdateStoredSkillParams = z.input<typeof updateStoredSkillBodySchema>;

/**
 * Response for deleting a stored skill.
 * Derived from server's deleteStoredSkillResponseSchema.
 */
export type DeleteStoredSkillResponse = z.infer<typeof deleteStoredSkillResponseSchema>;

// ============================================================================
// Processor Types
// ============================================================================

/**
 * Phases that a processor can handle.
 */
export type ProcessorPhase = 'input' | 'inputStep' | 'outputStream' | 'outputResult' | 'outputStep';

/**
 * Configuration of how a processor is attached to an agent.
 * Derived from server's processorConfigurationSchema.
 */
export type ProcessorConfiguration = z.infer<typeof processorConfigurationSchema>;

/**
 * Processor in list response.
 * Derived from server's processorSerializedSchema (renamed from serializedProcessorSchema).
 */
export type GetProcessorResponse = z.infer<typeof processorSerializedSchema>;

/**
 * Detailed processor response.
 * Derived from server's serializedProcessorDetailSchema.
 */
export type GetProcessorDetailResponse = z.infer<typeof serializedProcessorDetailSchema>;

/**
 * Parameters for executing a processor.
 * Derived from server's executeProcessorBodySchema.
 */
export type ExecuteProcessorParams = z.input<typeof executeProcessorBodySchema>;

/**
 * Response from processor execution.
 * Derived from server's executeProcessorResponseSchema with Date→string serialization.
 */
export type ExecuteProcessorResponse = JsonSerialized<z.infer<typeof executeProcessorResponseSchema>>;

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
  requestContext?: RequestContext | Record<string, any>;
}

/**
 * Response for observational memory endpoint.
 * Derived from server's getObservationalMemoryResponseSchema.
 */
export type GetObservationalMemoryResponse = z.infer<typeof getObservationalMemoryResponseSchema>;

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
 * Response for buffer status endpoint.
 * Derived from server's awaitBufferStatusResponseSchema.
 */
export type AwaitBufferStatusResponse = z.infer<typeof awaitBufferStatusResponseSchema>;

/**
 * Extended memory status response with OM info.
 * Derived from server's memoryStatusResponseSchema with Date→string serialization.
 */
export type GetMemoryStatusResponse = JsonSerialized<z.infer<typeof memoryStatusResponseSchema>>;

/**
 * Extended memory config response with OM config.
 * Derived from server's memoryConfigResponseSchema.
 */
export type GetMemoryConfigResponseExtended = z.infer<typeof memoryConfigResponseSchema>;

// ============================================================================
// Vector & Embedder Types
// ============================================================================

/**
 * Response for listing available vector stores.
 * Derived from server's listVectorsResponseSchema.
 */
export type ListVectorsResponse = z.infer<typeof listVectorsResponseSchema>;

/**
 * Response for listing available embedding models.
 * Derived from server's listEmbeddersResponseSchema.
 */
export type ListEmbeddersResponse = z.infer<typeof listEmbeddersResponseSchema>;

// ============================================================================
// Tool Provider Types
// ============================================================================

/**
 * Response for listing tool providers.
 * Derived from server's listToolProvidersResponseSchema.
 */
export type ListToolProvidersResponse = z.infer<typeof listToolProvidersResponseSchema>;

/**
 * Response for listing tool provider toolkits.
 * Derived from server's listToolProviderToolkitsResponseSchema.
 */
export type ListToolProviderToolkitsResponse = z.infer<typeof listToolProviderToolkitsResponseSchema>;

/**
 * Parameters for listing tool provider tools.
 * Derived from server's listToolProviderToolsQuerySchema.
 */
export type ListToolProviderToolsParams = z.input<typeof listToolProviderToolsQuerySchema>;

/**
 * Response for listing tool provider tools.
 * Derived from server's listToolProviderToolsResponseSchema.
 */
export type ListToolProviderToolsResponse = z.infer<typeof listToolProviderToolsResponseSchema>;

/**
 * Response for getting tool provider tool schema.
 * Derived from server's getToolProviderToolSchemaResponseSchema.
 */
export type GetToolProviderToolSchemaResponse = z.infer<typeof getToolProviderToolSchemaResponseSchema>;

// ============================================================================
// Processor Provider Types
// ============================================================================

/**
 * Response for listing processor providers.
 * Derived from server's getProcessorProvidersResponseSchema.
 */
export type GetProcessorProvidersResponse = z.infer<typeof getProcessorProvidersResponseSchema>;

/**
 * Response for getting a single processor provider.
 * Derived from server's getProcessorProviderResponseSchema.
 */
export type GetProcessorProviderResponse = z.infer<typeof getProcessorProviderResponseSchema>;

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

/**
 * Dataset item response.
 * Derived from server's datasetItemResponseSchema with Date→string serialization.
 */
export type DatasetItem = JsonSerialized<z.infer<typeof datasetItemResponseSchema>>;

/**
 * Dataset record response.
 * Derived from server's datasetResponseSchema with Date→string serialization.
 */
export type DatasetRecord = JsonSerialized<z.infer<typeof datasetResponseSchema>>;

/**
 * Dataset experiment response.
 * Derived from server's experimentResponseSchema with Date→string serialization.
 */
export type DatasetExperiment = JsonSerialized<z.infer<typeof experimentResponseSchema>>;

/**
 * Dataset experiment result response.
 * Derived from server's experimentResultResponseSchema with Date→string serialization.
 */
export type DatasetExperimentResult = JsonSerialized<z.infer<typeof experimentResultResponseSchema>>;

/**
 * Parameters for creating a dataset.
 * Derived from server's createDatasetBodySchema.
 */
export type CreateDatasetParams = z.input<typeof createDatasetBodySchema>;

/**
 * Parameters for updating a dataset.
 * Includes datasetId for routing + body fields from server's updateDatasetBodySchema.
 */
export type UpdateDatasetParams = { datasetId: string } & z.input<typeof updateDatasetBodySchema>;

/**
 * Parameters for adding a dataset item.
 * Includes datasetId for routing + body fields from server's addItemBodySchema.
 */
export type AddDatasetItemParams = { datasetId: string } & z.input<typeof addItemBodySchema>;

/**
 * Parameters for updating a dataset item.
 * Includes datasetId and itemId for routing + body fields from server's updateItemBodySchema.
 */
export type UpdateDatasetItemParams = { datasetId: string; itemId: string } & z.input<typeof updateItemBodySchema>;

/**
 * Parameters for batch inserting dataset items.
 * Includes datasetId for routing + body fields from server's batchInsertItemsBodySchema.
 */
export type BatchInsertDatasetItemsParams = { datasetId: string } & z.input<typeof batchInsertItemsBodySchema>;

/**
 * Parameters for batch deleting dataset items.
 * Includes datasetId for routing + body fields from server's batchDeleteItemsBodySchema.
 */
export type BatchDeleteDatasetItemsParams = { datasetId: string } & z.input<typeof batchDeleteItemsBodySchema>;

/**
 * Parameters for triggering a dataset experiment.
 * Includes datasetId for routing + body fields from server's triggerExperimentBodySchema.
 */
export type TriggerDatasetExperimentParams = { datasetId: string } & z.input<typeof triggerExperimentBodySchema>;

/**
 * Parameters for comparing experiments.
 * Includes datasetId for routing + body fields from server's compareExperimentsBodySchema.
 */
export type CompareExperimentsParams = { datasetId: string } & z.input<typeof compareExperimentsBodySchema>;

/**
 * Dataset item version response.
 * Derived from server's itemVersionResponseSchema with Date→string serialization.
 */
export type DatasetItemVersionResponse = JsonSerialized<z.infer<typeof itemVersionResponseSchema>>;

/**
 * Dataset version response.
 * Derived from server's datasetVersionResponseSchema with Date→string serialization.
 */
export type DatasetVersionResponse = JsonSerialized<z.infer<typeof datasetVersionResponseSchema>>;

/**
 * Response for comparing experiments.
 * Derived from server's comparisonResponseSchema.
 */
export type CompareExperimentsResponse = z.infer<typeof comparisonResponseSchema>;

// ============================================================================
// Stored Prompt Block Types (derived from @mastra/server/schemas)
// ============================================================================

/**
 * Stored prompt block data returned from API.
 * Derived from server's storedPromptBlockSchema with Date→string serialization.
 */
export type StoredPromptBlockResponse = JsonSerialized<z.infer<typeof storedPromptBlockSchema>>;

/**
 * Parameters for listing stored prompt blocks.
 * Derived from server's listStoredPromptBlocksQuerySchema.
 */
export type ListStoredPromptBlocksParams = z.input<typeof listStoredPromptBlocksQuerySchema>;

/**
 * Response for listing stored prompt blocks.
 * Derived from server's listStoredPromptBlocksResponseSchema with Date→string serialization.
 */
export type ListStoredPromptBlocksResponse = JsonSerialized<z.infer<typeof listStoredPromptBlocksResponseSchema>>;

/**
 * Parameters for creating a stored prompt block.
 * Derived from server's createStoredPromptBlockBodySchema.
 */
export type CreateStoredPromptBlockParams = z.input<typeof createStoredPromptBlockBodySchema>;

/**
 * Parameters for updating a stored prompt block.
 * Derived from server's updateStoredPromptBlockBodySchema.
 */
export type UpdateStoredPromptBlockParams = z.input<typeof updateStoredPromptBlockBodySchema>;

/**
 * Response for deleting a stored prompt block.
 * Derived from server's deleteStoredPromptBlockResponseSchema.
 */
export type DeleteStoredPromptBlockResponse = z.infer<typeof deleteStoredPromptBlockResponseSchema>;

// ============================================================================
// Prompt Block Version Types (derived from @mastra/server/schemas)
// ============================================================================

/**
 * Prompt block version data returned from API.
 * Derived from server's promptBlockVersionSchema with Date→string serialization.
 */
export type PromptBlockVersionResponse = JsonSerialized<z.infer<typeof promptBlockVersionSchema>>;

/**
 * Parameters for listing prompt block versions.
 * Derived from server's listPromptBlockVersionsQuerySchema.
 */
export type ListPromptBlockVersionsParams = z.input<typeof listPromptBlockVersionsQuerySchema>;

/**
 * Response for listing prompt block versions.
 * Uses listPromptBlockVersionsResponseSchema with Date→string serialization.
 */
export type ListPromptBlockVersionsResponse = JsonSerialized<z.infer<typeof listPromptBlockVersionsResponseSchema>>;

/**
 * Parameters for creating a prompt block version.
 * Derived from server's createPromptBlockVersionBodySchema.
 */
export type CreatePromptBlockVersionParams = z.input<typeof createPromptBlockVersionBodySchema>;

/**
 * Response for activating a prompt block version.
 * Derived from server's activatePromptBlockVersionResponseSchema.
 */
export type ActivatePromptBlockVersionResponse = z.infer<typeof activatePromptBlockVersionResponseSchema>;

/**
 * Response for deleting a prompt block version.
 * Derived from server's deletePromptBlockVersionResponseSchema.
 */
export type DeletePromptBlockVersionResponse = z.infer<typeof deletePromptBlockVersionResponseSchema>;
