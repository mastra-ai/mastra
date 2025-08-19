import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MetricResult } from '@mastra/core/eval';
import { LegacyEvalsStorage, TABLE_EVALS, safelyParseJSON } from '@mastra/core/storage';
import type { PaginationArgs, PaginationInfo, EvalRow } from '@mastra/core/storage';
import type { StoreOperationsMongoDB } from '../operations';

function transformEvalRow(row: Record<string, any>): EvalRow {
  let testInfoValue = null;
  if (row.test_info) {
    try {
      testInfoValue = typeof row.test_info === 'string' ? safelyParseJSON(row.test_info) : row.test_info;
    } catch (e) {
      console.warn('Failed to parse test_info:', e);
    }
  }

  let resultValue: MetricResult;
  try {
    resultValue = typeof row.result === 'string' ? safelyParseJSON(row.result) : row.result;
  } catch (e) {
    console.warn('Failed to parse result:', e);
    throw new Error('Invalid result format');
  }

  return {
    agentName: row.agent_name as string,
    input: row.input as string,
    output: row.output as string,
    result: resultValue,
    metricName: row.metric_name as string,
    instructions: row.instructions as string,
    testInfo: testInfoValue,
    globalRunId: row.global_run_id as string,
    runId: row.run_id as string,
    createdAt: row.createdAt as string,
  };
}

export class LegacyEvalsMongoDB extends LegacyEvalsStorage {
  private operations: StoreOperationsMongoDB;

  constructor({ operations }: { operations: StoreOperationsMongoDB }) {
    super();
    this.operations = operations;
  }

  /** @deprecated use getEvals instead */
  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    try {
      const query: any = {
        agent_name: agentName,
      };

      if (type === 'test') {
        query['test_info'] = { $ne: null };
        // is not possible to filter by test_info.testPath because it is not a json field
        // query['test_info.testPath'] = { $ne: null };
      }

      if (type === 'live') {
        // is not possible to filter by test_info.testPath because it is not a json field
        query['test_info'] = null;
      }

      const collection = await this.operations.getCollection(TABLE_EVALS);
      const documents = await collection.find(query).sort({ created_at: 'desc' }).toArray();
      const result = documents.map((row: any) => transformEvalRow(row));
      // Post filter to remove if test_info.testPath is null
      return result.filter((row: any) => {
        if (type === 'live') {
          return !Boolean(row.testInfo?.testPath);
        }

        if (type === 'test') {
          return row.testInfo?.testPath !== null;
        }
        return true;
      });
    } catch (error) {
      // Handle case where table doesn't exist yet
      if (error instanceof Error && error.message.includes('no such table')) {
        return [];
      }
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_GET_EVALS_BY_AGENT_NAME_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentName },
        },
        error,
      );
    }
  }

  async getEvals(
    options: {
      agentName?: string;
      type?: 'test' | 'live';
    } & PaginationArgs = {},
  ): Promise<PaginationInfo & { evals: EvalRow[] }> {
    const { agentName, type, page = 0, perPage = 100, dateRange } = options;
    const fromDate = dateRange?.start;
    const toDate = dateRange?.end;
    const currentOffset = page * perPage;

    const query: any = {};
    if (agentName) {
      query['agent_name'] = agentName;
    }

    if (type === 'test') {
      query['test_info'] = { $ne: null };
    } else if (type === 'live') {
      query['test_info'] = null;
    }

    if (fromDate || toDate) {
      query['createdAt'] = {};
      if (fromDate) {
        query['createdAt']['$gte'] = fromDate;
      }
      if (toDate) {
        query['createdAt']['$lte'] = toDate;
      }
    }

    try {
      const collection = await this.operations.getCollection(TABLE_EVALS);
      let total = 0;
      // Only get total count when using pagination
      if (page === 0 || perPage < 1000) {
        total = await collection.countDocuments(query);
      }

      if (total === 0) {
        return {
          evals: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      const documents = await collection
        .find(query)
        .sort({ created_at: 'desc' })
        .skip(currentOffset)
        .limit(perPage)
        .toArray();

      const evals = documents.map((row: any) => transformEvalRow(row));

      // Post filter to remove if test_info.testPath is null
      const filteredEvals = evals.filter((row: any) => {
        if (type === 'live') {
          return !Boolean(row.testInfo?.testPath);
        }

        if (type === 'test') {
          return row.testInfo?.testPath !== null;
        }
        return true;
      });

      const hasMore = currentOffset + filteredEvals.length < total;

      return {
        evals: filteredEvals,
        total,
        page,
        perPage,
        hasMore,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_GET_EVALS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            agentName: agentName || 'all',
            type: type || 'all',
            page,
            perPage,
          },
        },
        error,
      );
    }
  }
}
