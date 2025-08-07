import type {
  MastraMessageV1,
  AiMessageType,
  CoreMessage,
  QueryResult,
  StorageThreadType,
  WorkflowRuns,
  WorkflowRun,
  LegacyWorkflowRuns,
  StorageGetMessagesArg,
  PaginationInfo,
  MastraMessageV2,
} from '@mastra/core';
import type { AgentGenerateOptions, AgentStreamOptions, ToolsInput, UIMessageWithMetadata } from '@mastra/core/agent';
import type { BaseLogMessage, LogLevel } from '@mastra/core/logger';

import type { MCPToolType, ServerInfo } from '@mastra/core/mcp';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import type { MastraScorer, MastraScorerEntry, ScoreRowData } from '@mastra/core/scores';
import type { Workflow, WatchEvent, WorkflowResult } from '@mastra/core/workflows';
import type {
  StepAction,
  StepGraph,
  LegacyWorkflowRunResult as CoreLegacyWorkflowRunResult,
} from '@mastra/core/workflows/legacy';
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
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  stream?: boolean;
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

export interface GetAgentResponse {
  name: string;
  instructions: string;
  tools: Record<string, GetToolResponse>;
  workflows: Record<string, GetWorkflowResponse>;
  provider: string;
  modelId: string;
  defaultGenerateOptions: WithoutMethods<AgentGenerateOptions>;
  defaultStreamOptions: WithoutMethods<AgentStreamOptions>;
}

export type GenerateParams<T extends JSONSchema7 | ZodSchema | undefined = undefined> = {
  messages: string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[];
  output?: T;
  experimental_output?: T;
  runtimeContext?: RuntimeContext | Record<string, any>;
  clientTools?: ToolsInput;
} & WithoutMethods<
  Omit<AgentGenerateOptions<T>, 'output' | 'experimental_output' | 'runtimeContext' | 'clientTools' | 'abortSignal'>
>;

export type StreamParams<T extends JSONSchema7 | ZodSchema | undefined = undefined> = {
  messages: string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[];
  output?: T;
  experimental_output?: T;
  runtimeContext?: RuntimeContext | Record<string, any>;
  clientTools?: ToolsInput;
} & WithoutMethods<
  Omit<AgentStreamOptions<T>, 'output' | 'experimental_output' | 'runtimeContext' | 'clientTools' | 'abortSignal'>
>;

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

export interface GetLegacyWorkflowResponse {
  name: string;
  triggerSchema: string;
  steps: Record<string, StepAction<any, any, any, any>>;
  stepGraph: StepGraph;
  stepSubscriberGraph: Record<string, StepGraph>;
  workflowId?: string;
}

export interface GetWorkflowRunsParams {
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
  resourceId?: string;
}

export type GetLegacyWorkflowRunsResponse = LegacyWorkflowRuns;

export type GetWorkflowRunsResponse = WorkflowRuns;

export type GetWorkflowRunByIdResponse = WorkflowRun;

export type GetWorkflowRunExecutionResultResponse = WatchEvent['payload']['workflowState'];

export type LegacyWorkflowRunResult = {
  activePaths: Record<string, { status: string; suspendPayload?: any; stepPath: string[] }>;
  results: CoreLegacyWorkflowRunResult<any, any, any>['results'];
  timestamp: number;
  runId: string;
};

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

export type WorkflowRunResult = WorkflowResult<any, any>;
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
}

export interface GetNetworkMemoryThreadParams {
  resourceId: string;
  networkId: string;
}

export type GetMemoryThreadResponse = StorageThreadType[];

export interface UpdateMemoryThreadParams {
  title: string;
  metadata: Record<string, any>;
  resourceId: string;
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
  uiMessages: AiMessageType[];
}

export type GetMemoryThreadMessagesPaginatedResponse = PaginationInfo & {
  messages: MastraMessageV1[] | MastraMessageV2[];
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

type SpanStatus = {
  code: number;
};

type SpanOther = {
  droppedAttributesCount: number;
  droppedEventsCount: number;
  droppedLinksCount: number;
};

type SpanEventAttributes = {
  key: string;
  value: { [key: string]: string | number | boolean | null };
};

type SpanEvent = {
  attributes: SpanEventAttributes[];
  name: string;
  timeUnixNano: string;
  droppedAttributesCount: number;
};

type Span = {
  id: string;
  parentSpanId: string | null;
  traceId: string;
  name: string;
  scope: string;
  kind: number;
  status: SpanStatus;
  events: SpanEvent[];
  links: any[];
  attributes: Record<string, string | number | boolean | null>;
  startTime: number;
  endTime: number;
  duration: number;
  other: SpanOther;
  createdAt: string;
};

export interface GetTelemetryResponse {
  traces: Span[];
}

export interface GetTelemetryParams {
  name?: string;
  scope?: string;
  page?: number;
  perPage?: number;
  attribute?: Record<string, string>;
  fromDate?: Date;
  toDate?: Date;
}

export interface GetNetworkResponse {
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
  state?: Record<string, any>;
}

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
  steps: WorkflowResult<any, any>['steps'];
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
};

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
  workflowIds: string[];
};

export interface GetScorersResponse {
  scorers: Array<GetScorerResponse>;
}
