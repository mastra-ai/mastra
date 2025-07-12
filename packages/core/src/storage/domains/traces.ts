import type { Trace } from '../../telemetry';
import type { PaginationInfo, StorageGetTracesArg } from '../types';
import { MastraStorageBase } from './base';
import type { MastraStore } from './store';

export abstract class MastraTracesStorage extends MastraStorageBase {
  constructor({ store }: { store: MastraStore }) {
    super({ name: 'TRACES', store });
  }

  abstract insertTraces({ records }: { records: Record<string, any>[] }): Promise<void>;

  abstract getTraces(args: StorageGetTracesArg): Promise<Trace[]>;

  abstract getTracesPaginated(args: StorageGetTracesArg): Promise<PaginationInfo & { traces: Trace[] }>;
}
