import type { ClickHouseClient } from '@clickhouse/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId, SPAN_SCHEMA, ObservabilityStorage, TABLE_SPANS } from '@mastra/core/storage';
import type {
  SpanRecord,
  CreateSpanRecord,
  UpdateSpanRecord,
  TraceRecord,
  TracesPaginatedArg,
  PaginationInfo,
} from '@mastra/core/storage';
import { ClickhouseDB, resolveClickhouseConfig } from '../../db';
import type { ClickhouseDomainConfig } from '../../db';
import { TABLE_ENGINES, transformRows } from '../../db/utils';

export class ObservabilityStorageClickhouse extends ObservabilityStorage {
  protected client: ClickHouseClient;
  #db: ClickhouseDB;

  constructor(config: ClickhouseDomainConfig) {
    super();
    const { client, ttl } = resolveClickhouseConfig(config);
    this.client = client;
    this.#db = new ClickhouseDB({ client, ttl });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_SPANS, schema: SPAN_SCHEMA });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_SPANS });
  }

  async createSpan(span: CreateSpanRecord): Promise<void> {
    try {
      const now = new Date().toISOString();
      const record = {
        ...span,
        createdAt: now,
        updatedAt: now,
      };
      await this.#db.insert({ tableName: TABLE_SPANS, record });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'CREATE_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            spanId: span.spanId,
            traceId: span.traceId,
            spanType: span.spanType,
            spanName: span.name,
          },
        },
        error,
      );
    }
  }

  async getTrace(traceId: string): Promise<TraceRecord | null> {
    try {
      const engine = TABLE_ENGINES[TABLE_SPANS] ?? 'MergeTree()';
      const result = await this.client.query({
        query: `
          SELECT * 
          FROM ${TABLE_SPANS} ${engine.startsWith('ReplacingMergeTree') ? 'FINAL' : ''}
          WHERE traceId = {traceId:String}
          ORDER BY startedAt DESC
        `,
        query_params: { traceId },
        format: 'JSONEachRow',
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      const rows = (await result.json()) as any[];
      if (!rows || rows.length === 0) {
        return null;
      }

      return {
        traceId,
        spans: transformRows(rows) as SpanRecord[],
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_TRACE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { traceId },
        },
        error,
      );
    }
  }

  async updateSpan({
    spanId,
    traceId,
    updates,
  }: {
    spanId: string;
    traceId: string;
    updates: Partial<UpdateSpanRecord>;
  }): Promise<void> {
    try {
      // Load existing span
      const existing = await this.#db.load<SpanRecord>({
        tableName: TABLE_SPANS,
        keys: { spanId, traceId },
      });

      if (!existing) {
        throw new MastraError({
          id: createStorageErrorId('CLICKHOUSE', 'UPDATE_SPAN', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { spanId, traceId },
        });
      }

      // Merge updates and re-insert (ClickHouse uses ReplacingMergeTree)
      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await this.client.insert({
        table: TABLE_SPANS,
        values: [updated],
        format: 'JSONEachRow',
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'UPDATE_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { spanId, traceId },
        },
        error,
      );
    }
  }

  async getTracesPaginated({
    filters,
    pagination,
  }: TracesPaginatedArg): Promise<{ pagination: PaginationInfo; spans: SpanRecord[] }> {
    const page = pagination?.page ?? 0;
    const perPage = pagination?.perPage ?? 10;
    const { entityId, entityType, ...actualFilters } = filters || {};

    try {
      // ClickHouse stores null strings as empty strings, so check for both
      const conditions: string[] = [`(parentSpanId IS NULL OR parentSpanId = '')`];
      const values: Record<string, any> = {};

      // Apply filters
      if (actualFilters.spanType) {
        conditions.push(`spanType = {spanType:String}`);
        values.spanType = actualFilters.spanType;
      }

      if (actualFilters.name) {
        conditions.push(`name = {name:String}`);
        values.name = actualFilters.name;
      }

      // Apply date range filter
      if (pagination?.dateRange) {
        if (pagination.dateRange.start) {
          conditions.push(`startedAt >= {startDate:DateTime64(3)}`);
          values.startDate = pagination.dateRange.start.toISOString().replace('Z', '');
        }
        if (pagination.dateRange.end) {
          conditions.push(`startedAt <= {endDate:DateTime64(3)}`);
          values.endDate = pagination.dateRange.end.toISOString().replace('Z', '');
        }
      }

      // Apply entity filter
      if (entityId && entityType) {
        let name = '';
        if (entityType === 'workflow') {
          name = `workflow run: '${entityId}'`;
        } else if (entityType === 'agent') {
          name = `agent run: '${entityId}'`;
        } else {
          throw new MastraError({
            id: createStorageErrorId('CLICKHOUSE', 'GET_TRACES_PAGINATED', 'INVALID_ENTITY_TYPE'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.THIRD_PARTY,
            details: { entityType },
            text: `Cannot filter by entity type: ${entityType}`,
          });
        }
        conditions.push(`name = {entityName:String}`);
        values.entityName = name;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const engine = TABLE_ENGINES[TABLE_SPANS] ?? 'MergeTree()';

      // Get total count
      const countResult = await this.client.query({
        query: `SELECT COUNT(*) as count FROM ${TABLE_SPANS} ${engine.startsWith('ReplacingMergeTree') ? 'FINAL' : ''} ${whereClause}`,
        query_params: values,
        format: 'JSONEachRow',
      });
      const countRows = (await countResult.json()) as Array<{ count: string | number }>;
      const total = Number(countRows[0]?.count ?? 0);

      if (total === 0) {
        return {
          pagination: { total: 0, page, perPage, hasMore: false },
          spans: [],
        };
      }

      // Get paginated results
      const result = await this.client.query({
        query: `
          SELECT *
          FROM ${TABLE_SPANS} ${engine.startsWith('ReplacingMergeTree') ? 'FINAL' : ''}
          ${whereClause}
          ORDER BY startedAt DESC
          LIMIT ${perPage}
          OFFSET ${page * perPage}
        `,
        query_params: values,
        format: 'JSONEachRow',
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      const rows = (await result.json()) as any[];
      const spans = transformRows(rows) as SpanRecord[];

      return {
        pagination: {
          total,
          page,
          perPage,
          hasMore: spans.length === perPage,
        },
        spans,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_TRACES_PAGINATED', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async batchCreateSpans(args: { records: CreateSpanRecord[] }): Promise<void> {
    try {
      const now = new Date().toISOString();
      await this.#db.batchInsert({
        tableName: TABLE_SPANS,
        records: args.records.map(record => ({
          ...record,
          createdAt: now,
          updatedAt: now,
        })),
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'BATCH_CREATE_SPANS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async batchUpdateSpans(args: {
    records: {
      traceId: string;
      spanId: string;
      updates: Partial<UpdateSpanRecord>;
    }[];
  }): Promise<void> {
    try {
      const now = new Date().toISOString();

      // For each update, load existing, merge, and re-insert
      for (const record of args.records) {
        const existing = await this.#db.load<SpanRecord>({
          tableName: TABLE_SPANS,
          keys: { spanId: record.spanId, traceId: record.traceId },
        });

        if (existing) {
          const updated = {
            ...existing,
            ...record.updates,
            updatedAt: now,
          };

          await this.client.insert({
            table: TABLE_SPANS,
            values: [updated],
            format: 'JSONEachRow',
            clickhouse_settings: {
              date_time_input_format: 'best_effort',
              use_client_time_zone: 1,
              output_format_json_quote_64bit_integers: 0,
            },
          });
        }
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'BATCH_UPDATE_SPANS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async batchDeleteTraces(args: { traceIds: string[] }): Promise<void> {
    try {
      if (args.traceIds.length === 0) return;

      await this.client.command({
        query: `DELETE FROM ${TABLE_SPANS} WHERE traceId IN {traceIds:Array(String)}`,
        query_params: { traceIds: args.traceIds },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'BATCH_DELETE_TRACES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
