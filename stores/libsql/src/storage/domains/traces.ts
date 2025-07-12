import type { Client, InValue } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { MastraTracesStorage, TABLE_TRACES } from '@mastra/core/storage';
import type { PaginationInfo, PaginationArgs } from '@mastra/core/storage';
import type { Trace } from '@mastra/core/telemetry';
import { parseSqlIdentifier } from '@mastra/core/utils';
import { safelyParseJSON } from '../utils';
import type { LibSQLInternalStore } from './store';

export class TracesStorage extends MastraTracesStorage {
  #client: Client;
  constructor({ client, store }: { client: Client; store: LibSQLInternalStore }) {
    super({ store });
    this.#client = client;
  }

  /**
   * @deprecated use getTracesPaginated instead.
   */
  public async getTraces(args: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
    filters?: Record<string, any>;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<Trace[]> {
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

  public async getTracesPaginated(
    args: {
      name?: string;
      scope?: string;
      attributes?: Record<string, string>;
      filters?: Record<string, any>;
    } & PaginationArgs,
  ): Promise<PaginationInfo & { traces: Trace[] }> {
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
      const countResult = await this.#client.execute({
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

      const dataResult = await this.#client.execute({
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
              status: safelyParseJSON(row.status as string),
              events: safelyParseJSON(row.events as string),
              links: safelyParseJSON(row.links as string),
              attributes: safelyParseJSON(row.attributes as string),
              startTime: row.startTime,
              endTime: row.endTime,
              other: safelyParseJSON(row.other as string),
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

  async insertTraces({ records }: { records: Record<string, any>[] }): Promise<void> {
    try {
      await this.store.insert({
        name: TABLE_TRACES,
        record: records,
      });
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'LIBSQL_STORE_INSERT_TRACES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { recordsCount: records.length },
        },
        error,
      );
      this.logger?.trackException?.(mastraError);
      this.logger?.error?.(mastraError.toString());
      throw mastraError;
    }
  }
}
