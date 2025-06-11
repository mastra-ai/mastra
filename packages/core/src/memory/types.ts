import type { AssistantContent, CoreMessage, EmbeddingModel, ToolContent, UserContent } from 'ai';

export type { MastraMessageV2 } from '../agent';
import type { MastraStorage } from '../storage';
import type { MastraVector } from '../vector';
import type { MemoryProcessor } from '.';
import type { ZodObject } from 'zod';

export type { Message as AiMessageType } from 'ai';

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

type WorkingMemoryBase = {
  enabled: boolean;
  /** @deprecated The `use` option has been removed. Working memory always uses tool-call mode. */
  use?: never;
};

type WorkingMemoryTemplate = WorkingMemoryBase & {
  template: string;
  schema?: never;
};

type WorkingMemorySchema = WorkingMemoryBase & {
  schema: ZodObject<any>;
  template?: never;
};

type WorkingMemoryNone = WorkingMemoryBase & {
  template?: never;
  schema?: never;
};

export type WorkingMemory = WorkingMemoryTemplate | WorkingMemorySchema | WorkingMemoryNone;

export type MemoryConfig = {
  lastMessages?: number | false;
  semanticRecall?:
    | boolean
    | {
        topK: number;
        messageRange: number | { before: number; after: number };
        scope?: 'thread' | 'resource';
      };
  workingMemory?: WorkingMemory;
  threads?: {
    generateTitle?: boolean;
  };
};

export type SharedMemoryConfig = {
  /* @default new DefaultStorage({ config: { url: "file:memory.db" } }) */
  storage?: MastraStorage;

  options?: MemoryConfig;

  vector?: MastraVector | false;
  embedder?: EmbeddingModel<string>;

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
