import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { LegacyEvalsStorage, TABLE_EVALS } from '@mastra/core/storage';
import type { EvalRow, PaginationArgs, PaginationInfo } from '@mastra/core/storage';
import type { StoreOperationsCloudflare } from '../operations';

export class LegacyEvalsStorageCloudflare extends LegacyEvalsStorage {
  operations: StoreOperationsCloudflare;
  constructor({ operations }: { operations: StoreOperationsCloudflare }) {
    super();
    this.operations = operations;
  }

  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    try {
      // List all keys in the evals table
      const prefix = this.operations.namespacePrefix ? `${this.operations.namespacePrefix}:` : '';
      const keyObjs = await this.operations.listKV(TABLE_EVALS, { prefix: `${prefix}${TABLE_EVALS}` });

      const evals: EvalRow[] = [];

      for (const { name: key } of keyObjs) {
        const data = await this.operations.getKV(TABLE_EVALS, key);
        if (!data) continue;

        // Filter by agentName
        if (data.agent_name !== agentName) continue;

        // Filter by type if provided
        if (type) {
          const isTest = data.test_info !== null && data.test_info !== undefined;
          const evalType = isTest ? 'test' : 'live';
          if (evalType !== type) continue;
        }

        // Map field names to match EvalRow type
        const mappedData = {
          ...data,
          runId: data.run_id,
          testInfo: data.test_info,
        };

        evals.push(mappedData);
      }

      // Sort by createdAt descending
      evals.sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });

      return evals;
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_GET_EVALS_BY_AGENT_NAME_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: 'Failed to get evals by agent name',
        },
        error,
      );
    }
  }

  async getEvals(
    options: { agentName?: string; type?: 'test' | 'live'; dateRange?: { start?: Date; end?: Date } } & PaginationArgs,
  ): Promise<PaginationInfo & { evals: EvalRow[] }> {
    try {
      const { agentName, type, page = 0, perPage = 100, dateRange } = options;

      // List all keys in the evals table
      const prefix = this.operations.namespacePrefix ? `${this.operations.namespacePrefix}:` : '';
      const keyObjs = await this.operations.listKV(TABLE_EVALS, { prefix: `${prefix}${TABLE_EVALS}` });

      const evals: EvalRow[] = [];

      for (const { name: key } of keyObjs) {
        const data = await this.operations.getKV(TABLE_EVALS, key);
        if (!data) continue;

        // Filter by agentName if provided
        if (agentName && data.agent_name !== agentName) continue;

        // Filter by type if provided
        if (type) {
          const isTest = data.test_info !== null && data.test_info !== undefined;
          const evalType = isTest ? 'test' : 'live';
          if (evalType !== type) continue;
        }

        // Filter by date range if provided
        if (dateRange?.start || dateRange?.end) {
          const evalDate = new Date(data.createdAt || data.created_at || 0);
          if (dateRange.start && evalDate < dateRange.start) continue;
          if (dateRange.end && evalDate > dateRange.end) continue;
        }

        // Map field names to match EvalRow type
        const mappedData = {
          ...data,
          runId: data.run_id,
          testInfo: data.test_info,
        };

        evals.push(mappedData);
      }

      // Sort by createdAt descending
      evals.sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });

      // Apply pagination
      const start = page * perPage;
      const end = start + perPage;
      const paginatedEvals = evals.slice(start, end);

      return {
        page,
        perPage,
        total: evals.length,
        hasMore: start + perPage < evals.length,
        evals: paginatedEvals,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_GET_EVALS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: 'Failed to get evals',
        },
        error,
      );
    }
  }
}
