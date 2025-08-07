import type { ClickHouseClient } from '@clickhouse/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { safelyParseJSON, TABLE_SCHEMAS, TABLE_TRACES, TracesStorage } from '@mastra/core/storage';
import type { PaginationInfo, StorageGetTracesPaginatedArg, StorageGetTracesArg } from '@mastra/core/storage';
import type { Trace } from '@mastra/core/telemetry';
import type { StoreOperationsClickhouse } from '../operations';

export class TracesStorageClickhouse extends TracesStorage {
  protected client: ClickHouseClient;
  protected operations: StoreOperationsClickhouse;

  constructor({ client, operations }: { client: ClickHouseClient; operations: StoreOperationsClickhouse }) {
    super();
    this.client = client;
    this.operations = operations;
  }

  async getTracesPaginated(args: StorageGetTracesPaginatedArg): Promise<PaginationInfo & { traces: Trace[] }> {
    const { name, scope, page = 0, perPage = 100, attributes, filters, dateRange } = args;
    const fromDate = dateRange?.start;
    const toDate = dateRange?.end;
    const currentOffset = page * perPage;

    const queryArgs: Record<string, any> = {};
    const conditions: string[] = [];

    if (name) {
      conditions.push(`name LIKE CONCAT({var_name:String}, '%')`);
      queryArgs.var_name = name;
    }
    if (scope) {
      conditions.push(`scope = {var_scope:String}`);
      queryArgs.var_scope = scope;
    }
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        conditions.push(`JSONExtractString(attributes, '${key}') = {var_attr_${key}:String}`);
        queryArgs[`var_attr_${key}`] = value;
      });
    }
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        conditions.push(`${key} = {var_col_${key}:${TABLE_SCHEMAS.mastra_traces?.[key]?.type ?? 'text'}}`);
        queryArgs[`var_col_${key}`] = value;
      });
    }
    if (fromDate) {
      conditions.push(`createdAt >= parseDateTime64BestEffort({var_from_date:String})`);
      queryArgs.var_from_date = fromDate.toISOString();
    }
    if (toDate) {
      conditions.push(`createdAt <= parseDateTime64BestEffort({var_to_date:String})`);
      queryArgs.var_to_date = toDate.toISOString();
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      // Get total count
      const countResult = await this.client.query({
        query: `SELECT COUNT(*) as count FROM ${TABLE_TRACES} ${whereClause}`,
        query_params: queryArgs,
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      const countData = await countResult.json();
      const total = Number((countData.data?.[0] as any)?.count ?? 0);

      if (total === 0) {
        return {
          traces: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      // Get traces with pagination
      const result = await this.client.query({
        query: `SELECT *, toDateTime64(createdAt, 3) as createdAt FROM ${TABLE_TRACES} ${whereClause} ORDER BY "createdAt" DESC LIMIT {var_limit:UInt32} OFFSET {var_offset:UInt32}`,
        query_params: { ...queryArgs, var_limit: perPage, var_offset: currentOffset },
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      if (!result) {
        return {
          traces: [],
          total,
          page,
          perPage,
          hasMore: false,
        };
      }

      const resp = await result.json();
      const rows: any[] = resp.data;
      const traces = rows.map(row => ({
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
      }));

      return {
        traces,
        total,
        page,
        perPage,
        hasMore: currentOffset + traces.length < total,
      };
    } catch (error: any) {
      if (error?.message?.includes('no such table') || error?.message?.includes('does not exist')) {
        return {
          traces: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_GET_TRACES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            name: name ?? null,
            scope: scope ?? null,
            page,
            perPage,
            attributes: attributes ? JSON.stringify(attributes) : null,
            filters: filters ? JSON.stringify(filters) : null,
            dateRange: dateRange ? JSON.stringify(dateRange) : null,
          },
        },
        error,
      );
    }
  }

  async getTraces({
    name,
    scope,
    page,
    perPage,
    attributes,
    filters,
    fromDate,
    toDate,
  }: StorageGetTracesArg): Promise<any[]> {
    const limit = perPage;
    const offset = page * perPage;

    const args: Record<string, any> = {};

    const conditions: string[] = [];
    if (name) {
      conditions.push(`name LIKE CONCAT({var_name:String}, '%')`);
      args.var_name = name;
    }
    if (scope) {
      conditions.push(`scope = {var_scope:String}`);
      args.var_scope = scope;
    }
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        conditions.push(`JSONExtractString(attributes, '${key}') = {var_attr_${key}:String}`);
        args[`var_attr_${key}`] = value;
      });
    }

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        conditions.push(`${key} = {var_col_${key}:${TABLE_SCHEMAS.mastra_traces?.[key]?.type ?? 'text'}}`);
        args[`var_col_${key}`] = value;
      });
    }

    if (fromDate) {
      conditions.push(`createdAt >= {var_from_date:DateTime64(3)}`);
      args.var_from_date = fromDate.getTime() / 1000; // Convert to Unix timestamp
    }

    if (toDate) {
      conditions.push(`createdAt <= {var_to_date:DateTime64(3)}`);
      args.var_to_date = toDate.getTime() / 1000; // Convert to Unix timestamp
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const result = await this.client.query({
        query: `SELECT *, toDateTime64(createdAt, 3) as createdAt FROM ${TABLE_TRACES} ${whereClause} ORDER BY "createdAt" DESC LIMIT ${limit} OFFSET ${offset}`,
        query_params: args,
        clickhouse_settings: {
          // Allows to insert serialized JS Dates (such as '2023-12-06T10:54:48.000Z')
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      if (!result) {
        return [];
      }

      const resp = await result.json();
      const rows: any[] = resp.data;
      return rows.map(row => ({
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
      }));
    } catch (error: any) {
      if (error?.message?.includes('no such table') || error?.message?.includes('does not exist')) {
        return [];
      }
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_GET_TRACES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            name: name ?? null,
            scope: scope ?? null,
            page,
            perPage,
            attributes: attributes ? JSON.stringify(attributes) : null,
            filters: filters ? JSON.stringify(filters) : null,
            fromDate: fromDate?.toISOString() ?? null,
            toDate: toDate?.toISOString() ?? null,
          },
        },
        error,
      );
    }
  }

  async batchTraceInsert(args: { records: Trace[] }): Promise<void> {
    await this.operations.batchInsert({ tableName: TABLE_TRACES, records: args.records });
  }
}
