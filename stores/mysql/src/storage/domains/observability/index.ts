import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  listTracesArgsSchema,
  ObservabilityStorage,
  SPAN_SCHEMA,
  TABLE_SCHEMAS,
  TABLE_SPANS,
  toTraceSpans,
  TraceStatus,
} from '@mastra/core/storage';
import type {
  SpanRecord,
  ListTracesArgs,
  ListTracesResponse,
  TracingStorageStrategy,
  UpdateSpanArgs,
  BatchDeleteTracesArgs,
  BatchUpdateSpansArgs,
  BatchCreateSpansArgs,
  CreateSpanArgs,
  CreateIndexOptions,
  GetSpanArgs,
  GetSpanResponse,
  GetRootSpanArgs,
  GetRootSpanResponse,
  GetTraceArgs,
  GetTraceResponse,
  GetTraceLightResponse,
  LightSpanRecord,
} from '@mastra/core/storage';
import type { StoreOperationsMySQL } from '../operations';
import { generateTableSQL, generateIndexSQL } from '../operations';
import { formatTableName, quoteIdentifier, transformFromSqlRow } from '../utils';

const JSON_SPAN_FIELDS = ['input', 'output', 'attributes', 'metadata', 'error', 'links', 'scope', 'tags'] as const;

function serializeJsonFields(source: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const field of JSON_SPAN_FIELDS) {
    if (field in source && source[field] !== undefined) {
      result[field] = source[field] !== null ? JSON.stringify(source[field]) : null;
    }
  }
  return result;
}

export class ObservabilityMySQL extends ObservabilityStorage {
  private operations: StoreOperationsMySQL;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_SPANS] as const;

  constructor({
    operations,
    skipDefaultIndexes,
    indexes,
  }: {
    operations: StoreOperationsMySQL;
    skipDefaultIndexes?: boolean;
    indexes?: CreateIndexOptions[];
  }) {
    super();
    this.operations = operations;
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx =>
      (ObservabilityMySQL.MANAGED_TABLES as readonly string[]).includes(idx.table),
    );
  }

  async init(): Promise<void> {
    await this.operations.createTable({ tableName: TABLE_SPANS, schema: SPAN_SCHEMA });
    await this.operations.alterTable({
      tableName: TABLE_SPANS,
      schema: SPAN_SCHEMA,
      ifNotExists: Object.keys(SPAN_SCHEMA),
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  static getDefaultIndexDefs(prefix: string = ''): CreateIndexOptions[] {
    return [
      {
        name: `${prefix}mastra_ai_spans_traceid_startedat_idx`,
        table: TABLE_SPANS,
        columns: ['traceId', 'startedAt DESC'],
      },
      {
        name: `${prefix}mastra_ai_spans_parentspanid_startedat_idx`,
        table: TABLE_SPANS,
        columns: ['parentSpanId', 'startedAt DESC'],
      },
      {
        name: `${prefix}mastra_ai_spans_name_idx`,
        table: TABLE_SPANS,
        columns: ['name'],
      },
      {
        name: `${prefix}mastra_ai_spans_spantype_startedat_idx`,
        table: TABLE_SPANS,
        columns: ['spanType', 'startedAt DESC'],
      },
      {
        name: `${prefix}mastra_ai_spans_root_spans_idx`,
        table: TABLE_SPANS,
        columns: ['startedAt DESC'],
      },
    ];
  }

  static getExportDDL(): string[] {
    const statements: string[] = [];

    statements.push(
      generateTableSQL({
        tableName: TABLE_SPANS,
        schema: TABLE_SCHEMAS[TABLE_SPANS],
        compositePrimaryKey: ['traceId', 'spanId'],
      }),
    );

    for (const idx of ObservabilityMySQL.getDefaultIndexDefs()) {
      statements.push(generateIndexSQL(idx));
    }

    return statements;
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return ObservabilityMySQL.getDefaultIndexDefs('');
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      await this.operations.createIndex(indexDef);
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      await this.operations.createIndex(indexDef);
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.operations.clearTable({ tableName: TABLE_SPANS });
  }

  public override get tracingStrategy(): {
    preferred: TracingStorageStrategy;
    supported: TracingStorageStrategy[];
  } {
    return {
      preferred: 'batch-with-updates',
      supported: ['batch-with-updates', 'insert-only'],
    };
  }

  async createSpan(args: CreateSpanArgs): Promise<void> {
    const { span } = args;
    try {
      const now = new Date();
      const record = {
        ...span,
        ...serializeJsonFields(span),
        createdAt: now,
        updatedAt: now,
      };
      await this.operations.insert({ tableName: TABLE_SPANS, record });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'CREATE_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: {
            spanId: span.spanId,
            traceId: span.traceId,
            spanType: span.spanType,
            name: span.name,
          },
        },
        error,
      );
    }
  }

  async getSpan(args: GetSpanArgs): Promise<GetSpanResponse | null> {
    const { traceId, spanId } = args;
    try {
      const rows = await this.operations.loadMany<SpanRecord>({
        tableName: TABLE_SPANS,
        whereClause: {
          sql: ` WHERE ${quoteIdentifier('traceId', 'column name')} = ? AND ${quoteIdentifier('spanId', 'column name')} = ?`,
          args: [traceId, spanId],
        },
        limit: 1,
      });

      if (!rows || rows.length === 0) {
        return null;
      }

      return { span: rows[0]! };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'GET_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { traceId, spanId },
        },
        error,
      );
    }
  }

  async getRootSpan(args: GetRootSpanArgs): Promise<GetRootSpanResponse | null> {
    const { traceId } = args;
    try {
      const rows = await this.operations.loadMany<SpanRecord>({
        tableName: TABLE_SPANS,
        whereClause: {
          sql: ` WHERE ${quoteIdentifier('traceId', 'column name')} = ? AND ${quoteIdentifier('parentSpanId', 'column name')} IS NULL`,
          args: [traceId],
        },
        limit: 1,
      });

      if (!rows || rows.length === 0) {
        return null;
      }

      return { span: rows[0]! };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'GET_ROOT_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { traceId },
        },
        error,
      );
    }
  }

  async getTrace(args: GetTraceArgs): Promise<GetTraceResponse | null> {
    const { traceId } = args;
    try {
      const spans = await this.operations.loadMany<SpanRecord>({
        tableName: TABLE_SPANS,
        whereClause: {
          sql: ` WHERE ${quoteIdentifier('traceId', 'column name')} = ?`,
          args: [traceId],
        },
        orderBy: `${quoteIdentifier('startedAt', 'column name')} ASC`,
      });

      if (!spans || spans.length === 0) {
        return null;
      }

      return {
        traceId,
        spans,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'GET_TRACE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { traceId },
        },
        error,
      );
    }
  }

  async getStructure(args: GetTraceArgs): Promise<GetTraceLightResponse | null> {
    const { traceId } = args;
    try {
      const spans = await this.operations.loadMany<LightSpanRecord>({
        tableName: TABLE_SPANS,
        whereClause: {
          sql: ` WHERE ${quoteIdentifier('traceId', 'column name')} = ?`,
          args: [traceId],
        },
        orderBy: `${quoteIdentifier('startedAt', 'column name')} ASC`,
      });

      if (!spans || spans.length === 0) {
        return null;
      }

      // Strip heavy fields (input, output, attributes, metadata, tags, links) for lightweight response
      const lightSpans: LightSpanRecord[] = spans.map(span => ({
        traceId: span.traceId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId,
        name: span.name,
        entityType: span.entityType,
        entityId: span.entityId,
        entityName: span.entityName,
        spanType: span.spanType,
        error: span.error,
        isEvent: span.isEvent,
        startedAt: span.startedAt,
        endedAt: span.endedAt,
        createdAt: span.createdAt,
        updatedAt: span.updatedAt,
      }));

      return {
        traceId,
        spans: lightSpans,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'GET_STRUCTURE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { traceId },
        },
        error,
      );
    }
  }

  async updateSpan(args: UpdateSpanArgs): Promise<void> {
    const { traceId, spanId, updates } = args;
    try {
      const data: Record<string, any> = {
        ...updates,
        ...serializeJsonFields(updates),
        updatedAt: new Date(),
      };

      await this.operations.update({
        tableName: TABLE_SPANS,
        keys: { spanId, traceId },
        data,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'UPDATE_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { spanId, traceId },
        },
        error,
      );
    }
  }

  async listTraces(args: ListTracesArgs): Promise<ListTracesResponse> {
    const { filters, pagination, orderBy } = listTracesArgsSchema.parse(args);
    const { page, perPage } = pagination;

    const tbl = formatTableName(TABLE_SPANS);

    try {
      const conditions: string[] = [`${quoteIdentifier('parentSpanId', 'column name')} IS NULL`];
      const queryArgs: any[] = [];

      if (filters) {
        // Date range filters
        if (filters.startedAt?.start) {
          conditions.push(`${quoteIdentifier('startedAt', 'column name')} >= ?`);
          queryArgs.push(filters.startedAt.start);
        }
        if (filters.startedAt?.end) {
          conditions.push(`${quoteIdentifier('startedAt', 'column name')} <= ?`);
          queryArgs.push(filters.startedAt.end);
        }
        if (filters.endedAt?.start) {
          conditions.push(`${quoteIdentifier('endedAt', 'column name')} >= ?`);
          queryArgs.push(filters.endedAt.start);
        }
        if (filters.endedAt?.end) {
          conditions.push(`${quoteIdentifier('endedAt', 'column name')} <= ?`);
          queryArgs.push(filters.endedAt.end);
        }

        // Span type filter
        if (filters.spanType !== undefined) {
          conditions.push(`${quoteIdentifier('spanType', 'column name')} = ?`);
          queryArgs.push(filters.spanType);
        }

        // Entity filters
        if (filters.entityType !== undefined) {
          conditions.push(`${quoteIdentifier('entityType', 'column name')} = ?`);
          queryArgs.push(filters.entityType);
        }
        if (filters.entityId !== undefined) {
          conditions.push(`${quoteIdentifier('entityId', 'column name')} = ?`);
          queryArgs.push(filters.entityId);
        }
        if (filters.entityName !== undefined) {
          conditions.push(`${quoteIdentifier('entityName', 'column name')} = ?`);
          queryArgs.push(filters.entityName);
        }

        // Identity & tenancy filters
        if (filters.userId !== undefined) {
          conditions.push(`${quoteIdentifier('userId', 'column name')} = ?`);
          queryArgs.push(filters.userId);
        }
        if (filters.organizationId !== undefined) {
          conditions.push(`${quoteIdentifier('organizationId', 'column name')} = ?`);
          queryArgs.push(filters.organizationId);
        }
        if (filters.resourceId !== undefined) {
          conditions.push(`${quoteIdentifier('resourceId', 'column name')} = ?`);
          queryArgs.push(filters.resourceId);
        }

        // Correlation ID filters
        if (filters.runId !== undefined) {
          conditions.push(`${quoteIdentifier('runId', 'column name')} = ?`);
          queryArgs.push(filters.runId);
        }
        if (filters.sessionId !== undefined) {
          conditions.push(`${quoteIdentifier('sessionId', 'column name')} = ?`);
          queryArgs.push(filters.sessionId);
        }
        if (filters.threadId !== undefined) {
          conditions.push(`${quoteIdentifier('threadId', 'column name')} = ?`);
          queryArgs.push(filters.threadId);
        }
        if (filters.requestId !== undefined) {
          conditions.push(`${quoteIdentifier('requestId', 'column name')} = ?`);
          queryArgs.push(filters.requestId);
        }

        // Deployment context filters
        if (filters.environment !== undefined) {
          conditions.push(`${quoteIdentifier('environment', 'column name')} = ?`);
          queryArgs.push(filters.environment);
        }
        if (filters.source !== undefined) {
          conditions.push(`${quoteIdentifier('source', 'column name')} = ?`);
          queryArgs.push(filters.source);
        }
        if (filters.serviceName !== undefined) {
          conditions.push(`${quoteIdentifier('serviceName', 'column name')} = ?`);
          queryArgs.push(filters.serviceName);
        }

        // Scope filter (JSON containment - MySQL uses JSON_EXTRACT)
        if (filters.scope != null) {
          for (const [key, value] of Object.entries(filters.scope)) {
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
              throw new MastraError({
                id: createStorageErrorId('MYSQL', 'LIST_TRACES', 'INVALID_FILTER_KEY'),
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.USER,
                details: { key },
              });
            }
            conditions.push(`JSON_EXTRACT(${quoteIdentifier('scope', 'column name')}, '$.${key}') = ?`);
            queryArgs.push(typeof value === 'string' ? value : JSON.stringify(value));
          }
        }

        // Metadata filter (JSON containment)
        if (filters.metadata != null) {
          for (const [key, value] of Object.entries(filters.metadata)) {
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
              throw new MastraError({
                id: createStorageErrorId('MYSQL', 'LIST_TRACES', 'INVALID_FILTER_KEY'),
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.USER,
                details: { key },
              });
            }
            if (typeof value === 'string') {
              conditions.push(
                `JSON_UNQUOTE(JSON_EXTRACT(${quoteIdentifier('metadata', 'column name')}, '$.${key}')) = ?`,
              );
              queryArgs.push(value);
            } else {
              conditions.push(
                `JSON_EXTRACT(${quoteIdentifier('metadata', 'column name')}, '$.${key}') = CAST(? AS JSON)`,
              );
              queryArgs.push(JSON.stringify(value));
            }
          }
        }

        // Tags filter (all tags must be present - MySQL uses JSON_CONTAINS)
        if (filters.tags != null && filters.tags.length > 0) {
          for (const tag of filters.tags) {
            conditions.push(`JSON_CONTAINS(${quoteIdentifier('tags', 'column name')}, ?, '$')`);
            queryArgs.push(JSON.stringify(tag));
          }
        }

        // Status filter (derived from error and endedAt)
        if (filters.status !== undefined) {
          switch (filters.status) {
            case TraceStatus.ERROR:
              conditions.push(`${quoteIdentifier('error', 'column name')} IS NOT NULL`);
              break;
            case TraceStatus.RUNNING:
              conditions.push(
                `${quoteIdentifier('endedAt', 'column name')} IS NULL AND ${quoteIdentifier('error', 'column name')} IS NULL`,
              );
              break;
            case TraceStatus.SUCCESS:
              conditions.push(
                `${quoteIdentifier('endedAt', 'column name')} IS NOT NULL AND ${quoteIdentifier('error', 'column name')} IS NULL`,
              );
              break;
          }
        }

        // hasChildError filter (requires subquery)
        if (filters.hasChildError !== undefined) {
          if (filters.hasChildError) {
            conditions.push(`EXISTS (
              SELECT 1 FROM ${tbl} c
              WHERE c.${quoteIdentifier('traceId', 'column name')} = ${tbl}.${quoteIdentifier('traceId', 'column name')}
                AND c.${quoteIdentifier('parentSpanId', 'column name')} IS NOT NULL
                AND c.${quoteIdentifier('error', 'column name')} IS NOT NULL
            )`);
          } else {
            conditions.push(`NOT EXISTS (
              SELECT 1 FROM ${tbl} c
              WHERE c.${quoteIdentifier('traceId', 'column name')} = ${tbl}.${quoteIdentifier('traceId', 'column name')}
                AND c.${quoteIdentifier('parentSpanId', 'column name')} IS NOT NULL
                AND c.${quoteIdentifier('error', 'column name')} IS NOT NULL
            )`);
          }
        }
      }

      const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

      // Order by clause with proper NULL handling for endedAt
      // MySQL's natural behavior: NULLs are "smaller" than any value
      //   - ASC: NULLs first (natural)
      //   - DESC: NULLs last (natural)
      // We need CASE WHEN workarounds for endedAt to get desired ordering
      const sortDirection = orderBy.direction;
      const traceIdField = quoteIdentifier('traceId', 'column name');
      const spanIdField = quoteIdentifier('spanId', 'column name');
      let orderByClause: string;
      if (orderBy.field === 'durationMs') {
        const startedAtField = quoteIdentifier('startedAt', 'column name');
        const endedAtField = quoteIdentifier('endedAt', 'column name');
        orderByClause = `CASE WHEN ${endedAtField} IS NULL THEN 1 ELSE 0 END, GREATEST(0, TIMESTAMPDIFF(MICROSECOND, ${startedAtField}, ${endedAtField}) / 1000) ${sortDirection}, ${traceIdField} ${sortDirection}, ${spanIdField} ${sortDirection}`;
      } else if (orderBy.field === 'endedAt') {
        const sortField = quoteIdentifier(orderBy.field, 'column name');
        orderByClause =
          sortDirection === 'DESC'
            ? `CASE WHEN ${sortField} IS NULL THEN 0 ELSE 1 END, ${sortField} DESC, ${traceIdField} DESC, ${spanIdField} DESC`
            : `CASE WHEN ${sortField} IS NULL THEN 1 ELSE 0 END, ${sortField} ASC, ${traceIdField} ASC, ${spanIdField} ASC`;
      } else {
        const sortField = quoteIdentifier(orderBy.field, 'column name');
        orderByClause = `${sortField} ${sortDirection}, ${traceIdField} ${sortDirection}, ${spanIdField} ${sortDirection}`;
      }

      // Get total count
      const count = await this.operations.loadTotalCount({
        tableName: TABLE_SPANS,
        whereClause: { sql: whereClause, args: queryArgs },
      });

      if (count === 0) {
        return {
          pagination: {
            total: 0,
            page,
            perPage,
            hasMore: false,
          },
          spans: [],
        };
      }

      // Use raw query to support CASE WHEN in ORDER BY (sanitizeOrderBy in loadMany rejects it)
      const offset = page * perPage;
      const selectSql = `SELECT * FROM ${tbl}${whereClause} ORDER BY ${orderByClause} LIMIT ${Math.max(0, perPage)} OFFSET ${Math.max(0, offset)}`;
      const rawRows = await this.operations.query(selectSql, queryArgs);
      const spans = rawRows.map(row => transformFromSqlRow<SpanRecord>({ tableName: TABLE_SPANS, sqlRow: row as any }));

      return {
        pagination: {
          total: count,
          page,
          perPage,
          hasMore: (page + 1) * perPage < count,
        },
        spans: toTraceSpans(spans),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'LIST_TRACES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchCreateSpans(args: BatchCreateSpansArgs): Promise<void> {
    try {
      if (!args.records.length) {
        return;
      }
      const now = new Date();
      await this.operations.batchInsert({
        tableName: TABLE_SPANS,
        records: args.records.map(record => ({
          ...record,
          ...serializeJsonFields(record),
          createdAt: now,
          updatedAt: now,
        })),
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'BATCH_CREATE_SPANS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchUpdateSpans(args: BatchUpdateSpansArgs): Promise<void> {
    try {
      if (!args.records.length) {
        return;
      }
      const now = new Date();
      await this.operations.batchUpdate({
        tableName: TABLE_SPANS,
        items: args.records.map(record => ({
          keys: { spanId: record.spanId, traceId: record.traceId },
          data: {
            ...record.updates,
            ...serializeJsonFields(record.updates),
            updatedAt: now,
          },
        })),
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'BATCH_UPDATE_SPANS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchDeleteTraces(args: BatchDeleteTracesArgs): Promise<void> {
    try {
      if (!args.traceIds.length) {
        return;
      }
      const keys = args.traceIds.map(traceId => ({ traceId }));
      await this.operations.batchDelete({
        tableName: TABLE_SPANS,
        keys,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'BATCH_DELETE_TRACES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }
}
