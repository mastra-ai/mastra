import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MetricResult } from '@mastra/core/eval';
import { LegacyEvalsStorage, TABLE_EVALS } from '@mastra/core/storage';
import type { PaginationArgs, PaginationInfo, EvalRow } from '@mastra/core/storage';
import sql from 'mssql';
import { getSchemaName, getTableName } from '../utils';

function transformEvalRow(row: Record<string, any>): EvalRow {
  let testInfoValue = null,
    resultValue = null;
  if (row.test_info) {
    try {
      testInfoValue = typeof row.test_info === 'string' ? JSON.parse(row.test_info) : row.test_info;
    } catch {}
  }
  if (row.test_info) {
    try {
      resultValue = typeof row.result === 'string' ? JSON.parse(row.result) : row.result;
    } catch {}
  }
  return {
    agentName: row.agent_name as string,
    input: row.input as string,
    output: row.output as string,
    result: resultValue as MetricResult,
    metricName: row.metric_name as string,
    instructions: row.instructions as string,
    testInfo: testInfoValue,
    globalRunId: row.global_run_id as string,
    runId: row.run_id as string,
    createdAt: row.created_at as string,
  };
}

export class LegacyEvalsMSSQL extends LegacyEvalsStorage {
  private pool: sql.ConnectionPool;
  private schema: string;
  constructor({ pool, schema }: { pool: sql.ConnectionPool; schema: string }) {
    super();
    this.pool = pool;
    this.schema = schema;
  }

  /** @deprecated use getEvals instead */
  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    try {
      let query = `SELECT * FROM ${getTableName({ indexName: TABLE_EVALS, schemaName: getSchemaName(this.schema) })} WHERE agent_name = @p1`;
      if (type === 'test') {
        query += " AND test_info IS NOT NULL AND JSON_VALUE(test_info, '$.testPath') IS NOT NULL";
      } else if (type === 'live') {
        query += " AND (test_info IS NULL OR JSON_VALUE(test_info, '$.testPath') IS NULL)";
      }
      query += ' ORDER BY created_at DESC';

      const request = this.pool.request();
      request.input('p1', agentName);
      const result = await request.query(query);
      const rows = result.recordset;
      return typeof transformEvalRow === 'function'
        ? (rows?.map((row: any) => transformEvalRow(row)) ?? [])
        : (rows ?? []);
    } catch (error: any) {
      if (error && error.number === 208 && error.message && error.message.includes('Invalid object name')) {
        return [];
      }
      console.error('Failed to get evals for the specified agent: ' + error?.message);
      throw error;
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

    const where: string[] = [];
    const params: Record<string, any> = {};

    if (agentName) {
      where.push('agent_name = @agentName');
      params['agentName'] = agentName;
    }

    if (type === 'test') {
      where.push("test_info IS NOT NULL AND JSON_VALUE(test_info, '$.testPath') IS NOT NULL");
    } else if (type === 'live') {
      where.push("(test_info IS NULL OR JSON_VALUE(test_info, '$.testPath') IS NULL)");
    }

    if (fromDate instanceof Date && !isNaN(fromDate.getTime())) {
      where.push(`[created_at] >= @fromDate`);
      params[`fromDate`] = fromDate.toISOString();
    }

    if (toDate instanceof Date && !isNaN(toDate.getTime())) {
      where.push(`[created_at] <= @toDate`);
      params[`toDate`] = toDate.toISOString();
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const tableName = getTableName({ indexName: TABLE_EVALS, schemaName: getSchemaName(this.schema) });
    const offset = page * perPage;

    const countQuery = `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`;
    const dataQuery = `SELECT * FROM ${tableName} ${whereClause} ORDER BY seq_id DESC OFFSET @offset ROWS FETCH NEXT @perPage ROWS ONLY`;

    try {
      const countReq = this.pool.request();
      Object.entries(params).forEach(([key, value]) => {
        if (value instanceof Date) {
          countReq.input(key, sql.DateTime, value);
        } else {
          countReq.input(key, value);
        }
      });
      const countResult = await countReq.query(countQuery);
      const total = countResult.recordset[0]?.total || 0;

      if (total === 0) {
        return {
          evals: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      const req = this.pool.request();
      Object.entries(params).forEach(([key, value]) => {
        if (value instanceof Date) {
          req.input(key, sql.DateTime, value);
        } else {
          req.input(key, value);
        }
      });
      req.input('offset', offset);
      req.input('perPage', perPage);

      const result = await req.query(dataQuery);
      const rows = result.recordset;

      return {
        evals: rows?.map(row => transformEvalRow(row)) ?? [],
        total,
        page,
        perPage,
        hasMore: offset + (rows?.length ?? 0) < total,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_GET_EVALS_FAILED',
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
