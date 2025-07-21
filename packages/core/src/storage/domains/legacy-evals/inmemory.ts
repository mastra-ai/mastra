import type { MetricResult, TestInfo } from '../../../eval';
import type { EvalRow, PaginationArgs, PaginationInfo, StorageEvalRow } from '../../types';
import { LegacyEvalsStorage } from './base';

export type InMemoryEvals = Map<string, StorageEvalRow>;

export class InMemoryLegacyEvals extends LegacyEvalsStorage {
  private collection: InMemoryEvals;
  constructor({ collection }: { collection: InMemoryEvals }) {
    super();
    this.collection = collection;
  }

  async getEvals(
    options: { agentName?: string; type?: 'test' | 'live' } & PaginationArgs,
  ): Promise<PaginationInfo & { evals: EvalRow[] }> {
    this.logger.debug(`MockStore: getEvals called`, options);

    let evals = Array.from(this.collection.values());

    // Filter by agentName if provided
    if (options.agentName) {
      evals = evals.filter(evalR => evalR.agent_name === options.agentName);
    }

    // Filter by type if provided
    if (options.type === 'test') {
      evals = evals.filter(evalR => evalR.test_info && evalR.test_info.testPath);
    } else if (options.type === 'live') {
      evals = evals.filter(evalR => !evalR.test_info || !evalR.test_info.testPath);
    }

    // Filter by date range if provided
    if (options.dateRange?.start) {
      evals = evals.filter(evalR => new Date(evalR.created_at) >= options.dateRange!.start!);
    }
    if (options.dateRange?.end) {
      evals = evals.filter(evalR => new Date(evalR.created_at) <= options.dateRange!.end!);
    }

    // Sort by createdAt (newest first)
    evals.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = evals.length;
    const page = options.page || 0;
    const perPage = options.perPage || 100;
    const start = page * perPage;
    const end = start + perPage;

    return {
      evals: evals.slice(start, end).map(e => ({
        agentName: e.agent_name,
        input: e.input,
        output: e.output,
        instructions: e.instructions,
        result: e.result as MetricResult,
        createdAt: e.created_at.toISOString(),
        testInfo: e.test_info as TestInfo,
        metricName: e.metric_name,
        runId: e.run_id,
        globalRunId: e.global_run_id,
      })),
      total,
      page,
      perPage,
      hasMore: total > end,
    };
  }

  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    this.logger.debug(`MockStore: getEvalsByAgentName called for ${agentName}`);
    // Mock implementation - filter evals by agentName and type
    let evals = Array.from(this.collection.values()).filter((e: StorageEvalRow) => e.agent_name === agentName);

    if (type === 'test') {
      evals = evals.filter((e: any) => e.test_info && e.test_info.testPath);
    } else if (type === 'live') {
      evals = evals.filter((e: any) => !e.test_info || !e.test_info.testPath);
    }

    return evals
      .sort((a: StorageEvalRow, b: StorageEvalRow) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(e => ({
        agentName: e.agent_name,
        input: e.input,
        output: e.output,
        instructions: e.instructions,
        result: e.result as MetricResult,
        createdAt: e.created_at.toISOString(),
        metricName: e.metric_name,
        runId: e.run_id,
        testInfo: e.test_info as TestInfo,
        globalRunId: e.global_run_id,
      }));
  }
}
