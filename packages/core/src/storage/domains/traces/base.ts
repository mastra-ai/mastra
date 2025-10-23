import { MastraBase } from '../../../base';
import type { Trace } from '../../../telemetry';
import type { StorageGetTracesArg, PaginationInfo, StorageGetTracesPaginatedArg } from '../../types';
import type { StoreOperations } from '../operations';

export abstract class TracesStorage extends MastraBase {
  operations: StoreOperations | null;
  constructor() {
    super({
      component: 'STORAGE',
      name: 'TRACES',
    });
    this.operations = null;
  }

  abstract getTraces(args: StorageGetTracesArg): Promise<Trace[]>;

  abstract getTracesPaginated(args: StorageGetTracesPaginatedArg): Promise<PaginationInfo & { traces: Trace[] }>;

  abstract batchTraceInsert(args: { records: Record<string, any>[] }): Promise<void>;
}
