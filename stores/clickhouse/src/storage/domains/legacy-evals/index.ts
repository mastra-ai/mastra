import type { ClickHouseClient } from '@clickhouse/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MetricResult, TestInfo } from '@mastra/core/eval';
import { LegacyEvalsStorage, TABLE_EVALS } from '@mastra/core/storage';
import type { EvalRow, PaginationArgs, PaginationInfo } from '@mastra/core/storage';
import type { StoreOperationsClickhouse } from '../operations';
import { transformRow } from '../utils';

export class LegacyEvalsStorageClickhouse extends LegacyEvalsStorage {
  protected client: ClickHouseClient;
  protected operations: StoreOperationsClickhouse;
  constructor({ client, operations }: { client: ClickHouseClient; operations: StoreOperationsClickhouse }) {
    super();
    this.client = client;
    this.operations = operations;
  }

  private transformEvalRow(row: Record<string, any>): EvalRow {
    row = transformRow(row);

    // Handle result field with proper null checks
    let resultValue: any;
    try {
      if (row.result && typeof row.result === 'string' && row.result.trim() !== '') {
        resultValue = JSON.parse(row.result);
      } else if (typeof row.result === 'object' && row.result !== null) {
        resultValue = row.result;
      } else if (row.result === null || row.result === undefined || row.result === '') {
        // Create a default result if none exists
        resultValue = { score: 0 };
      } else {
        throw new Error(`Invalid or empty result field: ${JSON.stringify(row.result)}`);
      }
    } catch (error) {
      console.error('Error parsing result field:', row.result, error);
      throw new MastraError({
        id: 'CLICKHOUSE_STORAGE_INVALID_RESULT_FORMAT',
        text: `Invalid result format: ${JSON.stringify(row.result)}`,
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
      });
    }

    // Handle test_info field with proper null checks
    let testInfoValue: TestInfo | undefined;
    try {
      if (
        row.test_info &&
        typeof row.test_info === 'string' &&
        row.test_info.trim() !== '' &&
        row.test_info !== 'null'
      ) {
        testInfoValue = JSON.parse(row.test_info);
      } else if (typeof row.test_info === 'object' && row.test_info !== null) {
        testInfoValue = row.test_info;
      }
    } catch {
      // If test_info parsing fails, we'll leave it as undefined
      testInfoValue = undefined;
    }

    if (!resultValue || typeof resultValue !== 'object' || !('score' in resultValue)) {
      throw new MastraError({
        id: 'CLICKHOUSE_STORAGE_INVALID_METRIC_FORMAT',
        text: `Invalid MetricResult format: ${JSON.stringify(resultValue)}`,
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
      });
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

  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    try {
      const baseQuery = `SELECT *, toDateTime64(created_at, 3) as createdAt FROM ${TABLE_EVALS} WHERE agent_name = {var_agent_name:String}`;
      const typeCondition =
        type === 'test'
          ? " AND test_info IS NOT NULL AND test_info != 'null' AND JSONExtractString(test_info, 'testPath') IS NOT NULL AND JSONExtractString(test_info, 'testPath') != ''"
          : type === 'live'
            ? " AND (test_info IS NULL OR test_info = 'null' OR JSONExtractString(test_info, 'testPath') IS NULL OR JSONExtractString(test_info, 'testPath') = '')"
            : '';

      const result = await this.client.query({
        query: `${baseQuery}${typeCondition} ORDER BY createdAt DESC`,
        query_params: { var_agent_name: agentName },
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      if (!result) {
        return [];
      }

      const rows = await result.json();
      return rows.data.map((row: any) => this.transformEvalRow(row));
    } catch (error: any) {
      if (error?.message?.includes('no such table') || error?.message?.includes('does not exist')) {
        return [];
      }
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_GET_EVALS_BY_AGENT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentName, type: type ?? null },
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
    const queryParams: Record<string, any> = {};

    if (agentName) {
      conditions.push(`agent_name = {var_agent_name:String}`);
      queryParams.var_agent_name = agentName;
    }

    if (type === 'test') {
      conditions.push(
        `(test_info IS NOT NULL AND test_info != 'null' AND JSONExtractString(test_info, 'testPath') IS NOT NULL AND JSONExtractString(test_info, 'testPath') != '')`,
      );
    } else if (type === 'live') {
      conditions.push(
        `(test_info IS NULL OR test_info = 'null' OR JSONExtractString(test_info, 'testPath') IS NULL OR JSONExtractString(test_info, 'testPath') = '')`,
      );
    }

    if (fromDate) {
      conditions.push(`created_at >= parseDateTime64BestEffort({var_from_date:String})`);
      queryParams.var_from_date = fromDate.toISOString();
    }

    if (toDate) {
      conditions.push(`created_at <= parseDateTime64BestEffort({var_to_date:String})`);
      queryParams.var_to_date = toDate.toISOString();
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const countResult = await this.client.query({
        query: `SELECT COUNT(*) as count FROM ${TABLE_EVALS} ${whereClause}`,
        query_params: {
          ...(agentName ? { var_agent_name: agentName } : {}),
          ...(fromDate ? { var_from_date: fromDate.toISOString() } : {}),
          ...(toDate ? { var_to_date: toDate.toISOString() } : {}),
        },
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      const countData = await countResult.json();
      const total = Number((countData.data?.[0] as any)?.count ?? 0);

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

      const dataResult = await this.client.query({
        query: `SELECT *, toDateTime64(createdAt, 3) as createdAt FROM ${TABLE_EVALS} ${whereClause} ORDER BY created_at DESC LIMIT {var_limit:UInt32} OFFSET {var_offset:UInt32}`,
        query_params: {
          ...(agentName ? { var_agent_name: agentName } : {}),
          ...(fromDate ? { var_from_date: fromDate.toISOString() } : {}),
          ...(toDate ? { var_to_date: toDate.toISOString() } : {}),
          var_limit: perPage || 100,
          var_offset: currentOffset || 0,
        },
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      const rows = await dataResult.json();
      return {
        evals: rows.data.map((row: any) => this.transformEvalRow(row)),
        total,
        page,
        perPage,
        hasMore,
      };
    } catch (error: any) {
      if (error?.message?.includes('no such table') || error?.message?.includes('does not exist')) {
        return {
          evals: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_GET_EVALS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentName: agentName ?? 'all', type: type ?? 'all' },
        },
        error,
      );
    }
  }
}
