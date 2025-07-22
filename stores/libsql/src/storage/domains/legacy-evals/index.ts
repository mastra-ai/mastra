import type { Client, InValue } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MetricResult, TestInfo } from '@mastra/core/eval';
import { LegacyEvalsStorage, TABLE_EVALS } from '@mastra/core/storage';
import type { PaginationArgs, PaginationInfo, EvalRow } from '@mastra/core/storage';

function transformEvalRow(row: Record<string, any>): EvalRow {
  const resultValue = JSON.parse(row.result as string);
  const testInfoValue = row.test_info ? JSON.parse(row.test_info as string) : undefined;

  if (!resultValue || typeof resultValue !== 'object' || !('score' in resultValue)) {
    throw new Error(`Invalid MetricResult format: ${JSON.stringify(resultValue)}`);
  }

  return {
    input: row.input as string,
    output: row.output as string,
    result: resultValue as MetricResult,
    agentName: row.agent_name as string,
    metricName: row.metric_name as string,
    instructions: row.instructions as string,
    testInfo: testInfoValue as TestInfo,
    globalRunId: row.global_run_id as string,
    runId: row.run_id as string,
    createdAt: row.created_at as string,
  };
}

export class LegacyEvalsLibSQL extends LegacyEvalsStorage {
  private client: Client;
  constructor({ client }: { client: Client }) {
    super();
    this.client = client;
  }

  /** @deprecated use getEvals instead */
  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    try {
      const baseQuery = `SELECT * FROM ${TABLE_EVALS} WHERE agent_name = ?`;
      const typeCondition =
        type === 'test'
          ? " AND test_info IS NOT NULL AND test_info->>'testPath' IS NOT NULL"
          : type === 'live'
            ? " AND (test_info IS NULL OR test_info->>'testPath' IS NULL)"
            : '';

      const result = await this.client.execute({
        sql: `${baseQuery}${typeCondition} ORDER BY created_at DESC`,
        args: [agentName],
      });

      return result.rows?.map(row => transformEvalRow(row)) ?? [];
    } catch (error) {
      // Handle case where table doesn't exist yet
      if (error instanceof Error && error.message.includes('no such table')) {
        return [];
      }
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_GET_EVALS_BY_AGENT_NAME_FAILED',
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

    const conditions: string[] = [];
    const queryParams: InValue[] = [];

    if (agentName) {
      conditions.push(`agent_name = ?`);
      queryParams.push(agentName);
    }

    if (type === 'test') {
      conditions.push(`(test_info IS NOT NULL AND json_extract(test_info, '$.testPath') IS NOT NULL)`);
    } else if (type === 'live') {
      conditions.push(`(test_info IS NULL OR json_extract(test_info, '$.testPath') IS NULL)`);
    }

    if (fromDate) {
      conditions.push(`created_at >= ?`);
      queryParams.push(fromDate.toISOString());
    }

    if (toDate) {
      conditions.push(`created_at <= ?`);
      queryParams.push(toDate.toISOString());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const countResult = await this.client.execute({
        sql: `SELECT COUNT(*) as count FROM ${TABLE_EVALS} ${whereClause}`,
        args: queryParams,
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      const currentOffset = page * perPage;
      const hasMore = currentOffset + perPage < total;

      if (total === 0) {
        return {
          evals: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      const dataResult = await this.client.execute({
        sql: `SELECT * FROM ${TABLE_EVALS} ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        args: [...queryParams, perPage, currentOffset],
      });

      return {
        evals: dataResult.rows?.map(row => transformEvalRow(row)) ?? [],
        total,
        page,
        perPage,
        hasMore,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_GET_EVALS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
