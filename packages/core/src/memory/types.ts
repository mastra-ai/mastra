// import type { AssistantContent, CoreMessage, EmbeddingModel, ToolContent, UserContent } from 'ai';
import type { EmbeddingModel } from 'ai';

export type { MastraMessageV2, MastraMessageV3 } from '../agent';
import type * as AIV4 from '../agent/message-list/ai-sdk-4';
import type { MastraStorage } from '../storage';
import type { MastraVector } from '../vector';
import type { MemoryProcessor } from '.';

// export type { UIMessage as AiMessageType } from 'ai';

// Types for the memory system
export type MastraMessageV1 = {
  id: string;
  content: string | AIV4.UserContent | AIV4.AssistantContent | AIV4.ToolContent;
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
  core_message: AIV4.CoreMessage[];
}[T];

export type MemoryConfig = {
  lastMessages?: number | false;
  semanticRecall?:
    | boolean
    | {
        topK: number;
        messageRange: number | { before: number; after: number };
        scope?: 'thread' | 'resource';
      };
  workingMemory?: {
    enabled: boolean;
    template?: string;
    /** @deprecated The `use` option has been removed. Working memory always uses tool-call mode. */
    use?: never;
  };
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
