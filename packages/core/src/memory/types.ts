import type { AssistantContent, CoreMessage, EmbeddingModel, ToolContent, UserContent } from 'ai';

import type { MastraStorage } from '../storage';
import type { MastraVector } from '../vector';
import type { MemoryProcessor } from '.';

export type { Message as AiMessageType } from 'ai';

// Types for the memory system
export type MessageType = {
  id: string;
  content: UserContent | AssistantContent | ToolContent;
  role: 'system' | 'user' | 'assistant' | 'tool';
  createdAt: Date;
  threadId: string;
  resourceId: string;
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
  workingMemory?:
    | {
        enabled: boolean;
        template?: string;
        use: 'tool-call';
      }
    | {
        enabled: boolean;
        template?: string;
        /** @deprecated the 'text-stream' working memory option (which is the current default) will be full removed in favor of the 'tool-call' option in a future breaking change. */
        use?: 'text-stream';
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
