import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId, ObservabilityStorage, TABLE_SPANS, TraceStatus } from '@mastra/core/storage';
import type {
  SpanRecord,
  CreateSpanRecord,
  UpdateSpanRecord,
  TraceRecord,
  ListTracesArgs,
  PaginationInfo,
  TracingStorageStrategy,
} from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';
import type { StoreOperationsLibSQL } from '../operations';
import { transformFromSqlRow } from '../utils';

export class ObservabilityLibSQL extends ObservabilityStorage {
  private operations: StoreOperationsLibSQL;
  constructor({ operations }: { operations: StoreOperationsLibSQL }) {
    super();
    this.operations = operations;
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

  async getTrace(traceId: string): Promise<TraceRecord | null> {
    try {
      const spans = await this.operations.loadMany<SpanRecord>({
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

  async listTraces({
    filters,
    pagination,
    orderBy,
  }: ListTracesArgs): Promise<{ pagination: PaginationInfo; spans: SpanRecord[] }> {
    const page = pagination?.page ?? 0;
    const perPage = pagination?.perPage ?? 100;

    const tableName = parseSqlIdentifier(TABLE_SPANS, 'table name');

    try {
      // Build WHERE clause for filters
      const conditions: string[] = ['parentSpanId IS NULL']; // Only root spans
      const args: any[] = [];

      if (filters) {
        // Date range filters
        if (filters.startedAt?.start) {
          conditions.push(`startedAt >= ?`);
          args.push(filters.startedAt.start.toISOString());
        }
        if (filters.startedAt?.end) {
          conditions.push(`startedAt <= ?`);
          args.push(filters.startedAt.end.toISOString());
        }
        if (filters.endedAt?.start) {
          conditions.push(`endedAt >= ?`);
          args.push(filters.endedAt.start.toISOString());
        }
        if (filters.endedAt?.end) {
          conditions.push(`endedAt <= ?`);
          args.push(filters.endedAt.end.toISOString());
        }

        // Span type filter
        if (filters.spanType !== undefined) {
          conditions.push(`spanType = ?`);
          args.push(filters.spanType);
        }

        // Entity filters
        if (filters.entityType !== undefined) {
          conditions.push(`entityType = ?`);
          args.push(filters.entityType);
        }
        if (filters.entityId !== undefined) {
          conditions.push(`entityId = ?`);
          args.push(filters.entityId);
        }
        if (filters.entityName !== undefined) {
          conditions.push(`entityName = ?`);
          args.push(filters.entityName);
        }

        // Identity & Tenancy filters
        if (filters.userId !== undefined) {
          conditions.push(`userId = ?`);
          args.push(filters.userId);
        }
        if (filters.organizationId !== undefined) {
          conditions.push(`organizationId = ?`);
          args.push(filters.organizationId);
        }
        if (filters.resourceId !== undefined) {
          conditions.push(`resourceId = ?`);
          args.push(filters.resourceId);
        }

        // Correlation ID filters
        if (filters.runId !== undefined) {
          conditions.push(`runId = ?`);
          args.push(filters.runId);
        }
        if (filters.sessionId !== undefined) {
          conditions.push(`sessionId = ?`);
          args.push(filters.sessionId);
        }
        if (filters.threadId !== undefined) {
          conditions.push(`threadId = ?`);
          args.push(filters.threadId);
        }
        if (filters.requestId !== undefined) {
          conditions.push(`requestId = ?`);
          args.push(filters.requestId);
        }

        // Deployment context filters
        if (filters.environment !== undefined) {
          conditions.push(`environment = ?`);
          args.push(filters.environment);
        }
        if (filters.source !== undefined) {
          conditions.push(`source = ?`);
          args.push(filters.source);
        }
        if (filters.serviceName !== undefined) {
          conditions.push(`serviceName = ?`);
          args.push(filters.serviceName);
        }

        // Scope filter (JSON containment - SQLite uses json_extract)
        if (filters.scope !== undefined) {
          // For SQLite/libsql, we need to check each key in the scope object
          for (const [key, value] of Object.entries(filters.scope)) {
            conditions.push(`json_extract(scope, '$.${key}') = ?`);
            args.push(typeof value === 'string' ? value : JSON.stringify(value));
          }
        }

        // Metadata filter (JSON containment)
        if (filters.metadata !== undefined) {
          for (const [key, value] of Object.entries(filters.metadata)) {
            conditions.push(`json_extract(metadata, '$.${key}') = ?`);
            args.push(typeof value === 'string' ? value : JSON.stringify(value));
          }
        }

        // Tags filter (all tags must be present)
        if (filters.tags !== undefined && filters.tags.length > 0) {
          // For SQLite, we check if each tag exists in the JSON array
          for (const tag of filters.tags) {
            conditions.push(`json_array_length(tags) > 0 AND tags LIKE ?`);
            args.push(`%"${tag}"%`);
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

      // Order by clause
      // SQLite doesn't support NULLS LAST, so we use COALESCE or CASE for similar behavior
      const sortField = orderBy?.field === 'endedAt' ? 'endedAt' : 'startedAt';
      const sortDirection = orderBy?.direction === 'ASC' ? 'ASC' : 'DESC';
      // For DESC, we want NULLs last (they normally come first in DESC)
      // For ASC, NULLs come first by default which matches NULLS FIRST behavior
      const orderByClause =
        sortDirection === 'DESC'
          ? `CASE WHEN ${sortField} IS NULL THEN 1 ELSE 0 END, ${sortField} DESC`
          : `${sortField} ASC`;

      // Get total count
      const count = await this.operations.loadTotalCount({
        tableName: TABLE_SPANS,
        whereClause: { sql: whereClause, args },
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
      const spans = await this.operations.loadMany<SpanRecord>({
        tableName: TABLE_SPANS,
        whereClause: { sql: whereClause, args },
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
        spans: spans.map(span => transformFromSqlRow<SpanRecord>({ tableName: TABLE_SPANS, sqlRow: span })),
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

  async batchCreateSpans(args: { records: CreateSpanRecord[] }): Promise<void> {
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

      return this.operations.batchInsert({
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

  async batchUpdateSpans(args: {
    records: {
      traceId: string;
      spanId: string;
      updates: Partial<UpdateSpanRecord>;
    }[];
  }): Promise<void> {
    try {
      return this.operations.batchUpdate({
        tableName: TABLE_SPANS,
        updates: args.records.map(record => {
          const data: Record<string, any> = { ...record.updates };
          if (data.endedAt instanceof Date) {
            data.endedAt = data.endedAt.toISOString();
          }
          if (data.startedAt instanceof Date) {
            data.startedAt = data.startedAt.toISOString();
          }

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

  async batchDeleteTraces(args: { traceIds: string[] }): Promise<void> {
    try {
      const keys = args.traceIds.map(traceId => ({ traceId }));
      return this.operations.batchDelete({
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
}
