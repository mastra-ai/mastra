import { ObservabilityStorage } from '@mastra/core/storage';
import type { StorageGetAiTracesPaginatedArg, PaginationInfo, AITrace, AISpanRecord } from '@mastra/core/storage';

export class ObservabilityMSSQL extends ObservabilityStorage {
  constructor() {
    super();
  }

  createAISpan(_span: Record<string, any>): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getAISpan(_id: string): Promise<Record<string, any> | null> {
    throw new Error('Method not implemented.');
  }

  getAITracesPaginated(
    _args: StorageGetAiTracesPaginatedArg,
  ): Promise<PaginationInfo & { spans: Record<string, any>[] }> {
    throw new Error('Method not implemented.');
  }

  getAITrace(_traceId: string): Promise<AITrace | null> {
    throw new Error('Method not implemented.');
  }

  updateAISpan(_id: string, _updates: Partial<AISpanRecord>): Promise<void> {
    throw new Error('Method not implemented.');
  }

  deleteAISpan(_id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  batchCreateAISpan(_args: { records: Omit<AISpanRecord, 'id' | 'createdAt' | 'updatedAt'>[] }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  batchUpdateAISpan(_args: { records: { id: string; updates: Partial<AISpanRecord> }[] }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  batchDeleteAISpan(_args: { ids: string[] }): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
