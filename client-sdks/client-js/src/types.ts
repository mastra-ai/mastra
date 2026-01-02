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

import type { PaginationInfo, WorkflowRun, WorkflowRuns, StorageListMessagesInput } from '@mastra/core/storage';
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

export type GetWorkflowRunByIdResponse = WorkflowRun;

export type GetWorkflowRunExecutionResultResponse = Partial<WorkflowState>;

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
  agentId: string;
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
  inputProcessors?: Record<string, unknown>[];
  outputProcessors?: Record<string, unknown>[];
  memory?: string;
  scorers?: Record<string, StoredAgentScorerConfig>;
  metadata?: Record<string, unknown>;
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
  inputProcessors?: Record<string, unknown>[];
  outputProcessors?: Record<string, unknown>[];
  memory?: string;
  scorers?: Record<string, StoredAgentScorerConfig>;
  metadata?: Record<string, unknown>;
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
  inputProcessors?: Record<string, unknown>[];
  outputProcessors?: Record<string, unknown>[];
  memory?: string;
  scorers?: Record<string, StoredAgentScorerConfig>;
  metadata?: Record<string, unknown>;
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
// Knowledge Types
// ============================================================================

/**
 * Knowledge namespace metadata
 */
export interface KnowledgeNamespace {
  namespace: string;
  description?: string;
  artifactCount: number;
  createdAt: string;
  updatedAt: string;
  hasBM25: boolean;
  hasVector: boolean;
}

/**
 * Response for listing knowledge namespaces
 */
export interface ListKnowledgeNamespacesResponse {
  namespaces: KnowledgeNamespace[];
}

/**
 * Parameters for creating a knowledge namespace
 */
export interface CreateKnowledgeNamespaceParams {
  namespace: string;
  description?: string;
  enableBM25?: boolean;
  vectorConfig?: {
    vectorStoreName: string;
    indexName: string;
    embedderName?: string;
  };
}

/**
 * Knowledge artifact metadata
 */
export interface KnowledgeArtifact {
  key: string;
  type: 'text' | 'file' | 'image';
  size?: number;
  mimeType?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Response for listing knowledge artifacts
 */
export interface ListKnowledgeArtifactsResponse {
  artifacts: KnowledgeArtifact[];
  namespace: string;
}

/**
 * Parameters for listing knowledge artifacts
 */
export interface ListKnowledgeArtifactsParams {
  prefix?: string;
}

/**
 * Response for getting artifact content
 */
export interface GetKnowledgeArtifactResponse {
  key: string;
  content: string;
  type: 'text' | 'file' | 'image';
  metadata?: Record<string, unknown>;
}

/**
 * Parameters for adding a text artifact
 */
export interface AddKnowledgeArtifactParams {
  key: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Response for adding an artifact
 */
export interface AddKnowledgeArtifactResponse {
  success: boolean;
  key: string;
}

/**
 * Response for deleting an artifact
 */
export interface DeleteKnowledgeArtifactResponse {
  success: boolean;
  key: string;
}

/**
 * Knowledge search result
 */
export interface KnowledgeSearchResult {
  key: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
  scoreDetails?: {
    vector?: number;
    bm25?: number;
  };
}

/**
 * Parameters for searching knowledge
 */
export interface SearchKnowledgeParams {
  query: string;
  topK?: number;
  minScore?: number;
  mode?: 'vector' | 'bm25' | 'hybrid';
  vectorWeight?: number;
}

/**
 * Response for searching knowledge
 */
export interface SearchKnowledgeResponse {
  results: KnowledgeSearchResult[];
  query: string;
  mode: 'vector' | 'bm25' | 'hybrid';
  namespace: string;
}

/**
 * Response for deleting a namespace
 */
export interface DeleteKnowledgeNamespaceResponse {
  success: boolean;
  namespace: string;
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
  allowedTools?: string[];
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
