import { MastraBase } from '../../../base';
import type { PaginationInfo, StorageGetAiTracesPaginatedArg, AITrace } from '../../types';

export abstract class ObservabilityStorage extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'OBSERVABILITY',
    });
  }

  abstract createAISpan(span: Record<string, any>): Promise<void>;

  abstract getAISpan(id: string): Promise<Record<string, any> | null>;

  abstract getAITrace(traceId: string): Promise<AITrace | null>;

  abstract getAITracesPaginated(
    args: StorageGetAiTracesPaginatedArg,
  ): Promise<PaginationInfo & { spans: Record<string, any>[] }>;

  abstract updateAISpan(id: string, updates: Partial<Record<string, any>>): Promise<void>;

  abstract deleteAISpan(id: string): Promise<void>;

  abstract batchCreateAISpan(args: { records: Record<string, any>[] }): Promise<void>;

  abstract batchUpdateAISpan(args: { records: { id: string; updates: Partial<Record<string, any>> }[] }): Promise<void>;

  abstract batchDeleteAISpan(args: { ids: string[] }): Promise<void>;
}
