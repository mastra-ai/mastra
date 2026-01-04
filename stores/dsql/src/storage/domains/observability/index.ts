import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  listTracesArgsSchema,
  ObservabilityStorage,
  TABLE_SCHEMAS,
  TABLE_SPANS,
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
import { splitIntoBatches, DEFAULT_MAX_ROWS_PER_BATCH } from '../../../shared/batch';
import { withRetry } from '../../../shared/retry';
import { DsqlDB, resolveDsqlConfig } from '../../db';
import type { DsqlDomainConfig } from '../../db';
import { transformFromSqlRow, getTableName, getSchemaName } from '../utils';

export class ObservabilityDSQL extends ObservabilityStorage {
  #db: DsqlDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [TABLE_SPANS] as const;

  constructor(config: DsqlDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolveDsqlConfig(config);
    this.#db = new DsqlDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    // Filter indexes to only those for tables managed by this domain
    this.#indexes = indexes?.filter(idx => (ObservabilityDSQL.MANAGED_TABLES as readonly string[]).includes(idx.table));
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
        columns: ['traceId', 'startedAt'],
      },
      {
        name: `${schemaPrefix}mastra_ai_spans_parentspanid_startedat_idx`,
        table: TABLE_SPANS,
        columns: ['parentSpanId', 'startedAt'],
      },
      {
        name: `${schemaPrefix}mastra_ai_spans_name_idx`,
        table: TABLE_SPANS,
        columns: ['name'],
      },
      {
        name: `${schemaPrefix}mastra_ai_spans_spantype_startedat_idx`,
        table: TABLE_SPANS,
        columns: ['spanType', 'startedAt'],
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
      const now = new Date().toISOString();

      const record = {
        ...span,
        startedAt,
        endedAt,
        startedAtZ: startedAt,
        endedAtZ: endedAt,
        // Aurora DSQL doesn't support triggers, so we set timestamps explicitly
        createdAt: now,
        updatedAt: now,
      };

      await this.#db.insert({ tableName: TABLE_SPANS, record });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DSQL', 'CREATE_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
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
          id: createStorageErrorId('DSQL', 'GET_SPAN', 'FAILED'),
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
          id: createStorageErrorId('DSQL', 'GET_ROOT_SPAN', 'FAILED'),
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
          id: createStorageErrorId('DSQL', 'GET_TRACE', 'FAILED'),
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
      // Note: updatedAt/updatedAtZ will be set in #db.update() method
      // Aurora DSQL doesn't support triggers

      await this.#db.update({
        tableName: TABLE_SPANS,
        keys: { spanId, traceId },
        data,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DSQL', 'UPDATE_SPAN', 'FAILED'),
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

        // Scope filter (TEXT with JSON comparison - Aurora DSQL stores JSONB as TEXT)
        if (filters.scope != null) {
          conditions.push(`r."scope"::text = $${paramIndex++}`);
          params.push(JSON.stringify(filters.scope));
        }

        // Metadata filter (TEXT with JSON comparison - Aurora DSQL stores JSONB as TEXT)
        if (filters.metadata != null) {
          conditions.push(`r."metadata"::text = $${paramIndex++}`);
          params.push(JSON.stringify(filters.metadata));
        }

        // Tags filter (TEXT with JSON comparison - Aurora DSQL stores JSONB as TEXT)
        if (filters.tags != null && filters.tags.length > 0) {
          conditions.push(`r."tags"::text = $${paramIndex++}`);
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
      // Note: Aurora DSQL does not support NULLS FIRST/LAST syntax
      const sortField = `${orderBy.field}Z`;
      const sortDirection = orderBy.direction;
      const orderClause = `ORDER BY r."${sortField}" ${sortDirection}`;

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
          id: createStorageErrorId('DSQL', 'LIST_TRACES', 'FAILED'),
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
          startedAtZ: startedAt,
          endedAtZ: endedAt,
          // Aurora DSQL doesn't support triggers, so we set timestamps explicitly
          createdAt: now,
          updatedAt: now,
        };
      });

      await this.#db.batchInsert({
        tableName: TABLE_SPANS,
        records,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DSQL', 'BATCH_CREATE_SPANS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchUpdateSpans(args: BatchUpdateSpansArgs): Promise<void> {
    try {
      await this.#db.batchUpdate({
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
          // Note: updatedAt/updatedAtZ will be set in #db.batchUpdate() method
          // Aurora DSQL doesn't support triggers

          return {
            keys: { spanId: record.spanId, traceId: record.traceId },
            data,
          };
        }),
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DSQL', 'BATCH_UPDATE_SPANS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchDeleteTraces(args: BatchDeleteTracesArgs): Promise<void> {
    const { batches } = splitIntoBatches(args.traceIds, { maxRows: DEFAULT_MAX_ROWS_PER_BATCH });

    const tableName = getTableName({
      indexName: TABLE_SPANS,
      schemaName: getSchemaName(this.#schema),
    });

    for (const batchTraceIds of batches) {
      const placeholders = batchTraceIds.map((_, i) => `$${i + 1}`).join(', ');

      await withRetry(
        async () => {
          await this.#db.client.none(`DELETE FROM ${tableName} WHERE "traceId" IN (${placeholders})`, batchTraceIds);
        },
        {
          onRetry: (error, attempt, delay) => {
            this.logger?.warn?.(
              `batchDeleteTraces retry ${attempt} for ${batchTraceIds.length} traces after ${delay}ms: ${error.message}`,
            );
          },
        },
      ).catch(error => {
        throw new MastraError(
          {
            id: createStorageErrorId('DSQL', 'BATCH_DELETE_TRACES', 'FAILED'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
          },
          error,
        );
      });
    }
  }
}
