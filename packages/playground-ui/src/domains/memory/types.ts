import type {
  ListMemoryThreadsResponse,
  ListMemoryThreadMessagesResponse,
  GetObservationalMemoryResponse,
  GetMemoryStatusResponse,
} from '@mastra/client-js';

export type {
  ListMemoryThreadsResponse,
  ListMemoryThreadMessagesResponse,
  GetObservationalMemoryResponse,
  GetMemoryStatusResponse,
};

export type MemoryThread = ListMemoryThreadsResponse['threads'][number];

export type MemoryMessage = ListMemoryThreadMessagesResponse['messages'][number];

export type OMRecord = NonNullable<GetObservationalMemoryResponse['record']>;

export type OMHistoryRecord = NonNullable<GetObservationalMemoryResponse['history']>[number];
