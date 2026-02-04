/**
 * Scope for memory storage
 * - "user": Cross-project preferences, stored per user
 * - "project": Project-specific knowledge
 */
export type MemoryScope = 'user' | 'project';

/**
 * Types of memories that can be stored
 */
export type MemoryType =
  | 'project-config'
  | 'architecture'
  | 'error-solution'
  | 'preference'
  | 'learned-pattern'
  | 'conversation';

/**
 * Observational Memory record from Mastra
 */
export interface ObservationalMemoryRecord {
  id: string;
  scope: 'thread' | 'resource';
  resourceId: string;
  threadId: string | null;
  activeObservations: string;
  bufferedObservations?: string;
  bufferedReflection?: string;
  originType: 'initial' | 'observation' | 'reflection';
  generationCount: number;
  lastObservedAt?: Date;
  totalTokensObserved: number;
  observationTokenCount: number;
  pendingMessageTokens: number;
  isObserving: boolean;
  isReflecting: boolean;
  config: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Thread from Mastra memory
 */
export interface Thread {
  id: string;
  title?: string;
  resourceId: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Message from Mastra memory
 */
export interface Message {
  id: string;
  role: string;
  content: string | MessageContent;
  createdAt: Date;
  threadId?: string;
  resourceId?: string;
}

/**
 * Structured message content
 */
export interface MessageContent {
  parts: Array<{
    type: string;
    text?: string;
    [key: string]: unknown;
  }>;
}

/**
 * Search result from memory
 */
export interface SearchResult {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
  threadId?: string;
  threadTitle?: string;
  score?: number;
  context?: {
    before?: SearchResult[];
    after?: SearchResult[];
  };
}

/**
 * Configuration for the plugin
 */
export interface ObservationalMemoryPluginConfig {
  /**
   * Mastra server URL
   * Can also use MASTRA_URL env var
   */
  mastraUrl?: string;

  /**
   * API key for Mastra server authentication
   * Can also use MASTRA_API_KEY env var
   */
  apiKey?: string;

  /**
   * Agent ID to use for memory operations
   * Can also use MASTRA_AGENT_ID env var
   */
  agentId?: string;

  /**
   * Resource ID scope for memory operations
   * Defaults to a hash of the git user email
   */
  resourceId?: string;

  /**
   * Maximum number of recent observations to inject
   * @default 5
   */
  maxObservations?: number;

  /**
   * Maximum number of search results to return
   * @default 10
   */
  maxSearchResults?: number;

  /**
   * Include working memory in context injection
   * @default true
   */
  injectWorkingMemory?: boolean;

  /**
   * Include observational memory in context injection
   * @default true
   */
  injectObservations?: boolean;

  /**
   * Prefix for container tags
   * @default "opencode"
   */
  containerTagPrefix?: string;

  /**
   * Keyword patterns that trigger memory save (regex)
   */
  keywordPatterns?: string[];

  /**
   * Context usage ratio that triggers compaction (0-1)
   * @default 0.80
   */
  compactionThreshold?: number;
}

/**
 * API response types
 */
export interface MemoryStatusResponse {
  result: boolean;
  observationalMemory?: {
    enabled: boolean;
    hasRecord?: boolean;
    originType?: string;
    lastObservedAt?: Date;
    tokenCount?: number;
    observationTokenCount?: number;
    isObserving?: boolean;
    isReflecting?: boolean;
  };
}

export interface MemoryConfigResponse {
  config: {
    lastMessages?: number | false;
    semanticRecall?: boolean | Record<string, unknown>;
    workingMemory?: Record<string, unknown>;
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

export interface ObservationalMemoryResponse {
  record: ObservationalMemoryRecord | null;
  history?: ObservationalMemoryRecord[];
}

export interface ListThreadsResponse {
  threads: Thread[];
  page: number;
  perPage: number;
  totalPages: number;
  totalItems: number;
}

export interface ListMessagesResponse {
  messages: Message[];
  uiMessages?: unknown;
}

export interface SearchMemoryResponse {
  results: SearchResult[];
  count: number;
  query: string;
  searchScope?: string;
  searchType?: string;
}

export interface WorkingMemoryResponse {
  workingMemory: unknown;
  source: 'thread' | 'resource';
  workingMemoryTemplate?: unknown;
  threadExists: boolean;
}
