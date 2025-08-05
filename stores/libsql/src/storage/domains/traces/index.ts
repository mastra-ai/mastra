import type { Client, InValue } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { TABLE_TRACES, TracesStorage, safelyParseJSON } from '@mastra/core/storage';
import type { StorageGetTracesArg, StorageGetTracesPaginatedArg, PaginationInfo } from '@mastra/core/storage';
import type { Trace } from '@mastra/core/telemetry';
import { parseSqlIdentifier } from '@mastra/core/utils';
import type { StoreOperationsLibSQL } from '../operations';

export class TracesLibSQL extends TracesStorage {
  private client: Client;
  private operations: StoreOperationsLibSQL;

  constructor({ client, operations }: { client: Client; operations: StoreOperationsLibSQL }) {
    super();
    this.client = client;
    this.operations = operations;
  }

  async getTraces(args: StorageGetTracesArg): Promise<Trace[]> {
    if (args.fromDate || args.toDate) {
      (args as any).dateRange = {
        start: args.fromDate,
        end: args.toDate,
      };
    }
    try {
      const result = await this.getTracesPaginated(args);
      return result.traces;
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_GET_TRACES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getTracesPaginated(args: StorageGetTracesPaginatedArg): Promise<PaginationInfo & { traces: Trace[] }> {
    const { name, scope, page = 0, perPage = 100, attributes, filters, dateRange } = args;
    const fromDate = dateRange?.start;
    const toDate = dateRange?.end;
    const currentOffset = page * perPage;

    const queryArgs: InValue[] = [];
    const conditions: string[] = [];

    if (name) {
      conditions.push('name LIKE ?');
      queryArgs.push(`${name}%`);
    }
    if (scope) {
      conditions.push('scope = ?');
      queryArgs.push(scope);
    }
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        conditions.push(`json_extract(attributes, '$.${key}') = ?`);
        queryArgs.push(value);
      });
    }
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        conditions.push(`${parseSqlIdentifier(key, 'filter key')} = ?`);
        queryArgs.push(value);
      });
    }
    if (fromDate) {
      conditions.push('createdAt >= ?');
      queryArgs.push(fromDate.toISOString());
    }
    if (toDate) {
      conditions.push('createdAt <= ?');
      queryArgs.push(toDate.toISOString());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const countResult = await this.client.execute({
        sql: `SELECT COUNT(*) as count FROM ${TABLE_TRACES} ${whereClause}`,
        args: queryArgs,
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          traces: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      const dataResult = await this.client.execute({
        sql: `SELECT * FROM ${TABLE_TRACES} ${whereClause} ORDER BY "startTime" DESC LIMIT ? OFFSET ?`,
        args: [...queryArgs, perPage, currentOffset],
      });

      const traces =
        dataResult.rows?.map(
          row =>
            ({
              id: row.id,
              parentSpanId: row.parentSpanId,
              traceId: row.traceId,
              name: row.name,
              scope: row.scope,
              kind: row.kind,
              status: safelyParseJSON(row.status),
              events: safelyParseJSON(row.events),
              links: safelyParseJSON(row.links),
              attributes: safelyParseJSON(row.attributes),
              startTime: row.startTime,
              endTime: row.endTime,
              other: safelyParseJSON(row.other),
              createdAt: row.createdAt,
            }) as Trace,
        ) ?? [];

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
          id: 'LIBSQL_STORE_GET_TRACES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
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
