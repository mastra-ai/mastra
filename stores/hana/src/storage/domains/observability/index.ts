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
  CreateSpanRecord,
  ListTracesArgs,
  ListTracesResponse,
  TracingStorageStrategy,
  BatchUpdateSpansArgs,
  BatchDeleteTracesArgs,
  BatchCreateSpansArgs,
  UpdateSpanArgs,
  GetTraceArgs,
  GetTraceResponse,
  GetTraceLightResponse,
  LightSpanRecord,
  GetSpanArgs,
  GetSpanResponse,
  GetRootSpanArgs,
  GetRootSpanResponse,
  CreateSpanArgs,
  CreateIndexOptions,
} from '@mastra/core/storage';

import { HANAClient, resolveHanaConfig } from '../../db';
import type { HANADomainConfig } from '../../db';
import { transformFromRow, getSchemaName, getTableName } from '../utils';

export class ObservabilityHANA extends ObservabilityStorage {
  private db: HANAClient;
  private schema?: string;
  private needsInit: boolean;
  private skipDefaultIndexes?: boolean;
  private indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_SPANS] as const;

  constructor(config: HANADomainConfig) {
    super();
    const { pool, schemaName, skipDefaultIndexes, indexes, needsInit } = resolveHanaConfig(config);
    this.schema = schemaName;
    this.db = new HANAClient({ pool, schemaName, skipDefaultIndexes });
    this.needsInit = needsInit;
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx => (ObservabilityHANA.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    if (this.needsInit) {
      await this.db.pool.initialize();
      this.needsInit = false;
    }
    await this.db.createTable({ tableName: TABLE_SPANS, schema: SPAN_SCHEMA });
    // alterTable automatically adds missing columns (HANA adapter does column-by-column diff)
    this.schema = this.db.schemaName;
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

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
      {
        name: `${schemaPrefix}mastra_ai_spans_root_spans_idx`,
        table: TABLE_SPANS,
        columns: ['startedAt DESC'],
        where: '"parentSpanId" IS NULL',
      },
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
      {
        name: `${schemaPrefix}mastra_ai_spans_orgid_userid_idx`,
        table: TABLE_SPANS,
        columns: ['organizationId', 'userId'],
      },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index ${indexDef.name}:`, error);
      }
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) return;
    for (const indexDef of this.indexes) {
      try {
        await this.db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_SPANS });
  }

  async migrateSpans(): Promise<{
    success: boolean;
    alreadyMigrated: boolean;
    duplicatesRemoved: number;
    message: string;
  }> {
    // HANA adapter: deduplication uses UPSERT WITH PRIMARY KEY during batchCreateSpans,
    // so a separate migration is not needed. Return already-migrated status.
    return {
      success: true,
      alreadyMigrated: true,
      duplicatesRemoved: 0,
      message: 'HANA adapter uses UPSERT; no migration required.',
    };
  }

  async checkSpansMigrationStatus(): Promise<{
    needsMigration: boolean;
    hasDuplicates: boolean;
    duplicateCount: number;
    constraintExists: boolean;
    tableName: string;
  }> {
    return {
      needsMigration: false,
      hasDuplicates: false,
      duplicateCount: 0,
      constraintExists: true,
      tableName: TABLE_SPANS,
    };
  }

  public get tracingStrategy(): {
    preferred: TracingStorageStrategy;
    supported: TracingStorageStrategy[];
  } {
    return {
      preferred: 'batch-with-updates',
      supported: ['batch-with-updates', 'insert-only'],
    };
  }

  private tableName(): string {
    return getTableName({ indexName: TABLE_SPANS, schemaName: getSchemaName(this.schema) });
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
          id: createStorageErrorId('HANA', 'CREATE_SPAN', 'FAILED'),
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
      const tableName = this.tableName();
      const rows = (await this.db.pool.withConnection(conn =>
        conn.execPromise(
          `SELECT
            "traceId", "spanId", "parentSpanId", "name",
            "entityType", "entityId", "entityName",
            "userId", "organizationId", "resourceId",
            "runId", "sessionId", "threadId", "requestId",
            "environment", "source", "serviceName", "scope",
            "spanType", "attributes", "metadata", "tags", "links",
            "input", "output", "error", "isEvent",
            "startedAt", "endedAt", "createdAt", "updatedAt"
          FROM ${tableName}
          WHERE "traceId" = ?
          ORDER BY "startedAt" ASC`,
          [traceId],
        ),
      )) as Array<Record<string, unknown>>;

      if (!rows || rows.length === 0) return null;

      return {
        traceId,
        spans: rows.map(row => transformFromRow<SpanRecord>({ tableName: TABLE_SPANS, row })),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'GET_TRACE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { traceId },
        },
        error,
      );
    }
  }

  async getTraceLight(args: GetTraceArgs): Promise<GetTraceLightResponse | null> {
    const { traceId } = args;
    try {
      const tableName = this.tableName();
      const rows = (await this.db.pool.withConnection(conn =>
        conn.execPromise(
          `SELECT
            "traceId", "spanId", "parentSpanId", "name",
            "entityType", "entityId", "entityName",
            "spanType", "error", "isEvent",
            "startedAt", "endedAt", "createdAt", "updatedAt"
          FROM ${tableName}
          WHERE "traceId" = ?
          ORDER BY "startedAt" ASC`,
          [traceId],
        ),
      )) as Array<Record<string, unknown>>;

      if (!rows || rows.length === 0) return null;

      return {
        traceId,
        spans: rows.map(row => transformFromRow<LightSpanRecord>({ tableName: TABLE_SPANS, row })),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'GET_TRACE_LIGHT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { traceId },
        },
        error,
      );
    }
  }

  async getSpan(args: GetSpanArgs): Promise<GetSpanResponse | null> {
    const { traceId, spanId } = args;
    try {
      const tableName = this.tableName();
      const rows = (await this.db.pool.withConnection(conn =>
        conn.execPromise(
          `SELECT
            "traceId", "spanId", "parentSpanId", "name",
            "entityType", "entityId", "entityName",
            "userId", "organizationId", "resourceId",
            "runId", "sessionId", "threadId", "requestId",
            "environment", "source", "serviceName", "scope",
            "spanType", "attributes", "metadata", "tags", "links",
            "input", "output", "error", "isEvent",
            "startedAt", "endedAt", "createdAt", "updatedAt"
          FROM ${tableName}
          WHERE "traceId" = ? AND "spanId" = ?`,
          [traceId, spanId],
        ),
      )) as Array<Record<string, unknown>>;

      if (!rows || rows.length === 0) return null;

      return {
        span: transformFromRow<SpanRecord>({ tableName: TABLE_SPANS, row: rows[0]! }),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'GET_SPAN', 'FAILED'),
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
      const tableName = this.tableName();
      const rows = (await this.db.pool.withConnection(conn =>
        conn.execPromise(
          `SELECT
            "traceId", "spanId", "parentSpanId", "name",
            "entityType", "entityId", "entityName",
            "userId", "organizationId", "resourceId",
            "runId", "sessionId", "threadId", "requestId",
            "environment", "source", "serviceName", "scope",
            "spanType", "attributes", "metadata", "tags", "links",
            "input", "output", "error", "isEvent",
            "startedAt", "endedAt", "createdAt", "updatedAt"
          FROM ${tableName}
          WHERE "traceId" = ? AND "parentSpanId" IS NULL`,
          [traceId],
        ),
      )) as Array<Record<string, unknown>>;

      if (!rows || rows.length === 0) return null;

      return {
        span: transformFromRow<SpanRecord>({ tableName: TABLE_SPANS, row: rows[0]! }),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'GET_ROOT_SPAN', 'FAILED'),
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
      if (data.endedAt instanceof Date) data.endedAt = data.endedAt.toISOString();
      if (data.startedAt instanceof Date) data.startedAt = data.startedAt.toISOString();
      data.updatedAt = new Date().toISOString();

      await this.db.update({ tableName: TABLE_SPANS, keys: { spanId, traceId }, data });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'UPDATE_SPAN', 'FAILED'),
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
    const page = pagination?.page ?? 0;
    const perPage = pagination?.perPage ?? 10;
    const tableName = this.tableName();

    try {
      const conditions: string[] = ['"parentSpanId" IS NULL'];
      const params: unknown[] = [];

      if (filters) {
        if (filters.startedAt?.start) {
          conditions.push(`r."startedAt" >= ?`);
          params.push(filters.startedAt.start.toISOString());
        }
        if (filters.startedAt?.end) {
          conditions.push(`r."startedAt" <= ?`);
          params.push(filters.startedAt.end.toISOString());
        }
        if (filters.endedAt?.start) {
          conditions.push(`r."endedAt" >= ?`);
          params.push(filters.endedAt.start.toISOString());
        }
        if (filters.endedAt?.end) {
          conditions.push(`r."endedAt" <= ?`);
          params.push(filters.endedAt.end.toISOString());
        }

        const simpleFields: Array<keyof typeof filters> = [
          'spanType',
          'entityType',
          'entityId',
          'entityName',
          'userId',
          'organizationId',
          'resourceId',
          'runId',
          'sessionId',
          'threadId',
          'requestId',
          'environment',
          'source',
          'serviceName',
        ] as const;

        for (const field of simpleFields) {
          if (filters[field] !== undefined) {
            conditions.push(`r."${String(field)}" = ?`);
            params.push(filters[field]);
          }
        }

        if (filters.scope != null) {
          for (const [key, value] of Object.entries(filters.scope)) {
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
              throw new MastraError({
                id: createStorageErrorId('HANA', 'LIST_TRACES', 'INVALID_FILTER_KEY'),
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.USER,
                details: { key },
              });
            }
            conditions.push(`JSON_VALUE(r."scope", '$.${key}') = ?`);
            params.push(typeof value === 'string' ? value : JSON.stringify(value));
          }
        }

        if (filters.metadata != null) {
          for (const [key, value] of Object.entries(filters.metadata)) {
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
              throw new MastraError({
                id: createStorageErrorId('HANA', 'LIST_TRACES', 'INVALID_FILTER_KEY'),
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.USER,
                details: { key },
              });
            }
            conditions.push(`JSON_VALUE(r."metadata", '$.${key}') = ?`);
            params.push(typeof value === 'string' ? value : JSON.stringify(value));
          }
        }

        // Tags: HANA JSON array containment check using JSON_VALUE with array index
        // Use member_of pseudo-function not available in all HANA versions;
        // fall back to JSON_VALUE-based check: JSON_VALUE(col, '$.0') = ? OR JSON_VALUE(col, '$.1') = ? etc.
        // Safer approach: LIKE '%"tag"%' for simple string tags
        if (filters.tags != null && filters.tags.length > 0) {
          for (const tag of filters.tags) {
            // Safe approach for NCLOB JSON arrays: check if tag appears as a JSON string value
            conditions.push(`INSTR(r."tags", ?) > 0`);
            params.push(`"${tag}"`);
          }
        }

        if (filters.status !== undefined) {
          switch (filters.status) {
            case TraceStatus.ERROR:
              conditions.push(`r."error" IS NOT NULL`);
              break;
            case TraceStatus.RUNNING:
              conditions.push(`r."endedAt" IS NULL AND r."error" IS NULL`);
              break;
            case TraceStatus.SUCCESS:
              conditions.push(`r."endedAt" IS NOT NULL AND r."error" IS NULL`);
              break;
          }
        }

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
      const sortField = orderBy?.field ?? 'startedAt';
      const sortDirection = orderBy?.direction ?? 'DESC';
      // HANA default: NULLs sort first for ASC, last for DESC — invert that to match expected behavior
      const nullsClause = sortDirection === 'ASC' ? ' NULLS LAST' : ' NULLS FIRST';

      const countRows = (await this.db.pool.withConnection(conn =>
        conn.execPromise(`SELECT COUNT(*) AS CNT FROM ${tableName} r ${whereClause}`, [...params]),
      )) as Array<{ CNT: number }>;
      const count = Number(countRows[0]?.CNT ?? 0);

      if (count === 0) {
        return {
          pagination: { total: 0, page, perPage, hasMore: false },
          spans: [],
        };
      }

      const offset = page * perPage;
      const listParams = [...params, perPage, offset];

      const rows = (await this.db.pool.withConnection(conn =>
        conn.execPromise(
          `SELECT
            r."traceId", r."spanId", r."parentSpanId", r."name",
            r."entityType", r."entityId", r."entityName",
            r."userId", r."organizationId", r."resourceId",
            r."runId", r."sessionId", r."threadId", r."requestId",
            r."environment", r."source", r."serviceName", r."scope",
            r."spanType", r."attributes", r."metadata", r."tags", r."links",
            r."input", r."output", r."error", r."isEvent",
            r."startedAt", r."endedAt", r."createdAt", r."updatedAt"
          FROM ${tableName} r
          ${whereClause}
          ORDER BY r."${sortField}" ${sortDirection}${nullsClause}
          LIMIT ? OFFSET ?`,
          listParams,
        ),
      )) as Array<Record<string, unknown>>;

      return {
        pagination: {
          total: count,
          page,
          perPage,
          hasMore: (page + 1) * perPage < count,
        },
        spans: toTraceSpans(rows.map(row => transformFromRow<SpanRecord>({ tableName: TABLE_SPANS, row }))),
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'LIST_TRACES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchCreateSpans(args: BatchCreateSpansArgs): Promise<void> {
    if (!args.records || args.records.length === 0) return;

    try {
      const now = new Date().toISOString();
      await this.db.batchInsert({
        tableName: TABLE_SPANS,
        records: args.records.map((span: CreateSpanRecord) => ({
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
          id: createStorageErrorId('HANA', 'BATCH_CREATE_SPANS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { count: args.records.length },
        },
        error,
      );
    }
  }

  async batchUpdateSpans(args: BatchUpdateSpansArgs): Promise<void> {
    if (!args.records || args.records.length === 0) return;
    const now = new Date().toISOString();

    try {
      const updates = args.records.map(
        ({ traceId, spanId, updates: data }: BatchUpdateSpansArgs['records'][number]) => {
          const processedData: Record<string, any> = { ...data };
          if (processedData.endedAt instanceof Date) processedData.endedAt = processedData.endedAt.toISOString();
          if (processedData.startedAt instanceof Date) processedData.startedAt = processedData.startedAt.toISOString();
          processedData.updatedAt = now;
          return { keys: { spanId, traceId }, data: processedData };
        },
      );

      await this.db.batchUpdate({ tableName: TABLE_SPANS, updates });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'BATCH_UPDATE_SPANS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { count: args.records.length },
        },
        error,
      );
    }
  }

  async batchDeleteTraces(args: BatchDeleteTracesArgs): Promise<void> {
    if (!args.traceIds || args.traceIds.length === 0) return;

    try {
      const keys = args.traceIds.map((traceId: string) => ({ traceId }));
      await this.db.batchDelete({ tableName: TABLE_SPANS, keys });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'BATCH_DELETE_TRACES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { count: args.traceIds.length },
        },
        error,
      );
    }
  }
}
