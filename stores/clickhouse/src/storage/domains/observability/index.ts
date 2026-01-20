import type { ClickHouseClient } from '@clickhouse/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  listTracesArgsSchema,
  ObservabilityStorage,
  SPAN_SCHEMA,
  TABLE_SPANS,
  TraceStatus,
} from '@mastra/core/storage';
import type {
  SpanRecord,
  ListTracesArgs,
  PaginationInfo,
  TracingStorageStrategy,
  UpdateSpanArgs,
  BatchDeleteTracesArgs,
  BatchUpdateSpansArgs,
  BatchCreateSpansArgs,
  CreateSpanArgs,
  GetSpanArgs,
  GetSpanResponse,
  GetRootSpanArgs,
  GetRootSpanResponse,
  GetTraceArgs,
  GetTraceResponse,
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

  public override get tracingStrategy(): {
    preferred: TracingStorageStrategy;
    supported: TracingStorageStrategy[];
  } {
    // ClickHouse is optimized for append-only workloads, so the tracing exporter
    // should use insert-only mode (wait for trace-end events, then insert complete spans).
    // Note: updateSpan/batchUpdateSpans are still available for manual modifications.
    return {
      preferred: 'insert-only',
      supported: ['insert-only'],
    };
  }

  async createSpan(args: CreateSpanArgs): Promise<void> {
    const { span } = args;
    try {
      const now = Date.now();
      const record = {
        ...span,
        // Convert Date objects to millisecond timestamps for DateTime64(3)
        startedAt: span.startedAt instanceof Date ? span.startedAt.getTime() : span.startedAt,
        endedAt: span.endedAt instanceof Date ? span.endedAt.getTime() : span.endedAt,
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

  async getSpan(args: GetSpanArgs): Promise<GetSpanResponse | null> {
    const { traceId, spanId } = args;
    try {
      const engine = TABLE_ENGINES[TABLE_SPANS] ?? 'MergeTree()';
      const result = await this.client.query({
        query: `
          SELECT *
          FROM ${TABLE_SPANS} ${engine.startsWith('ReplacingMergeTree') ? 'FINAL' : ''}
          WHERE traceId = {traceId:String} AND spanId = {spanId:String}
          LIMIT 1
        `,
        query_params: { traceId, spanId },
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

      const spans = transformRows(rows) as SpanRecord[];
      const span = spans[0];
      if (!span) {
        return null;
      }
      return { span };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { traceId, spanId },
        },
        error,
      );
    }
  }

  async getRootSpan(args: GetRootSpanArgs): Promise<GetRootSpanResponse | null> {
    const { traceId } = args;
    try {
      const engine = TABLE_ENGINES[TABLE_SPANS] ?? 'MergeTree()';
      const result = await this.client.query({
        query: `
          SELECT *
          FROM ${TABLE_SPANS} ${engine.startsWith('ReplacingMergeTree') ? 'FINAL' : ''}
          WHERE traceId = {traceId:String} AND (parentSpanId IS NULL OR parentSpanId = '')
          LIMIT 1
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

      const spans = transformRows(rows) as SpanRecord[];
      const span = spans[0];
      if (!span) {
        return null;
      }
      return { span };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_ROOT_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { traceId },
        },
        error,
      );
    }
  }

  async getTrace(args: GetTraceArgs): Promise<GetTraceResponse | null> {
    const { traceId } = args;
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

  async updateSpan(args: UpdateSpanArgs): Promise<void> {
    const { traceId, spanId, updates } = args;
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

      // Handle Date conversions to millisecond timestamps for DateTime64(3)
      const data: Record<string, any> = { ...updates };
      if (data.endedAt instanceof Date) {
        data.endedAt = data.endedAt.getTime();
      }
      if (data.startedAt instanceof Date) {
        data.startedAt = data.startedAt.getTime();
      }

      // Merge updates and re-insert (ClickHouse uses ReplacingMergeTree)
      const updated = {
        ...existing,
        ...data,
        updatedAt: Date.now(),
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

  async listTraces(args: ListTracesArgs): Promise<{ pagination: PaginationInfo; spans: SpanRecord[] }> {
    // Parse args through schema to apply defaults
    const { filters, pagination, orderBy } = listTracesArgsSchema.parse(args);
    const { page, perPage } = pagination;

    try {
      // ClickHouse stores null strings as empty strings, so check for both
      const conditions: string[] = [`(parentSpanId IS NULL OR parentSpanId = '')`];
      const values: Record<string, any> = {};
      let paramIndex = 0;

      if (filters) {
        // Date range filters
        if (filters.startedAt?.start) {
          conditions.push(`startedAt >= {startedAtStart:DateTime64(3)}`);
          // Use Unix timestamp in milliseconds for DateTime64(3)
          values.startedAtStart = filters.startedAt.start.getTime();
        }
        if (filters.startedAt?.end) {
          conditions.push(`startedAt <= {startedAtEnd:DateTime64(3)}`);
          values.startedAtEnd = filters.startedAt.end.getTime();
        }
        if (filters.endedAt?.start) {
          conditions.push(`endedAt >= {endedAtStart:DateTime64(3)}`);
          values.endedAtStart = filters.endedAt.start.getTime();
        }
        if (filters.endedAt?.end) {
          conditions.push(`endedAt <= {endedAtEnd:DateTime64(3)}`);
          values.endedAtEnd = filters.endedAt.end.getTime();
        }

        // Span type filter
        if (filters.spanType !== undefined) {
          conditions.push(`spanType = {spanType:String}`);
          values.spanType = filters.spanType;
        }

        // Entity filters
        if (filters.entityType !== undefined) {
          conditions.push(`entityType = {entityType:String}`);
          values.entityType = filters.entityType;
        }
        if (filters.entityId !== undefined) {
          conditions.push(`entityId = {entityId:String}`);
          values.entityId = filters.entityId;
        }
        if (filters.entityName !== undefined) {
          conditions.push(`entityName = {entityName:String}`);
          values.entityName = filters.entityName;
        }

        // Identity & Tenancy filters
        if (filters.userId !== undefined) {
          conditions.push(`userId = {userId:String}`);
          values.userId = filters.userId;
        }
        if (filters.organizationId !== undefined) {
          conditions.push(`organizationId = {organizationId:String}`);
          values.organizationId = filters.organizationId;
        }
        if (filters.resourceId !== undefined) {
          conditions.push(`resourceId = {resourceId:String}`);
          values.resourceId = filters.resourceId;
        }

        // Correlation ID filters
        if (filters.runId !== undefined) {
          conditions.push(`runId = {runId:String}`);
          values.runId = filters.runId;
        }
        if (filters.sessionId !== undefined) {
          conditions.push(`sessionId = {sessionId:String}`);
          values.sessionId = filters.sessionId;
        }
        if (filters.threadId !== undefined) {
          conditions.push(`threadId = {threadId:String}`);
          values.threadId = filters.threadId;
        }
        if (filters.requestId !== undefined) {
          conditions.push(`requestId = {requestId:String}`);
          values.requestId = filters.requestId;
        }

        // Deployment context filters
        if (filters.environment !== undefined) {
          conditions.push(`environment = {environment:String}`);
          values.environment = filters.environment;
        }
        if (filters.source !== undefined) {
          conditions.push(`source = {source:String}`);
          values.source = filters.source;
        }
        if (filters.serviceName !== undefined) {
          conditions.push(`serviceName = {serviceName:String}`);
          values.serviceName = filters.serviceName;
        }

        // Scope filter (JSON field - use JSONExtractString for each key)
        if (filters.scope != null) {
          for (const [key, value] of Object.entries(filters.scope)) {
            // Validate key to prevent injection in JSON path
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
              throw new MastraError({
                id: createStorageErrorId('CLICKHOUSE', 'LIST_TRACES', 'INVALID_FILTER_KEY'),
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.USER,
                details: { key },
              });
            }
            const paramName = `scope_${key}_${paramIndex++}`;
            conditions.push(`JSONExtractString(scope, '${key}') = {${paramName}:String}`);
            values[paramName] = typeof value === 'string' ? value : JSON.stringify(value);
          }
        }

        // Metadata filter (JSON field)
        if (filters.metadata != null) {
          for (const [key, value] of Object.entries(filters.metadata)) {
            // Validate key to prevent injection in JSON path
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
              throw new MastraError({
                id: createStorageErrorId('CLICKHOUSE', 'LIST_TRACES', 'INVALID_FILTER_KEY'),
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.USER,
                details: { key },
              });
            }
            const paramName = `metadata_${key}_${paramIndex++}`;
            conditions.push(`JSONExtractString(metadata, '${key}') = {${paramName}:String}`);
            values[paramName] = typeof value === 'string' ? value : JSON.stringify(value);
          }
        }

        // Tags filter (all tags must be present)
        // ClickHouse stores tags as JSON array string, use JSONExtract to check
        if (filters.tags != null && filters.tags.length > 0) {
          for (const tag of filters.tags) {
            const paramName = `tag_${paramIndex++}`;
            conditions.push(`has(JSONExtract(tags, 'Array(String)'), {${paramName}:String})`);
            values[paramName] = tag;
          }
        }

        // Status filter (derived from error and endedAt)
        if (filters.status !== undefined) {
          switch (filters.status) {
            case TraceStatus.ERROR:
              // ClickHouse stores null as empty string for String columns
              conditions.push(`(error IS NOT NULL AND error != '')`);
              break;
            case TraceStatus.RUNNING:
              // endedAt is DateTime64 - only check for NULL (not empty string)
              // error is String - check for both NULL and empty string
              conditions.push(`endedAt IS NULL AND (error IS NULL OR error = '')`);
              break;
            case TraceStatus.SUCCESS:
              // endedAt is DateTime64 - only check for NULL (not empty string)
              // error is String - check for both NULL and empty string
              conditions.push(`endedAt IS NOT NULL AND (error IS NULL OR error = '')`);
              break;
          }
        }

        // hasChildError filter (requires subquery)
        if (filters.hasChildError !== undefined) {
          const engine = TABLE_ENGINES[TABLE_SPANS] ?? 'MergeTree()';
          const finalClause = engine.startsWith('ReplacingMergeTree') ? 'FINAL' : '';
          if (filters.hasChildError) {
            conditions.push(`EXISTS (
              SELECT 1 FROM ${TABLE_SPANS} ${finalClause} c
              WHERE c.traceId = ${TABLE_SPANS}.traceId AND c.error IS NOT NULL AND c.error != ''
            )`);
          } else {
            conditions.push(`NOT EXISTS (
              SELECT 1 FROM ${TABLE_SPANS} ${finalClause} c
              WHERE c.traceId = ${TABLE_SPANS}.traceId AND c.error IS NOT NULL AND c.error != ''
            )`);
          }
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const engine = TABLE_ENGINES[TABLE_SPANS] ?? 'MergeTree()';
      const finalClause = engine.startsWith('ReplacingMergeTree') ? 'FINAL' : '';

      // Order by clause with proper NULL handling for endedAt
      // For endedAt DESC: NULLs FIRST (running spans on top when viewing newest)
      // For endedAt ASC: NULLs LAST (running spans at end when viewing oldest)
      // startedAt is never null (required field), so no special handling needed
      // Note: endedAt is DateTime64 - only check for NULL (not empty string like String columns)
      const sortField = orderBy.field;
      const sortDirection = orderBy.direction;
      let orderClause: string;
      if (sortField === 'endedAt') {
        // Use CASE WHEN to handle NULLs for endedAt (DateTime64 column)
        // DESC: NULLs first (0 sorts before 1)
        // ASC: NULLs last (1 sorts after 0)
        const nullSortValue = sortDirection === 'DESC' ? 0 : 1;
        const nonNullSortValue = sortDirection === 'DESC' ? 1 : 0;
        orderClause = `ORDER BY CASE WHEN ${sortField} IS NULL THEN ${nullSortValue} ELSE ${nonNullSortValue} END, ${sortField} ${sortDirection}`;
      } else {
        orderClause = `ORDER BY ${sortField} ${sortDirection}`;
      }

      // Get total count
      const countResult = await this.client.query({
        query: `SELECT COUNT(*) as count FROM ${TABLE_SPANS} ${finalClause} ${whereClause}`,
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
          FROM ${TABLE_SPANS} ${finalClause}
          ${whereClause}
          ${orderClause}
          LIMIT {limit:UInt32}
          OFFSET {offset:UInt32}
        `,
        query_params: { ...values, limit: perPage, offset: page * perPage },
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
          hasMore: (page + 1) * perPage < total,
        },
        spans,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'LIST_TRACES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchCreateSpans(args: BatchCreateSpansArgs): Promise<void> {
    try {
      const now = Date.now();
      await this.#db.batchInsert({
        tableName: TABLE_SPANS,
        records: args.records.map(record => ({
          ...record,
          // Convert Date objects to millisecond timestamps for DateTime64(3)
          startedAt: record.startedAt instanceof Date ? record.startedAt.getTime() : record.startedAt,
          endedAt: record.endedAt instanceof Date ? record.endedAt.getTime() : record.endedAt,
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

  async batchUpdateSpans(args: BatchUpdateSpansArgs): Promise<void> {
    try {
      const now = Date.now();

      // Note: ClickHouse doesn't support traditional UPDATE operations with MergeTree engines.
      // Updates are performed by loading existing data, merging changes, and re-inserting.
      // This sequential processing may be slow for large batches - consider batching at the
      // application level if high-volume updates are needed.
      // For each update, load existing, merge, and re-insert
      for (const record of args.records) {
        const existing = await this.#db.load<SpanRecord>({
          tableName: TABLE_SPANS,
          keys: { spanId: record.spanId, traceId: record.traceId },
        });

        if (existing) {
          // Convert Date objects to millisecond timestamps for DateTime64(3)
          const updates: Record<string, any> = { ...record.updates };
          if (updates.startedAt instanceof Date) {
            updates.startedAt = updates.startedAt.getTime();
          }
          if (updates.endedAt instanceof Date) {
            updates.endedAt = updates.endedAt.getTime();
          }

          const updated = {
            ...existing,
            ...updates,
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

  async batchDeleteTraces(args: BatchDeleteTracesArgs): Promise<void> {
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
