import { MastraBase } from '../../../base';
import type { EvalRow, PaginationArgs, PaginationInfo } from '../../types';
import type { StoreOperations } from '../operations';

export abstract class LegacyEvalsStorage extends MastraBase {
  operations: StoreOperations | null;
  constructor() {
    super({
      component: 'STORAGE',
      name: 'LEGACY_EVALS',
    });

    this.operations = null;
  }

  abstract getEvals(
    options: {
      agentName?: string;
      type?: 'test' | 'live';
    } & PaginationArgs,
  ): Promise<PaginationInfo & { evals: EvalRow[] }>;

  abstract getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]>;
}
