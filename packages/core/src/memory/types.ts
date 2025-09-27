import type { EmbeddingModelV2 } from '@ai-sdk/provider-v5';
import type { AssistantContent, CoreMessage, EmbeddingModel, ToolContent, UserContent } from 'ai';
import type { JSONSchema7 } from 'json-schema';

export type { MastraMessageV2 } from '../agent';
import type { ZodObject } from 'zod';
import type { MastraLanguageModel } from '../llm/model/shared.types';
import type { MastraStorage } from '../storage';
import type { DynamicArgument } from '../types';
import type { MastraVector } from '../vector';
import type { MemoryProcessor } from '.';

export type { Message as AiMessageType } from 'ai';
export type { MastraLanguageModel };

// Types for the memory system
export type MastraMessageV1 = {
  id: string;
  content: string | UserContent | AssistantContent | ToolContent;
  role: 'system' | 'user' | 'assistant' | 'tool';
  createdAt: Date;
  threadId?: string;
  resourceId?: string;
  toolCallIds?: string[];
  toolCallArgs?: Record<string, unknown>[];
  toolNames?: string[];
  type: 'text' | 'tool-call' | 'tool-result';
};

/**
 * @deprecated use MastraMessageV1 or MastraMessageV2
 */
export type MessageType = MastraMessageV1;

export type StorageThreadType = {
  id: string;
  title?: string;
  resourceId: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
};

export type MessageResponse<T extends 'raw' | 'core_message'> = {
  raw: MastraMessageV1[];
  core_message: CoreMessage[];
}[T];

type BaseWorkingMemory = {
  enabled: boolean;
  scope?: 'thread' | 'resource';
  /** @deprecated The `use` option has been removed. Working memory always uses tool-call mode. */
  use?: never;
};

type TemplateWorkingMemory = BaseWorkingMemory & {
  template: string;
  schema?: never;
  version?: 'stable' | 'vnext';
};

type SchemaWorkingMemory = BaseWorkingMemory & {
  schema: ZodObject<any> | JSONSchema7;
  template?: never;
};

type WorkingMemoryNone = BaseWorkingMemory & {
  template?: never;
  schema?: never;
};

export type WorkingMemory = TemplateWorkingMemory | SchemaWorkingMemory | WorkingMemoryNone;

/**
 * Vector index configuration (PostgreSQL-specific)
 *
 * Note: These configuration options are currently only supported when using
 * PostgreSQL with pgvector as the vector store. Other vector stores (Pinecone,
 * Qdrant, Chroma, etc.) will ignore these settings.
 */
export type VectorIndexConfig = {
  /** Index type - only supported by PostgreSQL/pgvector */
  type?: 'ivfflat' | 'hnsw' | 'flat';
  /** Distance metric - supported by all vector stores */
  metric?: 'cosine' | 'euclidean' | 'dotproduct';
  /** IVFFlat configuration (PostgreSQL only) */
  ivf?: {
    lists?: number;
  };
  /** HNSW configuration (PostgreSQL only) */
  hnsw?: {
    m?: number;
    efConstruction?: number;
  };
};

export type SemanticRecall = {
  topK: number;
  messageRange: number | { before: number; after: number };
  scope?: 'thread' | 'resource';
  /**
   * Vector index configuration (PostgreSQL/pgvector specific).
   * Other vector stores will use their default index configurations.
   */
  indexConfig?: VectorIndexConfig;
};

export type MemoryConfig = {
  lastMessages?: number | false;
  semanticRecall?: boolean | SemanticRecall;
  workingMemory?: WorkingMemory;
  threads?: {
    generateTitle?:
      | boolean
      | {
          model: DynamicArgument<MastraLanguageModel>;
          instructions?: DynamicArgument<string>;
        };
  };
};

export type SharedMemoryConfig = {
  /* @default new DefaultStorage({ config: { url: "file:memory.db" } }) */
  storage?: MastraStorage;

  options?: MemoryConfig;

  vector?: MastraVector | false;
  embedder?: EmbeddingModel<string> | EmbeddingModelV2<string>;

  processors?: MemoryProcessor[];
};

export type TraceType = {
  id: string;
  parentSpanId: string | null;
  name: string;
  traceId: string;
  scope: string;
  kind: number;
  attributes: Record<string, unknown> | null;
  status: Record<string, unknown> | null;
  events: Record<string, unknown> | null;
  links: Record<string, unknown> | null;
  other: Record<string, unknown> | null;
  startTime: number;
  endTime: number;
  createdAt: Date;
};

export type WorkingMemoryFormat = 'json' | 'markdown';

export type WorkingMemoryTemplate = {
  format: WorkingMemoryFormat;
  content: string;
};
