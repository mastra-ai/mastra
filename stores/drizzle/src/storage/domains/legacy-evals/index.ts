import { LegacyEvalsStorage } from '@mastra/core/storage';
import type { EvalRow, PaginationArgs, PaginationInfo } from '@mastra/core/storage';

export class LegacyEvalsDrizzle extends LegacyEvalsStorage {
  private db: any; // Will be Drizzle instance
  private schema: any; // Will be schema definitions

  constructor({ db, schema }: { db: any; schema: any }) {
    super();
    this.db = db;
    this.schema = schema;
  }

  async getEvals(
    options: {
      agentName?: string;
      type?: 'test' | 'live';
    } & PaginationArgs,
  ): Promise<PaginationInfo & { evals: EvalRow[] }> {
    // TODO: Implement with Drizzle query
    throw new Error('LegacyEvalsDrizzle.getEvals not implemented');
  }

  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    // TODO: Implement with Drizzle query
    throw new Error('LegacyEvalsDrizzle.getEvalsByAgentName not implemented');
  }
}
