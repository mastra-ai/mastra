import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId, ObservabilityStorage, TABLE_SPANS, TraceStatus } from '@mastra/core/storage';
import type {
  SpanRecord,
  TraceRecord,
  CreateSpanRecord,
  PaginationInfo,
  UpdateSpanRecord,
  ListTracesArgs,
  TracingStorageStrategy,
} from '@mastra/core/storage';
import type { ConnectionPool } from 'mssql';
import type { StoreOperationsMSSQL } from '../operations';
import { transformFromSqlRow, getTableName, getSchemaName } from '../utils';

export class ObservabilityMSSQL extends ObservabilityStorage {
  public pool: ConnectionPool;
  private operations: StoreOperationsMSSQL;
  private schema?: string;

  constructor({
    pool,
    operations,
    schema,
  }: {
    pool: ConnectionPool;
    operations: StoreOperationsMSSQL;
    schema?: string;
  }) {
    super();
    this.pool = pool;
    this.operations = operations;
    this.schema = schema;
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

  async createSpan(span: CreateSpanRecord): Promise<void> {
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

      return this.operations.insert({ tableName: TABLE_SPANS, record });
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

  async getTrace(traceId: string): Promise<TraceRecord | null> {
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
      const data: Record<string, any> = { ...updates };
      if (data.endedAt instanceof Date) {
        data.endedAt = data.endedAt.toISOString();
      }
      if (data.startedAt instanceof Date) {
        data.startedAt = data.startedAt.toISOString();
      }

      await this.operations.update({
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

  async listTraces({
    filters,
    pagination,
    orderBy,
  }: ListTracesArgs): Promise<{ pagination: PaginationInfo; spans: SpanRecord[] }> {
    const page = pagination?.page ?? 0;
    const perPage = pagination?.perPage ?? 100;

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
        if (filters.scope !== undefined) {
          for (const [key, value] of Object.entries(filters.scope)) {
            const param = `p${paramIndex++}`;
            conditions.push(`JSON_VALUE(r.[scope], '$.${key}') = @${param}`);
            params[param] = typeof value === 'string' ? value : JSON.stringify(value);
          }
        }

        // Metadata filter (JSON_VALUE)
        if (filters.metadata !== undefined) {
          for (const [key, value] of Object.entries(filters.metadata)) {
            const param = `p${paramIndex++}`;
            conditions.push(`JSON_VALUE(r.[metadata], '$.${key}') = @${param}`);
            params[param] = typeof value === 'string' ? value : JSON.stringify(value);
          }
        }

        // Tags filter (all tags must be present - using OPENJSON)
        if (filters.tags !== undefined && filters.tags.length > 0) {
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

      // Order by clause
      const sortField = orderBy?.field === 'endedAt' ? 'endedAt' : 'startedAt';
      const sortDirection = orderBy?.direction === 'ASC' ? 'ASC' : 'DESC';

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

  async batchCreateSpans(args: { records: CreateSpanRecord[] }): Promise<void> {
    if (!args.records || args.records.length === 0) {
      return;
    }

    try {
      const now = new Date().toISOString();
      await this.operations.batchInsert({
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

  async batchUpdateSpans(args: {
    records: {
      traceId: string;
      spanId: string;
      updates: Partial<UpdateSpanRecord>;
    }[];
  }): Promise<void> {
    if (!args.records || args.records.length === 0) {
      return;
    }

    try {
      const updates = args.records.map(({ traceId, spanId, updates: data }) => {
        const processedData: Record<string, any> = { ...data };
        if (processedData.endedAt instanceof Date) {
          processedData.endedAt = processedData.endedAt.toISOString();
        }
        if (processedData.startedAt instanceof Date) {
          processedData.startedAt = processedData.startedAt.toISOString();
        }

        return {
          keys: { spanId, traceId },
          data: processedData,
        };
      });

      await this.operations.batchUpdate({
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

  async batchDeleteTraces(args: { traceIds: string[] }): Promise<void> {
    if (!args.traceIds || args.traceIds.length === 0) {
      return;
    }

    try {
      const keys = args.traceIds.map(traceId => ({ traceId }));

      await this.operations.batchDelete({
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
