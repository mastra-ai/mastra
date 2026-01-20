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
  PaginationInfo,
  ListTracesArgs,
  TracingStorageStrategy,
  BatchUpdateSpansArgs,
  BatchDeleteTracesArgs,
  BatchCreateSpansArgs,
  UpdateSpanArgs,
  GetTraceArgs,
  GetTraceResponse,
  GetSpanArgs,
  GetSpanResponse,
  GetRootSpanArgs,
  GetRootSpanResponse,
  CreateSpanArgs,
  CreateIndexOptions,
} from '@mastra/core/storage';
import type { ConnectionPool } from 'mssql';
import { MssqlDB, resolveMssqlConfig } from '../../db';
import type { MssqlDomainConfig } from '../../db';
import { transformFromSqlRow, getTableName, getSchemaName } from '../utils';

export class ObservabilityMSSQL extends ObservabilityStorage {
  public pool: ConnectionPool;
  private db: MssqlDB;
  private schema?: string;
  private needsConnect: boolean;
  private skipDefaultIndexes?: boolean;
  private indexes?: CreateIndexOptions[];

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [TABLE_SPANS] as const;

  constructor(config: MssqlDomainConfig) {
    super();
    const { pool, schemaName, skipDefaultIndexes, indexes, needsConnect } = resolveMssqlConfig(config);
    this.pool = pool;
    this.schema = schemaName;
    this.db = new MssqlDB({ pool, schemaName, skipDefaultIndexes });
    this.needsConnect = needsConnect;
    this.skipDefaultIndexes = skipDefaultIndexes;
    // Filter indexes to only those for tables managed by this domain
    this.indexes = indexes?.filter(idx => (ObservabilityMSSQL.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    if (this.needsConnect) {
      await this.pool.connect();
      this.needsConnect = false;
    }
    await this.db.createTable({ tableName: TABLE_SPANS, schema: SPAN_SCHEMA });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  /**
   * Returns default index definitions for the observability domain tables.
   */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.schema ? `${this.schema}_` : '';
    return [
      {
        name: `${schemaPrefix}mastra_ai_spans_traceid_startedat_idx`,
        table: TABLE_SPANS,
        columns: ['traceId', 'startedAt DESC'],
      },
      {
        name: `${schemaPrefix}mastra_ai_spans_parentspanid_startedat_idx`,
        table: TABLE_SPANS,
        columns: ['parentSpanId', 'startedAt DESC'],
      },
      {
        name: `${schemaPrefix}mastra_ai_spans_name_idx`,
        table: TABLE_SPANS,
        columns: ['name'],
      },
      {
        name: `${schemaPrefix}mastra_ai_spans_spantype_startedat_idx`,
        table: TABLE_SPANS,
        columns: ['spanType', 'startedAt DESC'],
      },
      // Root spans filtered index - every listTraces query filters parentSpanId IS NULL
      {
        name: `${schemaPrefix}mastra_ai_spans_root_spans_idx`,
        table: TABLE_SPANS,
        columns: ['startedAt DESC'],
        where: '[parentSpanId] IS NULL',
      },
      // Entity identification indexes - common filtering patterns
      {
        name: `${schemaPrefix}mastra_ai_spans_entitytype_entityid_idx`,
        table: TABLE_SPANS,
        columns: ['entityType', 'entityId'],
      },
      {
        name: `${schemaPrefix}mastra_ai_spans_entitytype_entityname_idx`,
        table: TABLE_SPANS,
        columns: ['entityType', 'entityName'],
      },
      // Multi-tenant filtering - organizationId + userId
      {
        name: `${schemaPrefix}mastra_ai_spans_orgid_userid_idx`,
        table: TABLE_SPANS,
        columns: ['organizationId', 'userId'],
      },
      // Note: MSSQL doesn't support GIN indexes for JSONB/array containment queries
      // Metadata and tags filtering will use full table scans on NVARCHAR(MAX) columns
    ];
  }

  /**
   * Creates default indexes for optimal query performance.
   */
  async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) {
      return;
    }

    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.db.createIndex(indexDef);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create index ${indexDef.name}:`, error);
      }
    }
  }

  /**
   * Creates custom user-defined indexes for this domain's tables.
   */
  async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) {
      return;
    }

    for (const indexDef of this.indexes) {
      try {
        await this.db.createIndex(indexDef);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_SPANS });
  }

  /**
   * Manually run the spans migration to deduplicate and add the unique constraint.
   * This is intended to be called from the CLI when duplicates are detected.
   *
   * @returns Migration result with status and details
   */
  async migrateSpans(): Promise<{
    success: boolean;
    alreadyMigrated: boolean;
    duplicatesRemoved: number;
    message: string;
  }> {
    return this.db.migrateSpans();
  }

  /**
   * Check migration status for the spans table.
   * Returns information about whether migration is needed.
   */
  async checkSpansMigrationStatus(): Promise<{
    needsMigration: boolean;
    hasDuplicates: boolean;
    duplicateCount: number;
    constraintExists: boolean;
    tableName: string;
  }> {
    return this.db.checkSpansMigrationStatus();
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
      const startedAt = span.startedAt instanceof Date ? span.startedAt.toISOString() : span.startedAt;
      const endedAt = span.endedAt instanceof Date ? span.endedAt.toISOString() : span.endedAt;
      const now = new Date().toISOString();

      const record = {
        ...span,
        startedAt,
        endedAt,
        createdAt: now,
        updatedAt: now,
      };

      return this.db.insert({ tableName: TABLE_SPANS, record });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'CREATE_SPAN', 'FAILED'),
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

  async getTrace(args: GetTraceArgs): Promise<GetTraceResponse | null> {
    const { traceId } = args;
    try {
      const tableName = getTableName({
        indexName: TABLE_SPANS,
        schemaName: getSchemaName(this.schema),
      });

      const request = this.pool.request();
      request.input('traceId', traceId);

      const result = await request.query<SpanRecord>(
        `SELECT
          [traceId], [spanId], [parentSpanId], [name],
          [entityType], [entityId], [entityName],
          [userId], [organizationId], [resourceId],
          [runId], [sessionId], [threadId], [requestId],
          [environment], [source], [serviceName], [scope],
          [spanType], [attributes], [metadata], [tags], [links],
          [input], [output], [error], [isEvent],
          [startedAt], [endedAt], [createdAt], [updatedAt]
        FROM ${tableName}
        WHERE [traceId] = @traceId
        ORDER BY [startedAt] ASC`,
      );

      if (!result.recordset || result.recordset.length === 0) {
        return null;
      }

      return {
        traceId,
        spans: result.recordset.map(span =>
          transformFromSqlRow<SpanRecord>({
            tableName: TABLE_SPANS,
            sqlRow: span,
          }),
        ),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'GET_TRACE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: {
            traceId,
          },
        },
        error,
      );
    }
  }

  async getSpan(args: GetSpanArgs): Promise<GetSpanResponse | null> {
    const { traceId, spanId } = args;
    try {
      const tableName = getTableName({
        indexName: TABLE_SPANS,
        schemaName: getSchemaName(this.schema),
      });

      const request = this.pool.request();
      request.input('traceId', traceId);
      request.input('spanId', spanId);

      const result = await request.query<SpanRecord>(
        `SELECT
          [traceId], [spanId], [parentSpanId], [name],
          [entityType], [entityId], [entityName],
          [userId], [organizationId], [resourceId],
          [runId], [sessionId], [threadId], [requestId],
          [environment], [source], [serviceName], [scope],
          [spanType], [attributes], [metadata], [tags], [links],
          [input], [output], [error], [isEvent],
          [startedAt], [endedAt], [createdAt], [updatedAt]
        FROM ${tableName}
        WHERE [traceId] = @traceId AND [spanId] = @spanId`,
      );

      if (!result.recordset || result.recordset.length === 0) {
        return null;
      }

      return {
        span: transformFromSqlRow<SpanRecord>({
          tableName: TABLE_SPANS,
          sqlRow: result.recordset[0]!,
        }),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'GET_SPAN', 'FAILED'),
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
      const tableName = getTableName({
        indexName: TABLE_SPANS,
        schemaName: getSchemaName(this.schema),
      });

      const request = this.pool.request();
      request.input('traceId', traceId);

      const result = await request.query<SpanRecord>(
        `SELECT
          [traceId], [spanId], [parentSpanId], [name],
          [entityType], [entityId], [entityName],
          [userId], [organizationId], [resourceId],
          [runId], [sessionId], [threadId], [requestId],
          [environment], [source], [serviceName], [scope],
          [spanType], [attributes], [metadata], [tags], [links],
          [input], [output], [error], [isEvent],
          [startedAt], [endedAt], [createdAt], [updatedAt]
        FROM ${tableName}
        WHERE [traceId] = @traceId AND [parentSpanId] IS NULL`,
      );

      if (!result.recordset || result.recordset.length === 0) {
        return null;
      }

      return {
        span: transformFromSqlRow<SpanRecord>({
          tableName: TABLE_SPANS,
          sqlRow: result.recordset[0]!,
        }),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'GET_ROOT_SPAN', 'FAILED'),
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
      const data: Record<string, any> = { ...updates };
      if (data.endedAt instanceof Date) {
        data.endedAt = data.endedAt.toISOString();
      }
      if (data.startedAt instanceof Date) {
        data.startedAt = data.startedAt.toISOString();
      }
      data.updatedAt = new Date().toISOString();

      await this.db.update({
        tableName: TABLE_SPANS,
        keys: { spanId, traceId },
        data,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'UPDATE_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: {
            spanId,
            traceId,
          },
        },
        error,
      );
    }
  }

  async listTraces(args: ListTracesArgs): Promise<{ pagination: PaginationInfo; spans: SpanRecord[] }> {
    // Parse args through schema to apply defaults
    const { filters, pagination, orderBy } = listTracesArgsSchema.parse(args);
    const { page, perPage } = pagination;

    const tableName = getTableName({
      indexName: TABLE_SPANS,
      schemaName: getSchemaName(this.schema),
    });

    try {
      // Build WHERE clause for filters
      const conditions: string[] = ['r.[parentSpanId] IS NULL']; // Only root spans
      const params: Record<string, any> = {};
      let paramIndex = 1;

      if (filters) {
        // Date range filters
        if (filters.startedAt?.start) {
          const param = `p${paramIndex++}`;
          conditions.push(`r.[startedAt] >= @${param}`);
          params[param] = filters.startedAt.start.toISOString();
        }
        if (filters.startedAt?.end) {
          const param = `p${paramIndex++}`;
          conditions.push(`r.[startedAt] <= @${param}`);
          params[param] = filters.startedAt.end.toISOString();
        }
        if (filters.endedAt?.start) {
          const param = `p${paramIndex++}`;
          conditions.push(`r.[endedAt] >= @${param}`);
          params[param] = filters.endedAt.start.toISOString();
        }
        if (filters.endedAt?.end) {
          const param = `p${paramIndex++}`;
          conditions.push(`r.[endedAt] <= @${param}`);
          params[param] = filters.endedAt.end.toISOString();
        }

        // Span type filter
        if (filters.spanType !== undefined) {
          const param = `p${paramIndex++}`;
          conditions.push(`r.[spanType] = @${param}`);
          params[param] = filters.spanType;
        }

        // Entity filters
        if (filters.entityType !== undefined) {
          const param = `p${paramIndex++}`;
          conditions.push(`r.[entityType] = @${param}`);
          params[param] = filters.entityType;
        }
        if (filters.entityId !== undefined) {
          const param = `p${paramIndex++}`;
          conditions.push(`r.[entityId] = @${param}`);
          params[param] = filters.entityId;
        }
        if (filters.entityName !== undefined) {
          const param = `p${paramIndex++}`;
          conditions.push(`r.[entityName] = @${param}`);
          params[param] = filters.entityName;
        }

        // Identity & Tenancy filters
        if (filters.userId !== undefined) {
          const param = `p${paramIndex++}`;
          conditions.push(`r.[userId] = @${param}`);
          params[param] = filters.userId;
        }
        if (filters.organizationId !== undefined) {
          const param = `p${paramIndex++}`;
          conditions.push(`r.[organizationId] = @${param}`);
          params[param] = filters.organizationId;
        }
        if (filters.resourceId !== undefined) {
          const param = `p${paramIndex++}`;
          conditions.push(`r.[resourceId] = @${param}`);
          params[param] = filters.resourceId;
        }

        // Correlation ID filters
        if (filters.runId !== undefined) {
          const param = `p${paramIndex++}`;
          conditions.push(`r.[runId] = @${param}`);
          params[param] = filters.runId;
        }
        if (filters.sessionId !== undefined) {
          const param = `p${paramIndex++}`;
          conditions.push(`r.[sessionId] = @${param}`);
          params[param] = filters.sessionId;
        }
        if (filters.threadId !== undefined) {
          const param = `p${paramIndex++}`;
          conditions.push(`r.[threadId] = @${param}`);
          params[param] = filters.threadId;
        }
        if (filters.requestId !== undefined) {
          const param = `p${paramIndex++}`;
          conditions.push(`r.[requestId] = @${param}`);
          params[param] = filters.requestId;
        }

        // Deployment context filters
        if (filters.environment !== undefined) {
          const param = `p${paramIndex++}`;
          conditions.push(`r.[environment] = @${param}`);
          params[param] = filters.environment;
        }
        if (filters.source !== undefined) {
          const param = `p${paramIndex++}`;
          conditions.push(`r.[source] = @${param}`);
          params[param] = filters.source;
        }
        if (filters.serviceName !== undefined) {
          const param = `p${paramIndex++}`;
          conditions.push(`r.[serviceName] = @${param}`);
          params[param] = filters.serviceName;
        }

        // Scope filter (MSSQL uses JSON_VALUE for extraction)
        if (filters.scope != null) {
          for (const [key, value] of Object.entries(filters.scope)) {
            // Validate key to prevent SQL injection in JSON path
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
              throw new MastraError({
                id: createStorageErrorId('MSSQL', 'LIST_TRACES', 'INVALID_FILTER_KEY'),
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.USER,
                details: { key },
              });
            }
            const param = `p${paramIndex++}`;
            conditions.push(`JSON_VALUE(r.[scope], '$.${key}') = @${param}`);
            params[param] = typeof value === 'string' ? value : JSON.stringify(value);
          }
        }

        // Metadata filter (JSON_VALUE)
        if (filters.metadata != null) {
          for (const [key, value] of Object.entries(filters.metadata)) {
            // Validate key to prevent SQL injection in JSON path
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
              throw new MastraError({
                id: createStorageErrorId('MSSQL', 'LIST_TRACES', 'INVALID_FILTER_KEY'),
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.USER,
                details: { key },
              });
            }
            const param = `p${paramIndex++}`;
            conditions.push(`JSON_VALUE(r.[metadata], '$.${key}') = @${param}`);
            params[param] = typeof value === 'string' ? value : JSON.stringify(value);
          }
        }

        // Tags filter (all tags must be present - using OPENJSON)
        if (filters.tags != null && filters.tags.length > 0) {
          for (const tag of filters.tags) {
            const param = `p${paramIndex++}`;
            conditions.push(`EXISTS (SELECT 1 FROM OPENJSON(r.[tags]) WHERE [value] = @${param})`);
            params[param] = tag;
          }
        }

        // Status filter (derived from error and endedAt)
        if (filters.status !== undefined) {
          switch (filters.status) {
            case TraceStatus.ERROR:
              conditions.push(`r.[error] IS NOT NULL`);
              break;
            case TraceStatus.RUNNING:
              conditions.push(`r.[endedAt] IS NULL AND r.[error] IS NULL`);
              break;
            case TraceStatus.SUCCESS:
              conditions.push(`r.[endedAt] IS NOT NULL AND r.[error] IS NULL`);
              break;
          }
        }

        // hasChildError filter (requires subquery)
        if (filters.hasChildError !== undefined) {
          if (filters.hasChildError) {
            conditions.push(`EXISTS (
              SELECT 1 FROM ${tableName} c
              WHERE c.[traceId] = r.[traceId] AND c.[error] IS NOT NULL
            )`);
          } else {
            conditions.push(`NOT EXISTS (
              SELECT 1 FROM ${tableName} c
              WHERE c.[traceId] = r.[traceId] AND c.[error] IS NOT NULL
            )`);
          }
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const sortField = orderBy.field;
      const sortDirection = orderBy.direction;

      // Get total count
      const countRequest = this.pool.request();
      Object.entries(params).forEach(([key, value]) => {
        countRequest.input(key, value);
      });

      const countResult = await countRequest.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${tableName} r ${whereClause}`,
      );
      const count = countResult.recordset[0]?.count ?? 0;

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

      // Get paginated spans
      const dataRequest = this.pool.request();
      Object.entries(params).forEach(([key, value]) => {
        dataRequest.input(key, value);
      });
      dataRequest.input('offset', page * perPage);
      dataRequest.input('limit', perPage);

      const result = await dataRequest.query<SpanRecord>(
        `SELECT
          r.[traceId], r.[spanId], r.[parentSpanId], r.[name],
          r.[entityType], r.[entityId], r.[entityName],
          r.[userId], r.[organizationId], r.[resourceId],
          r.[runId], r.[sessionId], r.[threadId], r.[requestId],
          r.[environment], r.[source], r.[serviceName], r.[scope],
          r.[spanType], r.[attributes], r.[metadata], r.[tags], r.[links],
          r.[input], r.[output], r.[error], r.[isEvent],
          r.[startedAt], r.[endedAt], r.[createdAt], r.[updatedAt]
        FROM ${tableName} r
        ${whereClause}
        ORDER BY r.[${sortField}] ${sortDirection}
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      );

      return {
        pagination: {
          total: count,
          page,
          perPage,
          hasMore: (page + 1) * perPage < count,
        },
        spans: result.recordset.map(span =>
          transformFromSqlRow<SpanRecord>({
            tableName: TABLE_SPANS,
            sqlRow: span,
          }),
        ),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'LIST_TRACES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchCreateSpans(args: BatchCreateSpansArgs): Promise<void> {
    if (!args.records || args.records.length === 0) {
      return;
    }

    try {
      const now = new Date().toISOString();
      await this.db.batchInsert({
        tableName: TABLE_SPANS,
        records: args.records.map(span => ({
          ...span,
          startedAt: span.startedAt instanceof Date ? span.startedAt.toISOString() : span.startedAt,
          endedAt: span.endedAt instanceof Date ? span.endedAt.toISOString() : span.endedAt,
          createdAt: now,
          updatedAt: now,
        })),
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'BATCH_CREATE_SPANS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: {
            count: args.records.length,
          },
        },
        error,
      );
    }
  }

  async batchUpdateSpans(args: BatchUpdateSpansArgs): Promise<void> {
    if (!args.records || args.records.length === 0) {
      return;
    }
    const now = new Date().toISOString();

    try {
      const updates = args.records.map(({ traceId, spanId, updates: data }) => {
        const processedData: Record<string, any> = { ...data };
        if (processedData.endedAt instanceof Date) {
          processedData.endedAt = processedData.endedAt.toISOString();
        }
        if (processedData.startedAt instanceof Date) {
          processedData.startedAt = processedData.startedAt.toISOString();
        }
        processedData.updatedAt = now;

        return {
          keys: { spanId, traceId },
          data: processedData,
        };
      });

      await this.db.batchUpdate({
        tableName: TABLE_SPANS,
        updates,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'BATCH_UPDATE_SPANS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: {
            count: args.records.length,
          },
        },
        error,
      );
    }
  }

  async batchDeleteTraces(args: BatchDeleteTracesArgs): Promise<void> {
    if (!args.traceIds || args.traceIds.length === 0) {
      return;
    }

    try {
      const keys = args.traceIds.map(traceId => ({ traceId }));

      await this.db.batchDelete({
        tableName: TABLE_SPANS,
        keys,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'BATCH_DELETE_TRACES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: {
            count: args.traceIds.length,
          },
        },
        error,
      );
    }
  }
}
