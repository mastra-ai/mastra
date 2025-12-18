import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { TracingStorageStrategy } from '@mastra/core/observability';
import { createStorageErrorId, SPAN_SCHEMA, ObservabilityStorage, TABLE_SPANS, TABLE_SCHEMAS } from '@mastra/core/storage';
import type {
  SpanRecord,
  TraceRecord,
  TracesPaginatedArg,
  CreateSpanRecord,
  PaginationInfo,
  UpdateSpanRecord,
} from '@mastra/core/storage';
import { PgDB } from '../../db';
import type { PgDBConfig } from '../../db';
import { buildDateRangeFilter, prepareWhereClause, transformFromSqlRow, getTableName, getSchemaName } from '../utils';

export class ObservabilityPG extends ObservabilityStorage {
  #db: PgDB;
  #schema: string;

  constructor(config: PgDBConfig) {
    super();
    this.#db = new PgDB(config);
    this.#schema = config.schemaName || 'public';
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_SPANS, schema: TABLE_SCHEMAS[TABLE_SPANS] });
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
        // Note: createdAt/updatedAt will be set by database triggers
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
            spanName: span.name,
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
        schemaName: getSchemaName(this.#schema),
      });

      const spans = await this.#db.client.manyOrNone<SpanRecord>(
        `SELECT
          "traceId", "spanId", "parentSpanId", "name", "scope", "spanType",
          "attributes", "metadata", "links", "input", "output", "error", "isEvent",
          "startedAtZ" as "startedAt", "endedAtZ" as "endedAt",
          "createdAtZ" as "createdAt", "updatedAtZ" as "updatedAt"
        FROM ${tableName}
        WHERE "traceId" = $1
        ORDER BY "startedAtZ" DESC`,
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
      const data = { ...updates };
      if (data.endedAt instanceof Date) {
        data.endedAt = data.endedAt.toISOString() as any;
      }
      if (data.startedAt instanceof Date) {
        data.startedAt = data.startedAt.toISOString() as any;
      }
      // Note: updatedAt will be set by database trigger automatically

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

  async getTracesPaginated({
    filters,
    pagination,
  }: TracesPaginatedArg): Promise<{ pagination: PaginationInfo; spans: SpanRecord[] }> {
    const page = pagination?.page ?? 0;
    const perPage = pagination?.perPage ?? 10;
    const { entityId, entityType, ...actualFilters } = filters || {};

    const filtersWithDateRange: Record<string, any> = {
      ...actualFilters,
      ...buildDateRangeFilter(pagination?.dateRange, 'startedAtZ'),
      parentSpanId: null, // Only get root spans for traces
    };

    const whereClause = prepareWhereClause(filtersWithDateRange, SPAN_SCHEMA);

    let actualWhereClause = whereClause.sql;
    let currentParamIndex = whereClause.args.length + 1;

    // Handle entity filtering
    if (entityId && entityType) {
      let name = '';
      if (entityType === 'workflow') {
        name = `workflow run: '${entityId}'`;
      } else if (entityType === 'agent') {
        name = `agent run: '${entityId}'`;
      } else {
        const error = new MastraError({
          id: createStorageErrorId('PG', 'GET_TRACES_PAGINATED', 'INVALID_ENTITY_TYPE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: {
            entityType,
          },
          text: `Cannot filter by entity type: ${entityType}`,
        });
        this.logger?.trackException(error);
        throw error;
      }

      whereClause.args.push(name);
      const statement = `"name" = $${currentParamIndex++}`;

      if (actualWhereClause) {
        actualWhereClause += ` AND ${statement}`;
      } else {
        actualWhereClause = ` WHERE ${statement}`;
      }
    }

    const tableName = getTableName({
      indexName: TABLE_SPANS,
      schemaName: getSchemaName(this.#schema),
    });

    try {
      // Get total count
      const countResult = await this.#db.client.oneOrNone<{ count: string }>(
        `SELECT COUNT(*) FROM ${tableName}${actualWhereClause}`,
        whereClause.args,
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
          "traceId", "spanId", "parentSpanId", "name", "scope", "spanType",
          "attributes", "metadata", "links", "input", "output", "error", "isEvent",
          "startedAtZ" as "startedAt", "endedAtZ" as "endedAt",
          "createdAtZ" as "createdAt", "updatedAtZ" as "updatedAt"
        FROM ${tableName}${actualWhereClause}
        ORDER BY "startedAtZ" DESC
        LIMIT $${currentParamIndex} OFFSET $${currentParamIndex + 1}`,
        [...whereClause.args, perPage, page * perPage],
      );

      return {
        pagination: {
          total: count,
          page,
          perPage,
          hasMore: spans.length === perPage,
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
          id: createStorageErrorId('PG', 'GET_TRACES_PAGINATED', 'FAILED'),
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
          // Note: createdAt/updatedAt will be set by database triggers
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

  async batchUpdateSpans(args: {
    records: {
      traceId: string;
      spanId: string;
      updates: Partial<UpdateSpanRecord>;
    }[];
  }): Promise<void> {
    try {
      return this.#db.batchUpdate({
        tableName: TABLE_SPANS,
        updates: args.records.map(record => {
          const data: Partial<UpdateSpanRecord> & {
            endedAtZ?: string;
            startedAtZ?: string;
          } = {
            ...record.updates,
          };
          if (data.endedAt instanceof Date) {
            const endedAt = data.endedAt.toISOString();
            data.endedAt = endedAt as any;
            data.endedAtZ = endedAt;
          }
          if (data.startedAt instanceof Date) {
            const startedAt = data.startedAt.toISOString();
            data.startedAt = startedAt as any;
            data.startedAtZ = startedAt;
          }
          // Note: updatedAt will be set by database trigger automatically

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
