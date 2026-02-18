import type { Client, InValue } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  listTracesArgsSchema,
  ObservabilityStorage,
  SPAN_SCHEMA,
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
  DeleteTracesOlderThanArgs,
  DeleteTracesOlderThanResponse,
  GetSpanArgs,
  GetSpanResponse,
  GetRootSpanArgs,
  GetRootSpanResponse,
  GetTraceArgs,
  GetTraceResponse,
} from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import { transformFromSqlRow } from '../../db/utils';

export class ObservabilityLibSQL extends ObservabilityStorage {
  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_SPANS, schema: SPAN_SCHEMA });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_SPANS });
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
    return this.#db.migrateSpans();
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
    return this.#db.checkSpansMigrationStatus();
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
      return this.#db.insert({ tableName: TABLE_SPANS, record });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CREATE_SPAN', 'FAILED'),
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
      const rows = await this.#db.selectMany<SpanRecord>({
        tableName: TABLE_SPANS,
        whereClause: { sql: ' WHERE traceId = ? AND spanId = ?', args: [traceId, spanId] },
        limit: 1,
      });

      if (!rows || rows.length === 0) {
        return null;
      }

      return {
        span: transformFromSqlRow<SpanRecord>({ tableName: TABLE_SPANS, sqlRow: rows[0]! }),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_SPAN', 'FAILED'),
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
      const rows = await this.#db.selectMany<SpanRecord>({
        tableName: TABLE_SPANS,
        whereClause: { sql: ' WHERE traceId = ? AND parentSpanId IS NULL', args: [traceId] },
        limit: 1,
      });

      if (!rows || rows.length === 0) {
        return null;
      }

      return {
        span: transformFromSqlRow<SpanRecord>({ tableName: TABLE_SPANS, sqlRow: rows[0]! }),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_ROOT_SPAN', 'FAILED'),
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
      const spans = await this.#db.selectMany<SpanRecord>({
        tableName: TABLE_SPANS,
        whereClause: { sql: ' WHERE traceId = ?', args: [traceId] },
        orderBy: 'startedAt ASC',
      });

      if (!spans || spans.length === 0) {
        return null;
      }

      return {
        traceId,
        spans: spans.map(span => transformFromSqlRow<SpanRecord>({ tableName: TABLE_SPANS, sqlRow: span })),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_TRACE', 'FAILED'),
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

      await this.#db.update({
        tableName: TABLE_SPANS,
        keys: { spanId, traceId },
        data,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'UPDATE_SPAN', 'FAILED'),
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

  async listTraces(args: ListTracesArgs): Promise<ListTracesResponse> {
    // Parse args through schema to apply defaults
    const { filters, pagination, orderBy } = listTracesArgsSchema.parse(args);
    const { page, perPage } = pagination;

    const tableName = parseSqlIdentifier(TABLE_SPANS, 'table name');

    try {
      // Build WHERE clause for filters
      const conditions: string[] = ['parentSpanId IS NULL']; // Only root spans
      const queryArgs: any[] = [];

      if (filters) {
        // Date range filters
        if (filters.startedAt?.start) {
          conditions.push(`startedAt >= ?`);
          queryArgs.push(filters.startedAt.start.toISOString());
        }
        if (filters.startedAt?.end) {
          conditions.push(`startedAt <= ?`);
          queryArgs.push(filters.startedAt.end.toISOString());
        }
        if (filters.endedAt?.start) {
          conditions.push(`endedAt >= ?`);
          queryArgs.push(filters.endedAt.start.toISOString());
        }
        if (filters.endedAt?.end) {
          conditions.push(`endedAt <= ?`);
          queryArgs.push(filters.endedAt.end.toISOString());
        }

        // Span type filter
        if (filters.spanType !== undefined) {
          conditions.push(`spanType = ?`);
          queryArgs.push(filters.spanType);
        }

        // Entity filters
        if (filters.entityType !== undefined) {
          conditions.push(`entityType = ?`);
          queryArgs.push(filters.entityType);
        }
        if (filters.entityId !== undefined) {
          conditions.push(`entityId = ?`);
          queryArgs.push(filters.entityId);
        }
        if (filters.entityName !== undefined) {
          conditions.push(`entityName = ?`);
          queryArgs.push(filters.entityName);
        }

        // Identity & Tenancy filters
        if (filters.userId !== undefined) {
          conditions.push(`userId = ?`);
          queryArgs.push(filters.userId);
        }
        if (filters.organizationId !== undefined) {
          conditions.push(`organizationId = ?`);
          queryArgs.push(filters.organizationId);
        }
        if (filters.resourceId !== undefined) {
          conditions.push(`resourceId = ?`);
          queryArgs.push(filters.resourceId);
        }

        // Correlation ID filters
        if (filters.runId !== undefined) {
          conditions.push(`runId = ?`);
          queryArgs.push(filters.runId);
        }
        if (filters.sessionId !== undefined) {
          conditions.push(`sessionId = ?`);
          queryArgs.push(filters.sessionId);
        }
        if (filters.threadId !== undefined) {
          conditions.push(`threadId = ?`);
          queryArgs.push(filters.threadId);
        }
        if (filters.requestId !== undefined) {
          conditions.push(`requestId = ?`);
          queryArgs.push(filters.requestId);
        }

        // Deployment context filters
        if (filters.environment !== undefined) {
          conditions.push(`environment = ?`);
          queryArgs.push(filters.environment);
        }
        if (filters.source !== undefined) {
          conditions.push(`source = ?`);
          queryArgs.push(filters.source);
        }
        if (filters.serviceName !== undefined) {
          conditions.push(`serviceName = ?`);
          queryArgs.push(filters.serviceName);
        }

        // Scope filter (JSON containment - SQLite uses json_extract)
        if (filters.scope != null) {
          // For SQLite/libsql, we need to check each key in the scope object
          for (const [key, value] of Object.entries(filters.scope)) {
            // Validate key to prevent SQL injection in JSON path
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
              throw new MastraError({
                id: createStorageErrorId('LIBSQL', 'LIST_TRACES', 'INVALID_FILTER_KEY'),
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.USER,
                details: { key },
              });
            }
            conditions.push(`json_extract(scope, '$.${key}') = ?`);
            queryArgs.push(typeof value === 'string' ? value : JSON.stringify(value));
          }
        }

        // Metadata filter (JSON containment)
        if (filters.metadata != null) {
          for (const [key, value] of Object.entries(filters.metadata)) {
            // Validate key to prevent SQL injection in JSON path
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
              throw new MastraError({
                id: createStorageErrorId('LIBSQL', 'LIST_TRACES', 'INVALID_FILTER_KEY'),
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.USER,
                details: { key },
              });
            }
            conditions.push(`json_extract(metadata, '$.${key}') = ?`);
            queryArgs.push(typeof value === 'string' ? value : JSON.stringify(value));
          }
        }

        // Tags filter (all tags must be present)
        if (filters.tags != null && filters.tags.length > 0) {
          // Use json_each for exact tag matching (LIKE can match substrings)
          for (const tag of filters.tags) {
            conditions.push(`EXISTS (SELECT 1 FROM json_each(${tableName}.tags) WHERE value = ?)`);
            queryArgs.push(tag);
          }
        }

        // Status filter (derived from error and endedAt)
        if (filters.status !== undefined) {
          switch (filters.status) {
            case TraceStatus.ERROR:
              conditions.push(`error IS NOT NULL`);
              break;
            case TraceStatus.RUNNING:
              conditions.push(`endedAt IS NULL AND error IS NULL`);
              break;
            case TraceStatus.SUCCESS:
              conditions.push(`endedAt IS NOT NULL AND error IS NULL`);
              break;
          }
        }

        // hasChildError filter (requires subquery)
        if (filters.hasChildError !== undefined) {
          if (filters.hasChildError) {
            conditions.push(`EXISTS (
              SELECT 1 FROM ${tableName} c
              WHERE c.traceId = ${tableName}.traceId AND c.error IS NOT NULL
            )`);
          } else {
            conditions.push(`NOT EXISTS (
              SELECT 1 FROM ${tableName} c
              WHERE c.traceId = ${tableName}.traceId AND c.error IS NOT NULL
            )`);
          }
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Order by clause with proper NULL handling for endedAt
      // For endedAt DESC: NULLs FIRST (running spans on top when viewing newest)
      // For endedAt ASC: NULLs LAST (running spans at end when viewing oldest)
      // startedAt is never null (required field), so no special handling needed
      // SQLite's natural behavior: NULLs are "smaller" than any value
      //   - ASC: NULLs first (natural)
      //   - DESC: NULLs last (natural)
      // So we need CASE WHEN workarounds to invert the natural behavior for endedAt
      const sortField = orderBy.field;
      const sortDirection = orderBy.direction;
      let orderByClause: string;
      if (sortField === 'endedAt') {
        // endedAt DESC: want NULLs first (running spans on top) - need CASE WHEN
        // endedAt ASC: want NULLs last (oldest completed first) - need CASE WHEN
        orderByClause =
          sortDirection === 'DESC'
            ? `CASE WHEN ${sortField} IS NULL THEN 0 ELSE 1 END, ${sortField} DESC`
            : `CASE WHEN ${sortField} IS NULL THEN 1 ELSE 0 END, ${sortField} ASC`;
      } else {
        orderByClause = `${sortField} ${sortDirection}`;
      }

      // Get total count
      const count = await this.#db.selectTotalCount({
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

      // Get paginated spans
      const spans = await this.#db.selectMany<SpanRecord>({
        tableName: TABLE_SPANS,
        whereClause: { sql: whereClause, args: queryArgs },
        orderBy: orderByClause,
        offset: page * perPage,
        limit: perPage,
      });

      return {
        pagination: {
          total: count,
          page,
          perPage,
          hasMore: (page + 1) * perPage < count,
        },
        spans: toTraceSpans(
          spans.map(span => transformFromSqlRow<SpanRecord>({ tableName: TABLE_SPANS, sqlRow: span })),
        ),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_TRACES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchCreateSpans(args: BatchCreateSpansArgs): Promise<void> {
    try {
      const now = new Date().toISOString();
      const records = args.records.map(record => {
        const startedAt = record.startedAt instanceof Date ? record.startedAt.toISOString() : record.startedAt;
        const endedAt = record.endedAt instanceof Date ? record.endedAt.toISOString() : record.endedAt;

        return {
          ...record,
          startedAt,
          endedAt,
          createdAt: now,
          updatedAt: now,
        };
      });

      return this.#db.batchInsert({
        tableName: TABLE_SPANS,
        records,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'BATCH_CREATE_SPANS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchUpdateSpans(args: BatchUpdateSpansArgs): Promise<void> {
    const now = new Date().toISOString();

    try {
      return this.#db.batchUpdate({
        tableName: TABLE_SPANS,
        updates: args.records.map(record => {
          const data: Record<string, any> = { ...record.updates };
          if (data.endedAt instanceof Date) {
            data.endedAt = data.endedAt.toISOString();
          }
          if (data.startedAt instanceof Date) {
            data.startedAt = data.startedAt.toISOString();
          }
          data.updatedAt = now;

          return {
            keys: { spanId: record.spanId, traceId: record.traceId },
            data,
          };
        }),
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'BATCH_UPDATE_SPANS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchDeleteTraces(args: BatchDeleteTracesArgs): Promise<void> {
    try {
      const keys = args.traceIds.map(traceId => ({ traceId }));
      return this.#db.batchDelete({
        tableName: TABLE_SPANS,
        keys,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'BATCH_DELETE_TRACES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async deleteTracesOlderThan(args: DeleteTracesOlderThanArgs): Promise<DeleteTracesOlderThanResponse> {
    try {
      // Build WHERE clause conditions for finding root spans
      const conditions: string[] = [];
      const sqlArgs: InValue[] = [];

      // Date filter - delete traces where root span was created before this date
      conditions.push('createdAt < ?');
      sqlArgs.push(args.beforeDate.toISOString());

      // Only match root spans
      conditions.push('parentSpanId IS NULL');

      // Optional filters
      if (args.filters?.entityType !== undefined) {
        conditions.push('entityType = ?');
        sqlArgs.push(args.filters.entityType);
      }
      if (args.filters?.entityId !== undefined) {
        conditions.push('entityId = ?');
        sqlArgs.push(args.filters.entityId);
      }
      if (args.filters?.organizationId !== undefined) {
        conditions.push('organizationId = ?');
        sqlArgs.push(args.filters.organizationId);
      }
      if (args.filters?.environment !== undefined) {
        conditions.push('environment = ?');
        sqlArgs.push(args.filters.environment);
      }

      const whereClause = conditions.join(' AND ');
      const tableName = parseSqlIdentifier(TABLE_SPANS);

      // Find trace IDs of root spans matching the criteria
      const traceIdsResult = await this.#client.execute({
        sql: `SELECT DISTINCT traceId FROM ${tableName} WHERE ${whereClause}`,
        args: sqlArgs,
      });

      const traceIds = (traceIdsResult.rows ?? []).map(row => row.traceId as string);

      if (traceIds.length === 0) {
        return { deletedCount: 0 };
      }

      // Delete all spans belonging to those traces
      const placeholders = traceIds.map(() => '?').join(', ');
      await this.#client.execute({
        sql: `DELETE FROM ${tableName} WHERE traceId IN (${placeholders})`,
        args: traceIds,
      });

      return {
        deletedCount: traceIds.length,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_TRACES_OLDER_THAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: {
            beforeDate: args.beforeDate.toISOString(),
            filters: JSON.stringify(args.filters),
          },
        },
        error,
      );
    }
  }
}
