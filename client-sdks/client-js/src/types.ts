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

import type { PaginationInfo, WorkflowRuns, StorageListMessagesInput } from '@mastra/core/storage';
import type { OutputSchema } from '@mastra/core/stream';

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

export type NetworkStreamParams = {
  messages: MessageListInput;
  tracingOptions?: TracingOptions;
} & MultiPrimitiveExecutionOptions;

export interface GetAgentResponse {
  id: string;
  name: string;
  description?: string;
  instructions: AgentInstructions;
  tools: Record<string, GetToolResponse>;
  workflows: Record<string, GetWorkflowResponse>;
  agents: Record<string, { id: string; name: string }>;
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
  defaultOptions: WithoutMethods<AgentExecutionOptions>;
  defaultGenerateOptionsLegacy: WithoutMethods<AgentGenerateOptions>;
  defaultStreamOptionsLegacy: WithoutMethods<AgentStreamOptions>;
  source?: 'code' | 'stored';
  activeVersionId?: string;
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

export type StreamParams<OUTPUT extends OutputSchema = undefined> = {
  messages: MessageListInput;
  tracingOptions?: TracingOptions;
  structuredOutput?: SerializableStructuredOutputOptions<OUTPUT>;
  requestContext?: RequestContext | Record<string, any>;
  clientTools?: ToolsInput;
} & WithoutMethods<
  Omit<AgentExecutionOptions<OUTPUT>, 'requestContext' | 'clientTools' | 'options' | 'abortSignal' | 'structuredOutput'>
>;

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
  /** Tool name */
  name?: string;
  /** Source of the tool - 'code' for code-defined tools, integration name for integration tools */
  source?: string;
  /** Provider name for integration tools */
  provider?: string;
  /** Toolkit slug for integration tools */
  toolkit?: string;
  /** Integration ID for integration tools */
  integrationId?: string;
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
    };
  };
  stepGraph: Workflow['serializedStepGraph'];
  inputSchema: string;
  outputSchema: string;
  stateSchema: string;
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
  resourceId: string;
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
 * Scorer config for stored agents
 */
export interface StoredAgentScorerConfig {
  sampling?: {
    type: 'ratio' | 'count';
    rate?: number;
    count?: number;
  };
}

/**
 * Stored agent data returned from API
 */
export interface StoredAgentResponse {
  id: string;
  name: string;
  description?: string;
  instructions: string;
  model: Record<string, unknown>;
  tools?: string[];
  defaultOptions?: Record<string, unknown>;
  workflows?: string[];
  agents?: string[];
  integrations?: string[];
  integrationTools?: string[];
  inputProcessors?: Record<string, unknown>[];
  outputProcessors?: Record<string, unknown>[];
  memory?: { id: string };
  scorers?: Record<string, StoredAgentScorerConfig>;
  metadata?: Record<string, unknown>;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
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
  ownerId?: string;
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
 * Parameters for creating a stored agent
 */
export interface CreateStoredAgentParams {
  id: string;
  name: string;
  description?: string;
  instructions: string;
  model: Record<string, unknown>;
  tools?: string[];
  defaultOptions?: Record<string, unknown>;
  workflows?: string[];
  agents?: string[];
  integrations?: string[];
  integrationTools?: string[];
  inputProcessors?: Record<string, unknown>[];
  outputProcessors?: Record<string, unknown>[];
  memory?: { id: string };
  scorers?: Record<string, StoredAgentScorerConfig>;
  metadata?: Record<string, unknown>;
  ownerId?: string;
}

/**
 * Parameters for updating a stored agent
 */
export interface UpdateStoredAgentParams {
  name?: string;
  description?: string;
  instructions?: string;
  model?: Record<string, unknown>;
  tools?: string[];
  defaultOptions?: Record<string, unknown>;
  workflows?: string[];
  agents?: string[];
  integrations?: string[];
  integrationTools?: string[];
  inputProcessors?: Record<string, unknown>[];
  outputProcessors?: Record<string, unknown>[];
  memory?: { id: string };
  scorers?: Record<string, StoredAgentScorerConfig>;
  metadata?: Record<string, unknown>;
  ownerId?: string;
}

/**
 * Response for deleting a stored agent
 */
export interface DeleteStoredAgentResponse {
  success: boolean;
  message: string;
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
// Agent Version Types
// ============================================================================

/**
 * Response for a single agent version
 */
export interface AgentVersionResponse {
  id: string;
  agentId: string;
  versionNumber: number;
  name?: string;
  snapshot: StoredAgentResponse;
  changedFields?: string[];
  changeMessage?: string;
  createdAt: string;
}

/**
 * Parameters for listing agent versions
 */
export interface ListAgentVersionsParams {
  page?: number;
  perPage?: number;
  orderBy?: 'versionNumber' | 'createdAt';
  orderDirection?: 'ASC' | 'DESC';
}

/**
 * Response for listing agent versions
 */
export interface ListAgentVersionsResponse {
  versions: AgentVersionResponse[];
  total: number;
  page: number;
  perPage: number | false;
  hasMore: boolean;
}

/**
 * Parameters for creating an agent version
 */
export interface CreateAgentVersionParams {
  name?: string;
  changeMessage?: string;
}

/**
 * Represents a single field difference between two versions
 */
export interface AgentVersionDiff {
  field: string;
  previousValue: unknown;
  currentValue: unknown;
}

/**
 * Response for comparing two agent versions
 */
export interface CompareVersionsResponse {
  diffs: AgentVersionDiff[];
  fromVersion: AgentVersionResponse;
  toVersion: AgentVersionResponse;
}

// ============================================================================
// Memory Config Types
// ============================================================================

export interface MemoryConfigItem {
  id: string;
  name?: string;
}

export interface ListMemoryConfigsResponse {
  configs: MemoryConfigItem[];
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
// Integration Types
// ============================================================================

/**
 * Integration provider type
 */
export type IntegrationProvider = 'composio' | 'arcade' | 'mcp' | 'smithery';

/**
 * MCP-specific integration metadata
 */
export interface MCPIntegrationMetadata {
  /** MCP server URL (HTTP/SSE endpoint) */
  url: string;
  /** Optional authentication headers */
  headers?: Record<string, string>;
  /** Transport type hint */
  transport?: 'http' | 'sse';
  /** Server info cached after successful connection */
  serverInfo?: {
    name?: string;
    version?: string;
  };
}

/**
 * Integration configuration
 */
export interface IntegrationConfig {
  id: string;
  provider: IntegrationProvider;
  name: string;
  enabled: boolean;
  selectedToolkits: string[];
  selectedTools?: string[];
  metadata?: Record<string, unknown>;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
  /** Actual count of cached tools for this integration */
  toolCount?: number;
  /** Names of toolkits in this integration (e.g., ["hackernews"]) */
  toolkitNames?: string[];
}

// ============================================================================
// Workflow Definitions Types
// ============================================================================

/**
 * Workflow definition data returned from API
 */
export interface WorkflowDefinitionResponse {
  id: string;
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  stateSchema?: Record<string, unknown>;
  stepGraph: unknown[];
  steps: Record<string, unknown>;
  retryConfig?: { attempts?: number; delay?: number };
  ownerId?: string;
  activeVersionId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Cached tool definition
 */
export interface CachedTool {
  id: string;
  integrationId: string;
  provider: IntegrationProvider;
  toolkitSlug: string;
  toolSlug: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  rawDefinition?: Record<string, unknown>;
  cachedAt: string;
  updatedAt: string;
}

/**
 * Provider connection status
 */
export interface ProviderStatus {
  provider: IntegrationProvider;
  connected: boolean;
  name: string;
  description: string;
  icon?: string;
}

/**
 * Toolkit from provider API
 */
export interface ProviderToolkit {
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  category?: string;
  toolCount?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Parameters for creating a workflow definition
 */
export interface CreateWorkflowDefinitionInput {
  id: string;
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  stateSchema?: Record<string, unknown>;
  stepGraph: unknown[];
  steps: Record<string, unknown>;
  retryConfig?: { attempts?: number; delay?: number };
  metadata?: Record<string, unknown>;
}

/**
 * Tool from provider API
 */
export interface ProviderTool {
  slug: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  toolkit?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Parameters for updating a workflow definition
 */
export interface UpdateWorkflowDefinitionInput {
  name?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  stateSchema?: Record<string, unknown>;
  stepGraph?: unknown[];
  steps?: Record<string, unknown>;
  retryConfig?: { attempts?: number; delay?: number };
  metadata?: Record<string, unknown>;
}

/**
 * Parameters for listing integrations
 */
export interface ListIntegrationsParams {
  page?: number;
  perPage?: number;
  orderBy?: {
    field?: 'createdAt' | 'updatedAt';
    direction?: 'ASC' | 'DESC';
  };
  ownerId?: string;
  provider?: IntegrationProvider;
  enabled?: boolean;
}

/**
 * Response for listing integrations
 */
export interface ListIntegrationsResponse {
  integrations: IntegrationConfig[];
  total: number;
  page: number;
  perPage: number | false;
  hasMore: boolean;
}

/**
 * Parameters for listing workflow definitions
 */
export interface ListWorkflowDefinitionsParams {
  page?: number;
  perPage?: number;
  ownerId?: string;
}

/**
 * Response for listing workflow definitions
 */
export interface ListWorkflowDefinitionsResponse {
  definitions: WorkflowDefinitionResponse[];
  total: number;
  page: number;
  perPage: number | false;
  hasMore: boolean;
}

/**
 * Parameters for creating an integration
 */
export interface CreateIntegrationParams {
  id?: string;
  name: string;
  provider: IntegrationProvider;
  enabled?: boolean;
  selectedToolkits: string[];
  selectedTools?: string[];
  metadata?: Record<string, unknown>;
  ownerId?: string;
}

/**
 * Parameters for updating an integration
 */
export interface UpdateIntegrationParams {
  name?: string;
  provider?: IntegrationProvider;
  enabled?: boolean;
  selectedToolkits?: string[];
  selectedTools?: string[];
  metadata?: Record<string, unknown>;
  ownerId?: string;
}

/**
 * Response for deleting an integration
 */
export interface DeleteIntegrationResponse {
  success: boolean;
  message: string;
}

/**
 * Response for listing providers
 */
export interface ListProvidersResponse {
  providers: ProviderStatus[];
}

/**
 * Parameters for listing toolkits from a provider
 */
export interface ListProviderToolkitsParams {
  search?: string;
  category?: string;
  limit?: number;
  cursor?: string;
}

/**
 * Response for listing toolkits from a provider
 */
export interface ListProviderToolkitsResponse {
  toolkits: ProviderToolkit[];
  nextCursor?: string;
  hasMore: boolean;
}

/**
 * Workflow definition version data returned from API
 */
export interface WorkflowDefinitionVersionResponse {
  id: string;
  workflowDefinitionId: string;
  versionNumber: number;
  name?: string;
  snapshot: WorkflowDefinitionResponse;
  changedFields?: string[];
  changeMessage?: string;
  createdAt: string;
}

/**
 * Parameters for listing workflow definition versions
 */
export interface ListWorkflowDefinitionVersionsParams {
  page?: number;
  perPage?: number;
}

/**
 * Response for listing workflow definition versions
 */
export interface ListWorkflowDefinitionVersionsResponse {
  versions: WorkflowDefinitionVersionResponse[];
  total: number;
  page: number;
  perPage: number | false;
  hasMore: boolean;
}

/**
 * Parameters for listing tools from a provider
 */
export interface ListProviderToolsParams {
  toolkitSlug?: string;
  toolkitSlugs?: string;
  search?: string;
  limit?: number;
  cursor?: string;
  // MCP HTTP transport parameters
  /** MCP server URL (required for MCP HTTP transport) */
  url?: string;
  /** MCP server auth headers as JSON string (for MCP HTTP transport) */
  headers?: string;
  // MCP Stdio transport parameters
  /** Command to execute (required for MCP Stdio transport) */
  command?: string;
  /** Arguments as JSON array string (for MCP Stdio transport) */
  args?: string;
  /** Environment variables as JSON object string (for MCP Stdio transport) */
  env?: string;
}

/**
 * Response for listing tools from a provider
 */
export interface ListProviderToolsResponse {
  tools: ProviderTool[];
  nextCursor?: string;
  hasMore: boolean;
}

/**
 * Response for refreshing integration tools
 */
export interface RefreshIntegrationResponse {
  success: boolean;
  message: string;
  toolsUpdated: number;
}

/**
 * Parameters for validating MCP connection
 *
 * Supports two transport types:
 * - HTTP: Remote MCP servers accessed via URL
 * - Stdio: Local MCP servers spawned as subprocesses
 */
export interface ValidateMCPParams {
  /** Transport type: 'http' for remote servers, 'stdio' for local subprocess */
  transport: 'http' | 'stdio';

  // HTTP transport config (when transport === 'http')
  /** MCP server URL (HTTP/SSE endpoint) - required for HTTP transport */
  url?: string;
  /** Optional authentication headers for HTTP transport */
  headers?: Record<string, string>;

  // Stdio transport config (when transport === 'stdio')
  /** Command to execute (e.g., 'npx', 'node', 'python') - required for stdio transport */
  command?: string;
  /** Arguments to pass to the command */
  args?: string[];
  /** Environment variables for the subprocess */
  env?: Record<string, string>;
}

/**
 * Response for MCP validation
 */
export interface ValidateMCPResponse {
  /** Whether the connection is valid */
  valid: boolean;
  /** Number of tools available on the server */
  toolCount: number;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Parameters for creating a workflow definition version
 */
export interface CreateWorkflowDefinitionVersionInput {
  name?: string;
  changeMessage?: string;
}

/**
 * Response for comparing workflow definition versions
 */
export interface CompareWorkflowDefinitionVersionsResponse {
  version1: WorkflowDefinitionVersionResponse;
  version2: WorkflowDefinitionVersionResponse;
  changedFields: string[];
}

// ============================================================================
// Smithery Registry Types
// ============================================================================

/**
 * Smithery server from the registry
 */
export interface SmitheryServer {
  /** Unique qualified name (e.g., "@anthropics/mcp-server-filesystem") */
  qualifiedName: string;
  /** Human-readable display name */
  displayName: string;
  /** Server description */
  description?: string;
  /** Icon URL */
  iconUrl?: string;
  /** Whether the server is verified */
  verified?: boolean;
  /** Usage count */
  useCount?: number;
  /** Whether this is a remote (HTTP) server */
  remote?: boolean;
  /** Repository URL */
  homepage?: string;
  /** Security information */
  security?: {
    scanPassed?: boolean;
  };
  /** Connection information (available after fetching full server details) */
  connections?: SmitheryConnectionInfo[];
  /** Deployment URL for remote servers */
  deploymentUrl?: string;
}

/**
 * Connection info from Smithery API
 */
export interface SmitheryConnectionInfo {
  /** Connection type */
  type: 'stdio' | 'sse' | 'websocket';
  /** URL for remote connections */
  url?: string;
  /** Configuration schema */
  configSchema?: Record<string, unknown>;
  /** Command for stdio connections */
  command?: string;
  /** Arguments for stdio connections */
  args?: string[];
  /** Environment variables for stdio connections */
  env?: Record<string, string>;
}

/**
 * Smithery server connection details (normalized for MCP transport)
 *
 * Note: Smithery API returns 'sse' or 'websocket' types which are
 * normalized to 'http' since they're all URL-based connections.
 */
export interface SmitheryServerConnection {
  /** Transport type (normalized: sse/websocket -> http) */
  type: 'http' | 'stdio';

  // HTTP transport (includes SSE/WebSocket)
  url?: string;
  configSchema?: Record<string, unknown>;

  // Stdio transport
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * Parameters for searching Smithery servers
 */
export interface SearchSmitheryServersParams {
  /** Search query */
  q?: string;
  /** Page number (1-indexed) */
  page?: number;
  /** Results per page */
  pageSize?: number;
}

/**
 * Response for searching Smithery servers
 */
export interface SearchSmitheryServersResponse {
  servers: SmitheryServer[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalPages: number;
    totalCount: number;
  };
}

/**
 * Response for getting Smithery server details
 */
export interface GetSmitheryServerResponse extends SmitheryServer {
  connection?: SmitheryServerConnection;
}

/**
 * Smithery-specific integration metadata
 */
export interface SmitheryIntegrationMetadata {
  /** Smithery server qualified name */
  smitheryQualifiedName: string;
  /** Display name from Smithery registry */
  smitheryDisplayName?: string;
  /** Whether the server is verified on Smithery */
  verified?: boolean;

  /** MCP connection details */
  transport: 'http' | 'stdio';

  // HTTP transport config
  url?: string;
  headers?: Record<string, string>;

  // Stdio transport config
  command?: string;
  args?: string[];
  env?: Record<string, string>;

  /** Server info cached after successful connection */
  serverInfo?: {
    name?: string;
    version?: string;
  };
}
