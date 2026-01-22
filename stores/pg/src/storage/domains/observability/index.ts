import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  listTracesArgsSchema,
  ObservabilityStorage,
  TABLE_SCHEMAS,
  TABLE_SPANS,
  toTraceListItems,
  TraceStatus,
} from '@mastra/core/storage';
import type {
  SpanRecord,
  TracingStorageStrategy,
  ListTracesArgs,
  ListTracesResponse,
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
  CreateIndexOptions,
} from '@mastra/core/storage';
import { PgDB, resolvePgConfig } from '../../db';
import type { PgDomainConfig } from '../../db';
import { transformFromSqlRow, getTableName, getSchemaName } from '../utils';

export class ObservabilityPG extends ObservabilityStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [TABLE_SPANS] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    // Filter indexes to only those for tables managed by this domain
    this.#indexes = indexes?.filter(idx => (ObservabilityPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_SPANS, schema: TABLE_SCHEMAS[TABLE_SPANS] });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  /**
   * Returns default index definitions for the observability domain tables.
   */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.#schema !== 'public' ? `${this.#schema}_` : '';
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
      // Root spans partial index - every listTraces query filters parentSpanId IS NULL
      {
        name: `${schemaPrefix}mastra_ai_spans_root_spans_idx`,
        table: TABLE_SPANS,
        columns: ['startedAt DESC'],
        where: '"parentSpanId" IS NULL',
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
      // Metadata JSONB GIN index - for custom filtering with @> containment
      {
        name: `${schemaPrefix}mastra_ai_spans_metadata_gin_idx`,
        table: TABLE_SPANS,
        columns: ['metadata'],
        method: 'gin',
      },
      // Tags array GIN index - for array containment queries
      {
        name: `${schemaPrefix}mastra_ai_spans_tags_gin_idx`,
        table: TABLE_SPANS,
        columns: ['tags'],
        method: 'gin',
      },
    ];
  }

  /**
   * Creates default indexes for optimal query performance.
   */
  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) {
      return;
    }

    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.#db.createIndex(indexDef);
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
    if (!this.#indexes || this.#indexes.length === 0) {
      return;
    }

    for (const indexDef of this.#indexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
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

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_SPANS });
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

      const record = {
        ...span,
        startedAt,
        endedAt,
        startedAtZ: startedAt,
        endedAtZ: endedAt,
      };

      return this.#db.insert({ tableName: TABLE_SPANS, record });
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

  async getSpan(args: GetSpanArgs): Promise<GetSpanResponse | null> {
    const { traceId, spanId } = args;
    try {
      const tableName = getTableName({
        indexName: TABLE_SPANS,
        schemaName: getSchemaName(this.#schema),
      });

      const row = await this.#db.client.oneOrNone<SpanRecord>(
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
        WHERE "traceId" = $1 AND "spanId" = $2`,
        [traceId, spanId],
      );

      if (!row) {
        return null;
      }

      return {
        span: transformFromSqlRow<SpanRecord>({
          tableName: TABLE_SPANS,
          sqlRow: row,
        }),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_SPAN', 'FAILED'),
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
        schemaName: getSchemaName(this.#schema),
      });

      const row = await this.#db.client.oneOrNone<SpanRecord>(
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
        WHERE "traceId" = $1 AND "parentSpanId" IS NULL`,
        [traceId],
      );

      if (!row) {
        return null;
      }

      return {
        span: transformFromSqlRow<SpanRecord>({
          tableName: TABLE_SPANS,
          sqlRow: row,
        }),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_ROOT_SPAN', 'FAILED'),
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
      const tableName = getTableName({
        indexName: TABLE_SPANS,
        schemaName: getSchemaName(this.#schema),
      });

      const spans = await this.#db.client.manyOrNone<SpanRecord>(
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

  async updateSpan(args: UpdateSpanArgs): Promise<void> {
    const { traceId, spanId, updates } = args;
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

      await this.#db.update({
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

  async listTraces(args: ListTracesArgs): Promise<ListTracesResponse> {
    // Parse args through schema to apply defaults
    const { filters, pagination, orderBy } = listTracesArgsSchema.parse(args);
    const { page, perPage } = pagination;

    const tableName = getTableName({
      indexName: TABLE_SPANS,
      schemaName: getSchemaName(this.#schema),
    });

    try {
      // Build WHERE clause for filters
      const conditions: string[] = ['r."parentSpanId" IS NULL']; // Only root spans
      const params: any[] = [];
      let paramIndex = 1;

      if (filters) {
        // Date range filters
        if (filters.startedAt?.start) {
          conditions.push(`r."startedAtZ" >= $${paramIndex++}`);
          params.push(filters.startedAt.start.toISOString());
        }
        if (filters.startedAt?.end) {
          conditions.push(`r."startedAtZ" <= $${paramIndex++}`);
          params.push(filters.startedAt.end.toISOString());
        }
        if (filters.endedAt?.start) {
          conditions.push(`r."endedAtZ" >= $${paramIndex++}`);
          params.push(filters.endedAt.start.toISOString());
        }
        if (filters.endedAt?.end) {
          conditions.push(`r."endedAtZ" <= $${paramIndex++}`);
          params.push(filters.endedAt.end.toISOString());
        }

        // Span type filter
        if (filters.spanType !== undefined) {
          conditions.push(`r."spanType" = $${paramIndex++}`);
          params.push(filters.spanType);
        }

        // Entity filters
        if (filters.entityType !== undefined) {
          conditions.push(`r."entityType" = $${paramIndex++}`);
          params.push(filters.entityType);
        }
        if (filters.entityId !== undefined) {
          conditions.push(`r."entityId" = $${paramIndex++}`);
          params.push(filters.entityId);
        }
        if (filters.entityName !== undefined) {
          conditions.push(`r."entityName" = $${paramIndex++}`);
          params.push(filters.entityName);
        }

        // Identity & Tenancy filters
        if (filters.userId !== undefined) {
          conditions.push(`r."userId" = $${paramIndex++}`);
          params.push(filters.userId);
        }
        if (filters.organizationId !== undefined) {
          conditions.push(`r."organizationId" = $${paramIndex++}`);
          params.push(filters.organizationId);
        }
        if (filters.resourceId !== undefined) {
          conditions.push(`r."resourceId" = $${paramIndex++}`);
          params.push(filters.resourceId);
        }

        // Correlation ID filters
        if (filters.runId !== undefined) {
          conditions.push(`r."runId" = $${paramIndex++}`);
          params.push(filters.runId);
        }
        if (filters.sessionId !== undefined) {
          conditions.push(`r."sessionId" = $${paramIndex++}`);
          params.push(filters.sessionId);
        }
        if (filters.threadId !== undefined) {
          conditions.push(`r."threadId" = $${paramIndex++}`);
          params.push(filters.threadId);
        }
        if (filters.requestId !== undefined) {
          conditions.push(`r."requestId" = $${paramIndex++}`);
          params.push(filters.requestId);
        }

        // Deployment context filters
        if (filters.environment !== undefined) {
          conditions.push(`r."environment" = $${paramIndex++}`);
          params.push(filters.environment);
        }
        if (filters.source !== undefined) {
          conditions.push(`r."source" = $${paramIndex++}`);
          params.push(filters.source);
        }
        if (filters.serviceName !== undefined) {
          conditions.push(`r."serviceName" = $${paramIndex++}`);
          params.push(filters.serviceName);
        }

        // Scope filter (JSONB containment)
        if (filters.scope != null) {
          conditions.push(`r."scope" @> $${paramIndex++}`);
          params.push(JSON.stringify(filters.scope));
        }

        // Metadata filter (JSONB containment)
        if (filters.metadata != null) {
          conditions.push(`r."metadata" @> $${paramIndex++}`);
          params.push(JSON.stringify(filters.metadata));
        }

        // Tags filter (all tags must be present)
        if (filters.tags != null && filters.tags.length > 0) {
          conditions.push(`r."tags" @> $${paramIndex++}`);
          params.push(JSON.stringify(filters.tags));
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

      // Build ORDER BY clause with proper NULL handling for endedAt
      // For endedAt DESC: NULLs FIRST (running spans on top when viewing newest)
      // For endedAt ASC: NULLs LAST (running spans at end when viewing oldest)
      // startedAt is never null (required field), so no special handling needed
      const sortField = `${orderBy.field}Z`;
      const sortDirection = orderBy.direction;
      let orderClause: string;
      if (orderBy.field === 'endedAt') {
        const nullsOrder = sortDirection === 'DESC' ? 'NULLS FIRST' : 'NULLS LAST';
        orderClause = `ORDER BY r."${sortField}" ${sortDirection} ${nullsOrder}`;
      } else {
        orderClause = `ORDER BY r."${sortField}" ${sortDirection}`;
      }

      // Get total count
      const countResult = await this.#db.client.oneOrNone<{ count: string }>(
        `SELECT COUNT(*) FROM ${tableName} r ${whereClause}`,
        params,
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
      const spans = await this.#db.client.manyOrNone<SpanRecord>(
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
        [...params, perPage, page * perPage],
      );

      return {
        pagination: {
          total: count,
          page,
          perPage,
          hasMore: (page + 1) * perPage < count,
        },
        spans: toTraceListItems(
          spans.map(span =>
            transformFromSqlRow<SpanRecord>({
              tableName: TABLE_SPANS,
              sqlRow: span,
            }),
          ),
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

  async batchCreateSpans(args: BatchCreateSpansArgs): Promise<void> {
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

      return this.#db.batchInsert({
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

  async batchUpdateSpans(args: BatchUpdateSpansArgs): Promise<void> {
    try {
      return this.#db.batchUpdate({
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

  async batchDeleteTraces(args: BatchDeleteTracesArgs): Promise<void> {
    try {
      const tableName = getTableName({
        indexName: TABLE_SPANS,
        schemaName: getSchemaName(this.#schema),
      });

      const placeholders = args.traceIds.map((_, i) => `$${i + 1}`).join(', ');
      await this.#db.client.none(`DELETE FROM ${tableName} WHERE "traceId" IN (${placeholders})`, args.traceIds);
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
