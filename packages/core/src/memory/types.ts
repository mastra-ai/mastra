import type { AssistantContent, CoreMessage, EmbeddingModel, ToolContent, UserContent } from 'ai';

import type { MastraStorage } from '../storage';
import type { MastraVector } from '../vector';
import type { MessageProcessor } from '.';

export type { Message as AiMessageType } from 'ai';

// Types for the memory system
export type MessageType = {
  id: string;
  content: UserContent | AssistantContent | ToolContent;
  role: 'system' | 'user' | 'assistant' | 'tool';
  createdAt: Date;
  threadId: string;
  toolCallIds?: string[];
  toolCallArgs?: Record<string, unknown>[];
  toolNames?: string[];
  type: 'text' | 'tool-call' | 'tool-result';
};

export type StorageThreadType = {
  id: string;
  title?: string;
  resourceId: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
};

export type MessageResponse<T extends 'raw' | 'core_message'> = {
  raw: MessageType[];
  core_message: CoreMessage[];
}[T];

export type MemoryConfig = {
  lastMessages?: number | false;
  semanticRecall?:
    | boolean
    | {
        topK: number;
        messageRange: number | { before: number; after: number };
      };
  workingMemory?: {
    enabled: boolean;
    template?: string;
    use?: 'text-stream' | 'tool-call';
  };
  threads?: {
    generateTitle?: boolean;
  };
};

export type SharedMemoryConfig = {
  /* @default new DefaultStorage({ config: { url: "file:memory.db" } }) */
  storage?: MastraStorage;

  options?: MemoryConfig;

  vector?: MastraVector;
  embedder?: EmbeddingModel<string>;

  processors?: MessageProcessor[];
};
