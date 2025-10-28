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
import type { CoreMessage } from '@mastra/core/llm';
import type { BaseLogMessage, LogLevel } from '@mastra/core/logger';
import type { MCPToolType, ServerInfo } from '@mastra/core/mcp';
import type {
  AiMessageType,
  MastraMessageV1,
  MastraMessageV2,
  MemoryConfig,
  StorageThreadType,
} from '@mastra/core/memory';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import type { MastraScorerEntry, ScoreRowData } from '@mastra/core/scores';

import type {
  AITraceRecord,
  AISpanRecord,
  StorageGetMessagesArg,
  PaginationInfo,
  WorkflowRun,
  WorkflowRuns,
  StorageListMessagesInput,
  StorageListMessagesOutput,
} from '@mastra/core/storage';
import type { OutputSchema } from '@mastra/core/stream';
import type { QueryResult } from '@mastra/core/vector';
import type { Workflow, WatchEvent, WorkflowResult } from '@mastra/core/workflows';

import type { UIMessage } from 'ai';
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
} & MultiPrimitiveExecutionOptions;
export interface GetAgentResponse {
  name: string;
  instructions: AgentInstructions;
  tools: Record<string, GetToolResponse>;
  workflows: Record<string, GetWorkflowResponse>;
  agents: Record<string, { id: string; name: string }>;
  provider: string;
  modelId: string;
  modelVersion: string;
  defaultGenerateOptions: WithoutMethods<AgentGenerateOptions>;
  defaultStreamOptions: WithoutMethods<AgentStreamOptions>;
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
}

export type GenerateLegacyParams<T extends JSONSchema7 | ZodSchema | undefined = undefined> = {
  messages: string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[];
  output?: T;
  experimental_output?: T;
  runtimeContext?: RuntimeContext | Record<string, any>;
  clientTools?: ToolsInput;
} & WithoutMethods<
  Omit<AgentGenerateOptions<T>, 'output' | 'experimental_output' | 'runtimeContext' | 'clientTools' | 'abortSignal'>
>;

export type StreamLegacyParams<T extends JSONSchema7 | ZodSchema | undefined = undefined> = {
  messages: string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[];
  output?: T;
  experimental_output?: T;
  runtimeContext?: RuntimeContext | Record<string, any>;
  clientTools?: ToolsInput;
} & WithoutMethods<
  Omit<AgentStreamOptions<T>, 'output' | 'experimental_output' | 'runtimeContext' | 'clientTools' | 'abortSignal'>
>;

export type StreamParams<OUTPUT extends OutputSchema = undefined> = {
  messages: MessageListInput;
  structuredOutput?: SerializableStructuredOutputOptions<OUTPUT>;
  runtimeContext?: RuntimeContext | Record<string, any>;
  clientTools?: ToolsInput;
} & WithoutMethods<
  Omit<AgentExecutionOptions<OUTPUT>, 'runtimeContext' | 'clientTools' | 'options' | 'abortSignal' | 'structuredOutput'>
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

export interface GetEvalsByAgentIdResponse extends GetAgentResponse {
  evals: any[];
  instructions: string;
  name: string;
  id: string;
}

export interface GetToolResponse {
  id: string;
  description: string;
  inputSchema: string;
  outputSchema: string;
}

export interface GetWorkflowRunsParams {
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
  resourceId?: string;
}

export type GetWorkflowRunsResponse = WorkflowRuns;

export type GetWorkflowRunByIdResponse = WorkflowRun;

export type GetWorkflowRunExecutionResultResponse = WatchEvent['payload']['workflowState'];

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
      isWorkflow: boolean;
    };
  };
  stepGraph: Workflow['serializedStepGraph'];
  inputSchema: string;
  outputSchema: string;
}

export type WorkflowWatchResult = WatchEvent & { runId: string };

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
  messages: (MastraMessageV1 | MastraMessageV2)[];
  agentId: string;
  runtimeContext?: RuntimeContext | Record<string, any>;
}

export interface SaveNetworkMessageToMemoryParams {
  messages: (MastraMessageV1 | MastraMessageV2)[];
  networkId: string;
}

export type SaveMessageToMemoryResponse = (MastraMessageV1 | MastraMessageV2)[];

export interface CreateMemoryThreadParams {
  title?: string;
  metadata?: Record<string, any>;
  resourceId: string;
  threadId?: string;
  agentId: string;
  runtimeContext?: RuntimeContext | Record<string, any>;
}

export interface CreateNetworkMemoryThreadParams {
  title?: string;
  metadata?: Record<string, any>;
  resourceId: string;
  threadId?: string;
  networkId: string;
}

export type CreateMemoryThreadResponse = StorageThreadType;

export interface GetMemoryThreadParams {
  resourceId: string;
  agentId: string;
  runtimeContext?: RuntimeContext | Record<string, any>;
}

export interface GetMemoryConfigParams {
  agentId: string;
  runtimeContext?: RuntimeContext | Record<string, any>;
}

export type GetMemoryConfigResponse = { config: MemoryConfig };

export interface GetNetworkMemoryThreadParams {
  resourceId: string;
  networkId: string;
}

export type GetMemoryThreadResponse = StorageThreadType[];

export interface UpdateMemoryThreadParams {
  title: string;
  metadata: Record<string, any>;
  resourceId: string;
  runtimeContext?: RuntimeContext | Record<string, any>;
}

export interface GetMemoryThreadMessagesParams {
  /**
   * Limit the number of messages to retrieve (default: 40)
   */
  limit?: number;
}

export type GetMemoryThreadMessagesPaginatedParams = Omit<StorageGetMessagesArg, 'threadConfig' | 'threadId'>;

export interface GetMemoryThreadMessagesResponse {
  messages: CoreMessage[];
  legacyMessages: AiMessageType[];
  uiMessages: UIMessage[];
}

export type GetMemoryThreadMessagesPaginatedResponse = PaginationInfo & {
  messages: MastraMessageV1[] | MastraMessageV2[];
};

/**
 * Parameters for listing messages with advanced filtering options.
 *
 * @property limit - Number of messages to retrieve. Use `false` to retrieve ALL messages (⚠️ use with caution for large datasets).
 *                   Defaults to 40 if not specified.
 * @property offset - Number of messages to skip before starting to return results. Defaults to 0.
 *                    Use with `limit` for pagination: page 2 with limit 20 = offset 20.
 * @property filter - Filtering options for messages
 * @property filter.dateRange - Filter messages by creation date range
 * @property filter.dateRange.start - Include only messages created on or after this date
 * @property filter.dateRange.end - Include only messages created on or before this date
 * @property include - Array of message IDs with context (previous/next messages) to include in results
 * @property format - Message format version ('v1' or 'v2')
 * @property resourceId - Optional resource ID for filtering messages
 */
export type ListMemoryThreadMessagesParams = Omit<StorageListMessagesInput, 'threadId'>;

export type ListMemoryThreadMessagesResponse = StorageListMessagesOutput;

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
  runtimeContext?: RuntimeContext | Record<string, any>;
}

export interface LoopStreamVNextNetworkParams {
  message: string;
  threadId?: string;
  resourceId?: string;
  maxIterations?: number;
  runtimeContext?: RuntimeContext | Record<string, any>;
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

export type ClientScoreRowData = Omit<ScoreRowData, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
} & { spanId?: string };

// Scores-related types
export interface GetScoresByRunIdParams {
  runId: string;
  page?: number;
  perPage?: number;
}

export interface GetScoresByScorerIdParams {
  scorerId: string;
  entityId?: string;
  entityType?: string;
  page?: number;
  perPage?: number;
}

export interface GetScoresByEntityIdParams {
  entityId: string;
  entityType: string;
  page?: number;
  perPage?: number;
}

export interface GetScoresBySpanParams {
  traceId: string;
  spanId: string;
  page?: number;
  perPage?: number;
}

export interface SaveScoreParams {
  score: Omit<ScoreRowData, 'id' | 'createdAt' | 'updatedAt'>;
}

export interface GetScoresResponse {
  pagination: {
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  };
  scores: ClientScoreRowData[];
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

export interface GetAITraceResponse {
  trace: AITraceRecord;
}

export interface GetAITracesResponse {
  spans: AISpanRecord[];
  pagination: PaginationInfo;
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

export interface GetAgentsModelProvidersResponse {
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
