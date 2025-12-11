import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId, ObservabilityStorage, TABLE_SPANS, TraceStatus } from '@mastra/core/storage';
import type {
  SpanRecord,
  TraceRecord,
  CreateSpanRecord,
  UpdateSpanRecord,
  TracingStorageStrategy,
  ListTracesArgs,
  PaginationInfo,
} from '@mastra/core/storage';
import type { IDatabase } from 'pg-promise';
import type { StoreOperationsPG } from '../operations';
import { transformFromSqlRow, getTableName, getSchemaName } from '../utils';

export class ObservabilityPG extends ObservabilityStorage {
  public client: IDatabase<{}>;
  private operations: StoreOperationsPG;
  private schema?: string;

  constructor({
    client,
    operations,
    schema,
  }: {
    client: IDatabase<{}>;
    operations: StoreOperationsPG;
    schema?: string;
  }) {
    super();
    this.client = client;
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

      const record = {
        ...span,
        startedAt,
        endedAt,
        startedAtZ: startedAt,
        endedAtZ: endedAt,
      };

      return this.operations.insert({ tableName: TABLE_SPANS, record });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CREATE_SPAN', 'FAILED'),
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

      const spans = await this.client.manyOrNone<SpanRecord>(
        `SELECT
          "traceId", "spanId", "parentSpanId", "name",
          "entityType", "entityId", "entityName",
          "userId", "organizationId", "resourceId",
          "runId", "sessionId", "threadId", "requestId",
          "environment", "source", "serviceName", "scope",
          "spanType", "attributes", "metadata", "tags", "links",
          "input", "output", "error", "isEvent",
          "startedAtZ" as "startedAt", "endedAtZ" as "endedAt",
          "createdAtZ" as "createdAt", "updatedAtZ" as "updatedAt"
        FROM ${tableName}
        WHERE "traceId" = $1
        ORDER BY "startedAtZ" ASC`,
        [traceId],
      );

      if (!spans || spans.length === 0) {
        return null;
      }

      return {
        traceId,
        spans: spans.map(span =>
          transformFromSqlRow<SpanRecord>({
            tableName: TABLE_SPANS,
            sqlRow: span,
          }),
        ),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_TRACE', 'FAILED'),
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
        const endedAt = data.endedAt.toISOString();
        data.endedAt = endedAt;
        data.endedAtZ = endedAt;
      }
      if (data.startedAt instanceof Date) {
        const startedAt = data.startedAt.toISOString();
        data.startedAt = startedAt;
        data.startedAtZ = startedAt;
      }

      await this.operations.update({
        tableName: TABLE_SPANS,
        keys: { spanId, traceId },
        data,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE_SPAN', 'FAILED'),
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
      const conditions: string[] = ['r."parentSpanId" IS NULL']; // Only root spans
      const args: any[] = [];
      let paramIndex = 1;

      if (filters) {
        // Date range filters
        if (filters.startedAt?.start) {
          conditions.push(`r."startedAtZ" >= $${paramIndex++}`);
          args.push(filters.startedAt.start.toISOString());
        }
        if (filters.startedAt?.end) {
          conditions.push(`r."startedAtZ" <= $${paramIndex++}`);
          args.push(filters.startedAt.end.toISOString());
        }
        if (filters.endedAt?.start) {
          conditions.push(`r."endedAtZ" >= $${paramIndex++}`);
          args.push(filters.endedAt.start.toISOString());
        }
        if (filters.endedAt?.end) {
          conditions.push(`r."endedAtZ" <= $${paramIndex++}`);
          args.push(filters.endedAt.end.toISOString());
        }

        // Span type filter
        if (filters.spanType !== undefined) {
          conditions.push(`r."spanType" = $${paramIndex++}`);
          args.push(filters.spanType);
        }

        // Entity filters
        if (filters.entityType !== undefined) {
          conditions.push(`r."entityType" = $${paramIndex++}`);
          args.push(filters.entityType);
        }
        if (filters.entityId !== undefined) {
          conditions.push(`r."entityId" = $${paramIndex++}`);
          args.push(filters.entityId);
        }
        if (filters.entityName !== undefined) {
          conditions.push(`r."entityName" = $${paramIndex++}`);
          args.push(filters.entityName);
        }

        // Identity & Tenancy filters
        if (filters.userId !== undefined) {
          conditions.push(`r."userId" = $${paramIndex++}`);
          args.push(filters.userId);
        }
        if (filters.organizationId !== undefined) {
          conditions.push(`r."organizationId" = $${paramIndex++}`);
          args.push(filters.organizationId);
        }
        if (filters.resourceId !== undefined) {
          conditions.push(`r."resourceId" = $${paramIndex++}`);
          args.push(filters.resourceId);
        }

        // Correlation ID filters
        if (filters.runId !== undefined) {
          conditions.push(`r."runId" = $${paramIndex++}`);
          args.push(filters.runId);
        }
        if (filters.sessionId !== undefined) {
          conditions.push(`r."sessionId" = $${paramIndex++}`);
          args.push(filters.sessionId);
        }
        if (filters.threadId !== undefined) {
          conditions.push(`r."threadId" = $${paramIndex++}`);
          args.push(filters.threadId);
        }
        if (filters.requestId !== undefined) {
          conditions.push(`r."requestId" = $${paramIndex++}`);
          args.push(filters.requestId);
        }

        // Deployment context filters
        if (filters.environment !== undefined) {
          conditions.push(`r."environment" = $${paramIndex++}`);
          args.push(filters.environment);
        }
        if (filters.source !== undefined) {
          conditions.push(`r."source" = $${paramIndex++}`);
          args.push(filters.source);
        }
        if (filters.serviceName !== undefined) {
          conditions.push(`r."serviceName" = $${paramIndex++}`);
          args.push(filters.serviceName);
        }

        // Scope filter (JSONB containment)
        if (filters.scope !== undefined) {
          conditions.push(`r."scope" @> $${paramIndex++}`);
          args.push(JSON.stringify(filters.scope));
        }

        // Metadata filter (JSONB containment)
        if (filters.metadata !== undefined) {
          conditions.push(`r."metadata" @> $${paramIndex++}`);
          args.push(JSON.stringify(filters.metadata));
        }

        // Tags filter (all tags must be present)
        if (filters.tags !== undefined && filters.tags.length > 0) {
          conditions.push(`r."tags" @> $${paramIndex++}`);
          args.push(JSON.stringify(filters.tags));
        }

        // Status filter (derived from error and endedAt)
        if (filters.status !== undefined) {
          switch (filters.status) {
            case TraceStatus.ERROR:
              conditions.push(`r."error" IS NOT NULL`);
              break;
            case TraceStatus.RUNNING:
              conditions.push(`r."endedAtZ" IS NULL AND r."error" IS NULL`);
              break;
            case TraceStatus.SUCCESS:
              conditions.push(`r."endedAtZ" IS NOT NULL AND r."error" IS NULL`);
              break;
          }
        }

        // hasChildError filter (requires subquery)
        if (filters.hasChildError !== undefined) {
          if (filters.hasChildError) {
            conditions.push(`EXISTS (
              SELECT 1 FROM ${tableName} c
              WHERE c."traceId" = r."traceId" AND c."error" IS NOT NULL
            )`);
          } else {
            conditions.push(`NOT EXISTS (
              SELECT 1 FROM ${tableName} c
              WHERE c."traceId" = r."traceId" AND c."error" IS NOT NULL
            )`);
          }
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Order by clause
      const sortField = orderBy?.field === 'endedAt' ? 'endedAtZ' : 'startedAtZ';
      const sortDirection = orderBy?.direction === 'ASC' ? 'ASC' : 'DESC';
      const orderClause = `ORDER BY r."${sortField}" ${sortDirection} NULLS LAST`;

      // Get total count
      const countResult = await this.client.oneOrNone<{ count: string }>(
        `SELECT COUNT(*) FROM ${tableName} r ${whereClause}`,
        args,
      );
      const count = Number(countResult?.count ?? 0);

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
      const spans = await this.client.manyOrNone<SpanRecord>(
        `SELECT
          r."traceId", r."spanId", r."parentSpanId", r."name",
          r."entityType", r."entityId", r."entityName",
          r."userId", r."organizationId", r."resourceId",
          r."runId", r."sessionId", r."threadId", r."requestId",
          r."environment", r."source", r."serviceName", r."scope",
          r."spanType", r."attributes", r."metadata", r."tags", r."links",
          r."input", r."output", r."error", r."isEvent",
          r."startedAtZ" as "startedAt", r."endedAtZ" as "endedAt",
          r."createdAtZ" as "createdAt", r."updatedAtZ" as "updatedAt"
        FROM ${tableName} r
        ${whereClause}
        ${orderClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...args, perPage, page * perPage],
      );

      return {
        pagination: {
          total: count,
          page,
          perPage,
          hasMore: (page + 1) * perPage < count,
        },
        spans: spans.map(span =>
          transformFromSqlRow<SpanRecord>({
            tableName: TABLE_SPANS,
            sqlRow: span,
          }),
        ),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_TRACES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchCreateSpans(args: { records: CreateSpanRecord[] }): Promise<void> {
    try {
      const records = args.records.map(record => {
        const startedAt = record.startedAt instanceof Date ? record.startedAt.toISOString() : record.startedAt;
        const endedAt = record.endedAt instanceof Date ? record.endedAt.toISOString() : record.endedAt;

        return {
          ...record,
          startedAt,
          endedAt,
          startedAtZ: startedAt,
          endedAtZ: endedAt,
        };
      });

      return this.operations.batchInsert({
        tableName: TABLE_SPANS,
        records,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'BATCH_CREATE_SPANS', 'FAILED'),
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
            const endedAt = data.endedAt.toISOString();
            data.endedAt = endedAt;
            data.endedAtZ = endedAt;
          }
          if (data.startedAt instanceof Date) {
            const startedAt = data.startedAt.toISOString();
            data.startedAt = startedAt;
            data.startedAtZ = startedAt;
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
          id: createStorageErrorId('PG', 'BATCH_UPDATE_SPANS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchDeleteTraces(args: { traceIds: string[] }): Promise<void> {
    try {
      const tableName = getTableName({
        indexName: TABLE_SPANS,
        schemaName: getSchemaName(this.schema),
      });

      const placeholders = args.traceIds.map((_, i) => `$${i + 1}`).join(', ');
      await this.client.none(`DELETE FROM ${tableName} WHERE "traceId" IN (${placeholders})`, args.traceIds);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'BATCH_DELETE_TRACES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }
}
