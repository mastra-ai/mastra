import { MastraBase } from '../../../base';
import type { Trace } from '../../../telemetry';
import type { StorageGetTracesArg, PaginationInfo, StorageGetTracesPaginatedArg } from '../../types';

export abstract class TracesStorage extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'TRACES',
    });
  }

  abstract getTraces(args: StorageGetTracesArg): Promise<Trace[]>;

  abstract getTracesPaginated(args: StorageGetTracesPaginatedArg): Promise<PaginationInfo & { traces: Trace[] }>;

  abstract batchTraceInsert(args: { records: Record<string, any>[] }): Promise<void>;
}
