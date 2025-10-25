import { MastraBase } from '../../../base';
import type { Trace } from '../../../telemetry';
import type { StorageGetTracesArg, PaginationInfo } from '../../types';

export abstract class TracesStorage extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'TRACES',
    });
  }

  abstract getTraces(args: StorageGetTracesArg): Promise<PaginationInfo & { traces: Trace[] }>;

  abstract batchTraceInsert(args: { records: Record<string, any>[] }): Promise<void>;
}
