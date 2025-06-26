import type { StorageThreadType, MastraMessageV2, Trace, MastraMessageV1 } from '@mastra/core';
import type {
  EvalRow,
  PaginationInfo,
  StorageColumn,
  StorageGetMessagesArg,
  StorageGetTracesArg,
  TABLE_NAMES,
  WorkflowRun,
  WorkflowRuns,
} from '@mastra/core/storage';
import { MastraStorage } from '@mastra/core/storage';

export class ConvexStorage extends MastraStorage {
  getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    throw new Error('Method not implemented.' + threadId);
  }
  getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    throw new Error('Method not implemented.' + resourceId);
  }
  saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    throw new Error('Method not implemented.' + thread);
  }
  updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    throw new Error('Method not implemented.' + id + title + metadata);
  }
  updateMessages(args: {
    messages: Partial<Omit<MastraMessageV2, 'createdAt'>> &
      { id: string; content?: { metadata?: Record<string, unknown> | undefined; content?: string | undefined } }[];
  }): Promise<MastraMessageV2[]> {
    throw new Error('Method not implemented.' + args);
  }
  getTracesPaginated(args: StorageGetTracesArg): Promise<PaginationInfo & { traces: Trace[] }> {
    throw new Error('Method not implemented.' + args);
  }
  getThreadsByResourceIdPaginated(args: {
    resourceId: string;
    page: number;
    perPage: number;
  }): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    throw new Error('Method not implemented.' + args);
  }
  getMessagesPaginated(
    args: StorageGetMessagesArg & { format?: 'v1' | 'v2' },
  ): Promise<PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }> {
    throw new Error('Method not implemented.' + args);
  }

  getMessages(args: StorageGetMessagesArg & { format?: 'v1' | undefined }): Promise<MastraMessageV1[]>;
  getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  getMessages(args: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    if (args.format === 'v2') {
      // Handle V2 format
      return Promise.reject(new Error('Method not implemented for V2 format'));
    } else {
      // Handle V1 format (default)
      return Promise.reject(new Error('Method not implemented for V1 format'));
    }
  }
  saveMessages(args: { messages: MastraMessageV1[]; format?: 'v1' | undefined }): Promise<MastraMessageV1[]>;
  saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  saveMessages(args: {
    messages: MastraMessageV1[] | MastraMessageV2[];
    format?: 'v1' | 'v2';
  }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    if (args.format === 'v2') {
      // Handle V2 format
      return Promise.reject(new Error('Method not implemented for V2 format'));
    } else {
      // Handle V1 format (default)
      return Promise.reject(new Error('Method not implemented for V1 format'));
    }
  }
  createTable({ tableName }: { tableName: TABLE_NAMES; schema: Record<string, StorageColumn> }): Promise<void> {
    throw new Error('Method not implemented.' + tableName);
  }
  clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    throw new Error('Method not implemented.' + tableName);
  }
  alterTable(args: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    throw new Error('Method not implemented.' + args);
  }
  insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    throw new Error('Method not implemented.' + tableName + record);
  }
  batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    throw new Error('Method not implemented.' + tableName + records);
  }
  load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    throw new Error('Method not implemented.' + tableName + keys);
  }
  deleteThread({ threadId }: { threadId: string }): Promise<void> {
    throw new Error('Method not implemented.' + threadId);
  }
  getTraces(args: StorageGetTracesArg): Promise<any[]> {
    throw new Error('Method not implemented.' + args);
  }
  getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    throw new Error('Method not implemented.' + agentName + type);
  }
  getWorkflowRuns(args?: {
    workflowName?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
    resourceId?: string;
  }): Promise<WorkflowRuns> {
    throw new Error('Method not implemented.' + args);
  }
  getWorkflowRunById(args: { runId: string; workflowName?: string }): Promise<WorkflowRun | null> {
    throw new Error('Method not implemented.' + args);
  }
}
