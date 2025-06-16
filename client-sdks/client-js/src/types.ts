import type {
  MastraMessageV1,
  AiMessageType,
  CoreMessage,
  QueryResult,
  StorageThreadType,
  WorkflowRuns,
  WorkflowRun,
  LegacyWorkflowRuns,
} from '@mastra/core';
import type { AgentGenerateOptions, AgentStreamOptions, ToolsInput } from '@mastra/core/agent';
import type { BaseLogMessage, LogLevel } from '@mastra/core/logger';

import type { MCPToolType, ServerInfo } from '@mastra/core/mcp';
import type { RuntimeContext } from '@mastra/core/runtime-context';
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
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  stream?: boolean;
  signal?: AbortSignal;
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
  messages: string | string[] | CoreMessage[] | AiMessageType[];
  output?: T;
  experimental_output?: T;
  runtimeContext?: RuntimeContext | Record<string, any>;
  clientTools?: ToolsInput;
} & WithoutMethods<Omit<AgentGenerateOptions<T>, 'output' | 'experimental_output' | 'runtimeContext' | 'clientTools'>>;

export type StreamParams<T extends JSONSchema7 | ZodSchema | undefined = undefined> = {
  messages: string | string[] | CoreMessage[] | AiMessageType[];
  output?: T;
  experimental_output?: T;
  runtimeContext?: RuntimeContext | Record<string, any>;
  clientTools?: ToolsInput;
} & WithoutMethods<Omit<AgentStreamOptions<T>, 'output' | 'experimental_output' | 'runtimeContext' | 'clientTools'>>;

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
  messages: MastraMessageV1[];
  agentId: string;
}

export type SaveMessageToMemoryResponse = MastraMessageV1[];

export interface CreateMemoryThreadParams {
  title?: string;
  metadata?: Record<string, any>;
  resourceId: string;
  threadId?: string;
  agentId: string;
}

export type CreateMemoryThreadResponse = StorageThreadType;

export interface GetMemoryThreadParams {
  resourceId: string;
  agentId: string;
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

export interface GetMemoryThreadMessagesResponse {
  messages: CoreMessage[];
  uiMessages: AiMessageType[];
}

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
