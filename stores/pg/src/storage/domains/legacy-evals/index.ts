import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MetricResult } from '@mastra/core/eval';
import { LegacyEvalsStorage, TABLE_EVALS } from '@mastra/core/storage';
import type { PaginationArgs, PaginationInfo, EvalRow } from '@mastra/core/storage';
import type { IDatabase } from 'pg-promise';
import { getSchemaName, getTableName } from '../utils';

function transformEvalRow(row: Record<string, any>): EvalRow {
  let testInfoValue = null;
  if (row.test_info) {
    try {
      testInfoValue = typeof row.test_info === 'string' ? JSON.parse(row.test_info) : row.test_info;
    } catch (e) {
      console.warn('Failed to parse test_info:', e);
    }
  }

  return {
    agentName: row.agent_name as string,
    input: row.input as string,
    output: row.output as string,
    result: row.result as MetricResult,
    metricName: row.metric_name as string,
    instructions: row.instructions as string,
    testInfo: testInfoValue,
    globalRunId: row.global_run_id as string,
    runId: row.run_id as string,
    createdAt: row.created_atZ || (row.created_at as string),
  };
}

export class LegacyEvalsPG extends LegacyEvalsStorage {
  private client: IDatabase<{}>;
  private schema: string;
  constructor({ client, schema }: { client: IDatabase<{}>; schema: string }) {
    super();
    this.client = client;
    this.schema = schema;
  }

  /** @deprecated use getEvals instead */
  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    try {
      const baseQuery = `SELECT * FROM ${getTableName({ indexName: TABLE_EVALS, schemaName: getSchemaName(this.schema) })} WHERE agent_name = $1`;
      const typeCondition =
        type === 'test'
          ? " AND test_info IS NOT NULL AND test_info->>'testPath' IS NOT NULL"
          : type === 'live'
            ? " AND (test_info IS NULL OR test_info->>'testPath' IS NULL)"
            : '';

      const query = `${baseQuery}${typeCondition} ORDER BY created_at DESC`;

      const rows = await this.client.manyOrNone(query, [agentName]);
      return rows?.map(row => transformEvalRow(row)) ?? [];
    } catch (error) {
      // Handle case where table doesn't exist yet
      if (error instanceof Error && error.message.includes('relation') && error.message.includes('does not exist')) {
        return [];
      }
      console.error('Failed to get evals for the specified agent: ' + (error as any)?.message);
      throw error;
    }
  }

  async getEvals(
    options: {
      agentName?: string;
      type?: 'test' | 'live';
    } & PaginationArgs = {},
  ): Promise<PaginationInfo & { evals: EvalRow[] }> {
    const tableName = getTableName({ indexName: TABLE_EVALS, schemaName: getSchemaName(this.schema) });

    const { agentName, type, page = 0, perPage = 100, dateRange } = options;
    const fromDate = dateRange?.start;
    const toDate = dateRange?.end;

    const conditions: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (agentName) {
      conditions.push(`agent_name = $${paramIndex++}`);
      queryParams.push(agentName);
    }

    if (type === 'test') {
      conditions.push(`(test_info IS NOT NULL AND test_info->>'testPath' IS NOT NULL)`);
    } else if (type === 'live') {
      conditions.push(`(test_info IS NULL OR test_info->>'testPath' IS NULL)`);
    }

    if (fromDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      queryParams.push(fromDate);
    }

    if (toDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      queryParams.push(toDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM ${tableName} ${whereClause}`;
    try {
      const countResult = await this.client.one(countQuery, queryParams);
      const total = parseInt(countResult.count, 10);
      const currentOffset = page * perPage;

      if (total === 0) {
        return {
          evals: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      const dataQuery = `SELECT * FROM ${tableName} ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      const rows = await this.client.manyOrNone(dataQuery, [...queryParams, perPage, currentOffset]);

      return {
        evals: rows?.map(row => transformEvalRow(row)) ?? [],
        total,
        page,
        perPage,
        hasMore: currentOffset + (rows?.length ?? 0) < total,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_GET_EVALS_FAILED',
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
      this.logger?.error?.(mastraError.toString());
      this.logger?.trackException(mastraError);
      throw mastraError;
    }
  }
}
