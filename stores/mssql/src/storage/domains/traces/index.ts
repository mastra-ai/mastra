import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { PaginationInfo, PaginationArgs } from '@mastra/core/storage';
import { TABLE_TRACES, TracesStorage } from '@mastra/core/storage';
import { parseFieldKey } from '@mastra/core/utils';
import sql from 'mssql';
import type { StoreOperationsMSSQL } from '../operations';
import { getSchemaName, getTableName } from '../utils';

export class TracesMSSQL extends TracesStorage {
  public pool: sql.ConnectionPool;
  private operations: StoreOperationsMSSQL;
  private schema?: string;

  constructor({
    pool,
    operations,
    schema,
  }: {
    pool: sql.ConnectionPool;
    operations: StoreOperationsMSSQL;
    schema?: string;
  }) {
    super();
    this.pool = pool;
    this.operations = operations;
    this.schema = schema;
  }

  /** @deprecated use getTracesPaginated instead*/
  public async getTraces(args: {
    name?: string;
    scope?: string;
    attributes?: Record<string, string>;
    filters?: Record<string, any>;
    page: number;
    perPage?: number;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<any[]> {
    if (args.fromDate || args.toDate) {
      (args as any).dateRange = {
        start: args.fromDate,
        end: args.toDate,
      };
    }
    const result = await this.getTracesPaginated(args);
    return result.traces;
  }

  public async getTracesPaginated(
    args: {
      name?: string;
      scope?: string;
      attributes?: Record<string, string>;
      filters?: Record<string, any>;
    } & PaginationArgs,
  ): Promise<
    PaginationInfo & {
      traces: any[];
    }
  > {
    const { name, scope, page = 0, perPage: perPageInput, attributes, filters, dateRange } = args;
    const fromDate = dateRange?.start;
    const toDate = dateRange?.end;

    const perPage = perPageInput !== undefined ? perPageInput : 100;
    const currentOffset = page * perPage;

    const paramMap: Record<string, any> = {};
    const conditions: string[] = [];
    let paramIndex = 1;

    if (name) {
      const paramName = `p${paramIndex++}`;
      conditions.push(`[name] LIKE @${paramName}`);
      paramMap[paramName] = `${name}%`;
    }
    if (scope) {
      const paramName = `p${paramIndex++}`;
      conditions.push(`[scope] = @${paramName}`);
      paramMap[paramName] = scope;
    }
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        const parsedKey = parseFieldKey(key);
        const paramName = `p${paramIndex++}`;
        conditions.push(`JSON_VALUE([attributes], '$.${parsedKey}') = @${paramName}`);
        paramMap[paramName] = value;
      });
    }
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        const parsedKey = parseFieldKey(key);
        const paramName = `p${paramIndex++}`;
        conditions.push(`[${parsedKey}] = @${paramName}`);
        paramMap[paramName] = value;
      });
    }
    if (fromDate instanceof Date && !isNaN(fromDate.getTime())) {
      const paramName = `p${paramIndex++}`;
      conditions.push(`[createdAt] >= @${paramName}`);
      paramMap[paramName] = fromDate.toISOString();
    }
    if (toDate instanceof Date && !isNaN(toDate.getTime())) {
      const paramName = `p${paramIndex++}`;
      conditions.push(`[createdAt] <= @${paramName}`);
      paramMap[paramName] = toDate.toISOString();
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) as total FROM ${getTableName({ indexName: TABLE_TRACES, schemaName: getSchemaName(this.schema) })} ${whereClause}`;
    let total = 0;
    try {
      const countRequest = this.pool.request();
      Object.entries(paramMap).forEach(([key, value]) => {
        if (value instanceof Date) {
          countRequest.input(key, sql.DateTime, value);
        } else {
          countRequest.input(key, value);
        }
      });
      const countResult = await countRequest.query(countQuery);
      total = parseInt(countResult.recordset[0].total, 10);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_GET_TRACES_PAGINATED_FAILED_TO_RETRIEVE_TOTAL_COUNT',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            name: args.name ?? '',
            scope: args.scope ?? '',
          },
        },
        error,
      );
    }

    if (total === 0) {
      return {
        traces: [],
        total: 0,
        page,
        perPage,
        hasMore: false,
      };
    }

    const dataQuery = `SELECT * FROM ${getTableName({ indexName: TABLE_TRACES, schemaName: getSchemaName(this.schema) })} ${whereClause} ORDER BY [seq_id] DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
    const dataRequest = this.pool.request();
    Object.entries(paramMap).forEach(([key, value]) => {
      if (value instanceof Date) {
        dataRequest.input(key, sql.DateTime, value);
      } else {
        dataRequest.input(key, value);
      }
    });
    dataRequest.input('offset', currentOffset);
    dataRequest.input('limit', perPage);

    try {
      const rowsResult = await dataRequest.query(dataQuery);
      const rows = rowsResult.recordset;
      const traces = rows.map(row => ({
        id: row.id,
        parentSpanId: row.parentSpanId,
        traceId: row.traceId,
        name: row.name,
        scope: row.scope,
        kind: row.kind,
        status: JSON.parse(row.status),
        events: JSON.parse(row.events),
        links: JSON.parse(row.links),
        attributes: JSON.parse(row.attributes),
        startTime: row.startTime,
        endTime: row.endTime,
        other: row.other,
        createdAt: row.createdAt,
      }));

      return {
        traces,
        total,
        page,
        perPage,
        hasMore: currentOffset + traces.length < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_GET_TRACES_PAGINATED_FAILED_TO_RETRIEVE_TRACES',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            name: args.name ?? '',
            scope: args.scope ?? '',
          },
        },
        error,
      );
    }
  }

  async batchTraceInsert({ records }: { records: Record<string, any>[] }): Promise<void> {
    this.logger.debug('Batch inserting traces', { count: records.length });
    await this.operations.batchInsert({
      tableName: TABLE_TRACES,
      records,
    });
  }
}
