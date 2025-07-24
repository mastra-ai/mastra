import { MastraBase } from '../../../base';
import type { EvalRow, PaginationArgs, PaginationInfo } from '../../types';

export abstract class LegacyEvalsStorage extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'LEGACY_EVALS',
    });
  }

  abstract getEvals(
    options: {
      agentName?: string;
      type?: 'test' | 'live';
    } & PaginationArgs,
  ): Promise<PaginationInfo & { evals: EvalRow[] }>;

  abstract getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]>;
}
