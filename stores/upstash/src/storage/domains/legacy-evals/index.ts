import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MetricResult, TestInfo } from '@mastra/core/eval';
import type { EvalRow, PaginationArgs, PaginationInfo } from '@mastra/core/storage';
import { LegacyEvalsStorage, TABLE_EVALS } from '@mastra/core/storage';
import type { Redis } from '@upstash/redis';
import type { StoreOperationsUpstash } from '../operations';

function transformEvalRecord(record: Record<string, any>): EvalRow {
  // Parse JSON strings if needed
  let result = record.result;
  if (typeof result === 'string') {
    try {
      result = JSON.parse(result);
    } catch {
      console.warn('Failed to parse result JSON:');
    }
  }

  let testInfo = record.test_info;
  if (typeof testInfo === 'string') {
    try {
      testInfo = JSON.parse(testInfo);
    } catch {
      console.warn('Failed to parse test_info JSON:');
    }
  }

  return {
    agentName: record.agent_name,
    input: record.input,
    output: record.output,
    result: result as MetricResult,
    metricName: record.metric_name,
    instructions: record.instructions,
    testInfo: testInfo as TestInfo | undefined,
    globalRunId: record.global_run_id,
    runId: record.run_id,
    createdAt:
      typeof record.created_at === 'string'
        ? record.created_at
        : record.created_at instanceof Date
          ? record.created_at.toISOString()
          : new Date().toISOString(),
  };
}

export class StoreLegacyEvalsUpstash extends LegacyEvalsStorage {
  private client: Redis;
  private operations: StoreOperationsUpstash;
  constructor({ client, operations }: { client: Redis; operations: StoreOperationsUpstash }) {
    super();
    this.client = client;
    this.operations = operations;
  }

  /**
   * @deprecated Use getEvals instead
   */
  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    try {
      const pattern = `${TABLE_EVALS}:*`;
      const keys = await this.operations.scanKeys(pattern);

      // Check if we have any keys before using pipeline
      if (keys.length === 0) {
        return [];
      }

      // Use pipeline for batch fetching to improve performance
      const pipeline = this.client.pipeline();
      keys.forEach(key => pipeline.get(key));
      const results = await pipeline.exec();

      // Filter by agent name and remove nulls
      const nonNullRecords = results.filter(
        (record): record is Record<string, any> =>
          record !== null && typeof record === 'object' && 'agent_name' in record && record.agent_name === agentName,
      );

      let filteredEvals = nonNullRecords;

      if (type === 'test') {
        filteredEvals = filteredEvals.filter(record => {
          if (!record.test_info) return false;

          // Handle test_info as a JSON string
          try {
            if (typeof record.test_info === 'string') {
              const parsedTestInfo = JSON.parse(record.test_info);
              return parsedTestInfo && typeof parsedTestInfo === 'object' && 'testPath' in parsedTestInfo;
            }

            // Handle test_info as an object
            return typeof record.test_info === 'object' && 'testPath' in record.test_info;
          } catch {
            return false;
          }
        });
      } else if (type === 'live') {
        filteredEvals = filteredEvals.filter(record => {
          if (!record.test_info) return true;

          // Handle test_info as a JSON string
          try {
            if (typeof record.test_info === 'string') {
              const parsedTestInfo = JSON.parse(record.test_info);
              return !(parsedTestInfo && typeof parsedTestInfo === 'object' && 'testPath' in parsedTestInfo);
            }

            // Handle test_info as an object
            return !(typeof record.test_info === 'object' && 'testPath' in record.test_info);
          } catch {
            return true;
          }
        });
      }

      // Transform to EvalRow format
      return filteredEvals.map(record => transformEvalRecord(record));
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_GET_EVALS_BY_AGENT_NAME_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentName },
        },
        error,
      );
      this.logger?.trackException(mastraError);
      this.logger.error(mastraError.toString());
      return [];
    }
  }

  /**
   * Get all evaluations with pagination and total count
   * @param options Pagination and filtering options
   * @returns Object with evals array and total count
   */
  async getEvals(
    options?: {
      agentName?: string;
      type?: 'test' | 'live';
    } & PaginationArgs,
  ): Promise<PaginationInfo & { evals: EvalRow[] }> {
    try {
      // Default pagination parameters
      const { agentName, type, page = 0, perPage = 100, dateRange } = options || {};
      const fromDate = dateRange?.start;
      const toDate = dateRange?.end;

      // Get all keys that match the evals table pattern using cursor-based scanning
      const pattern = `${TABLE_EVALS}:*`;
      const keys = await this.operations.scanKeys(pattern);

      // Check if we have any keys before using pipeline
      if (keys.length === 0) {
        return {
          evals: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      // Use pipeline for batch fetching to improve performance
      const pipeline = this.client.pipeline();
      keys.forEach(key => pipeline.get(key));
      const results = await pipeline.exec();

      // Process results and apply filters
      let filteredEvals = results
        .map((result: any) => result as Record<string, any> | null)
        .filter((record): record is Record<string, any> => record !== null && typeof record === 'object');

      // Apply agent name filter if provided
      if (agentName) {
        filteredEvals = filteredEvals.filter(record => record.agent_name === agentName);
      }

      // Apply type filter if provided
      if (type === 'test') {
        filteredEvals = filteredEvals.filter(record => {
          if (!record.test_info) return false;

          try {
            if (typeof record.test_info === 'string') {
              const parsedTestInfo = JSON.parse(record.test_info);
              return parsedTestInfo && typeof parsedTestInfo === 'object' && 'testPath' in parsedTestInfo;
            }
            return typeof record.test_info === 'object' && 'testPath' in record.test_info;
          } catch {
            return false;
          }
        });
      } else if (type === 'live') {
        filteredEvals = filteredEvals.filter(record => {
          if (!record.test_info) return true;

          try {
            if (typeof record.test_info === 'string') {
              const parsedTestInfo = JSON.parse(record.test_info);
              return !(parsedTestInfo && typeof parsedTestInfo === 'object' && 'testPath' in parsedTestInfo);
            }
            return !(typeof record.test_info === 'object' && 'testPath' in record.test_info);
          } catch {
            return true;
          }
        });
      }

      // Apply date filters if provided
      if (fromDate) {
        filteredEvals = filteredEvals.filter(record => {
          const createdAt = new Date(record.created_at || record.createdAt || 0);
          return createdAt.getTime() >= fromDate.getTime();
        });
      }

      if (toDate) {
        filteredEvals = filteredEvals.filter(record => {
          const createdAt = new Date(record.created_at || record.createdAt || 0);
          return createdAt.getTime() <= toDate.getTime();
        });
      }

      // Sort by creation date (newest first)
      filteredEvals.sort((a, b) => {
        const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
        const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      const total = filteredEvals.length;

      // Apply pagination
      const start = page * perPage;
      const end = start + perPage;
      const paginatedEvals = filteredEvals.slice(start, end);
      const hasMore = end < total;

      // Transform to EvalRow format
      const evals = paginatedEvals.map(record => transformEvalRecord(record));

      return {
        evals,
        total,
        page,
        perPage,
        hasMore,
      };
    } catch (error) {
      const { page = 0, perPage = 100 } = options || {};
      const mastraError = new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_GET_EVALS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            page,
            perPage,
          },
        },
        error,
      );
      this.logger.error(mastraError.toString());
      this.logger?.trackException(mastraError);
      return {
        evals: [],
        total: 0,
        page,
        perPage,
        hasMore: false,
      };
    }
  }
}
