import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MetricResult, TestInfo } from '@mastra/core/eval';
import { LegacyEvalsStorage, serializeDate, TABLE_EVALS } from '@mastra/core/storage';
import type { EvalRow, PaginationArgs, PaginationInfo } from '@mastra/core/storage';
import type { SqlParam } from '../../sql-builder';
import { createSqlBuilder } from '../../sql-builder';
import type { StoreOperationsD1 } from '../operations';
import { deserializeValue, isArrayOfRecords } from '../utils';

export class LegacyEvalsStorageD1 extends LegacyEvalsStorage {
  private operations: StoreOperationsD1;
  constructor({ operations }: { operations: StoreOperationsD1 }) {
    super();
    this.operations = operations;
  }

  async getEvals(
    options: {
      agentName?: string;
      type?: 'test' | 'live';
    } & PaginationArgs,
  ): Promise<PaginationInfo & { evals: EvalRow[] }> {
    const { agentName, type, page = 0, perPage = 40, dateRange } = options || {};
    const fullTableName = this.operations.getTableName(TABLE_EVALS);

    const conditions: string[] = [];
    const queryParams: SqlParam[] = [];

    if (agentName) {
      conditions.push(`agent_name = ?`);
      queryParams.push(agentName);
    }

    if (type === 'test') {
      // For SQLite/D1, json_extract is used to query JSON fields
      conditions.push(`(test_info IS NOT NULL AND json_extract(test_info, '$.testPath') IS NOT NULL)`);
    } else if (type === 'live') {
      conditions.push(`(test_info IS NULL OR json_extract(test_info, '$.testPath') IS NULL)`);
    }

    if (dateRange?.start) {
      conditions.push(`created_at >= ?`);
      queryParams.push(serializeDate(dateRange.start));
    }

    if (dateRange?.end) {
      conditions.push(`created_at <= ?`);
      queryParams.push(serializeDate(dateRange.end));
    }

    const countQueryBuilder = createSqlBuilder().count().from(fullTableName);
    if (conditions.length > 0) {
      countQueryBuilder.where(conditions.join(' AND '), ...queryParams);
    }
    const { sql: countSql, params: countParams } = countQueryBuilder.build();

    try {
      const countResult = (await this.operations.executeQuery({
        sql: countSql,
        params: countParams,
        first: true,
      })) as {
        count: number;
      } | null;
      const total = Number(countResult?.count || 0);

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

      const dataQueryBuilder = createSqlBuilder().select('*').from(fullTableName);
      if (conditions.length > 0) {
        dataQueryBuilder.where(conditions.join(' AND '), ...queryParams);
      }
      dataQueryBuilder.orderBy('created_at', 'DESC').limit(perPage).offset(currentOffset);

      const { sql: dataSql, params: dataParams } = dataQueryBuilder.build();
      const rows = await this.operations.executeQuery({
        sql: dataSql,
        params: dataParams,
      });

      const evals = (isArrayOfRecords(rows) ? rows : []).map((row: Record<string, any>) => {
        const result = deserializeValue(row.result);
        const testInfo = row.test_info ? deserializeValue(row.test_info) : undefined;

        if (!result || typeof result !== 'object' || !('score' in result)) {
          throw new Error(`Invalid MetricResult format: ${JSON.stringify(result)}`);
        }

        return {
          input: row.input as string,
          output: row.output as string,
          result: result as MetricResult,
          agentName: row.agent_name as string,
          metricName: row.metric_name as string,
          instructions: row.instructions as string,
          testInfo: testInfo as TestInfo,
          globalRunId: row.global_run_id as string,
          runId: row.run_id as string,
          createdAt: row.created_at as string,
        } as EvalRow;
      });

      const hasMore = currentOffset + evals.length < total;

      return {
        evals,
        total,
        page,
        perPage,
        hasMore,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_GET_EVALS_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to retrieve evals for agent ${agentName}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          details: { agentName: agentName ?? '', type: type ?? '' },
        },
        error,
      );
    }
  }

  /**
   * @deprecated use getEvals instead
   */
  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    const fullTableName = this.operations.getTableName(TABLE_EVALS);

    try {
      let query = createSqlBuilder().select('*').from(fullTableName).where('agent_name = ?', agentName);

      // Match LibSQL implementation for type filtering
      if (type === 'test') {
        // For 'test' type: test_info must exist and have a testPath property
        query = query.andWhere("test_info IS NOT NULL AND json_extract(test_info, '$.testPath') IS NOT NULL");
      } else if (type === 'live') {
        // For 'live' type: test_info is NULL or doesn't have a testPath property
        query = query.andWhere("(test_info IS NULL OR json_extract(test_info, '$.testPath') IS NULL)");
      }

      query.orderBy('created_at', 'DESC');

      const { sql, params } = query.build();
      const results = await this.operations.executeQuery({ sql, params });

      return isArrayOfRecords(results)
        ? results.map((row: Record<string, any>) => {
            // Convert snake_case to camelCase for the response
            const result = deserializeValue(row.result);
            const testInfo = row.test_info ? deserializeValue(row.test_info) : undefined;

            return {
              input: row.input || '',
              output: row.output || '',
              result,
              agentName: row.agent_name || '',
              metricName: row.metric_name || '',
              instructions: row.instructions || '',
              runId: row.run_id || '',
              globalRunId: row.global_run_id || '',
              createdAt: row.created_at || '',
              testInfo,
            };
          })
        : [];
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_GET_EVALS_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to retrieve evals for agent ${agentName}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          details: { agentName },
        },
        error,
      );
      this.logger?.error(mastraError.toString());
      this.logger?.trackException(mastraError);
      return [];
    }
  }
}
