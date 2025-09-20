import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { AI_SPAN_SCHEMA, ObservabilityStorage, TABLE_AI_SPANS } from '@mastra/core/storage';
import type { AISpanRecord, AITraceRecord, AITracesPaginatedArg, PaginationInfo } from '@mastra/core/storage';
import type { IDatabase } from 'pg-promise';
import type { StoreOperationsPG } from '../operations';
import { buildDateRangeFilter, prepareWhereClause, transformFromSqlRow, getTableName, getSchemaName } from '../utils';

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

  async createAISpan(span: Omit<AISpanRecord, 'createdAt' | 'updatedAt'>): Promise<void> {
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

      return this.operations.insert({ tableName: TABLE_AI_SPANS, record });
    } catch (error) {
      throw new MastraError(
        {
          id: 'PG_STORE_CREATE_AI_SPAN_FAILED',
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

  async getAITrace(traceId: string): Promise<AITraceRecord | null> {
    try {
      const tableName = getTableName({
        indexName: TABLE_AI_SPANS,
        schemaName: getSchemaName(this.schema),
      });

      const spans = await this.client.manyOrNone<AISpanRecord>(
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
          transformFromSqlRow<AISpanRecord>({
            tableName: TABLE_AI_SPANS,
            sqlRow: span,
          }),
        ),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'PG_STORE_GET_AI_TRACE_FAILED',
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

  async updateAISpan({
    spanId,
    traceId,
    updates,
  }: {
    spanId: string;
    traceId: string;
    updates: Partial<Omit<AISpanRecord, 'createdAt' | 'updatedAt' | 'spanId' | 'traceId'>>;
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

      await this.operations.update({
        tableName: TABLE_AI_SPANS,
        keys: { spanId, traceId },
        data,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'PG_STORE_UPDATE_AI_SPAN_FAILED',
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

  async getAITracesPaginated({
    filters,
    pagination,
  }: AITracesPaginatedArg): Promise<{ pagination: PaginationInfo; spans: AISpanRecord[] }> {
    const page = pagination?.page ?? 0;
    const perPage = pagination?.perPage ?? 10;
    const { entityId, entityType, ...actualFilters } = filters || {};

    const filtersWithDateRange: Record<string, any> = {
      ...actualFilters,
      ...buildDateRangeFilter(pagination?.dateRange, 'startedAtZ'),
      parentSpanId: null, // Only get root spans for traces
    };

    const whereClause = prepareWhereClause(filtersWithDateRange, AI_SPAN_SCHEMA);

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
          id: 'PG_STORE_GET_AI_TRACES_PAGINATED_FAILED',
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
      indexName: TABLE_AI_SPANS,
      schemaName: getSchemaName(this.schema),
    });

    try {
      // Get total count
      const countResult = await this.client.oneOrNone<{ count: string }>(
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
      const spans = await this.client.manyOrNone<AISpanRecord>(
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
          transformFromSqlRow<AISpanRecord>({
            tableName: TABLE_AI_SPANS,
            sqlRow: span,
          }),
        ),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'PG_STORE_GET_AI_TRACES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchCreateAISpans(args: { records: Omit<AISpanRecord, 'createdAt' | 'updatedAt'>[] }): Promise<void> {
    try {
      const records = args.records.map(record => {
        const startedAt = record.startedAt instanceof Date ? record.startedAt.toISOString() : record.startedAt;
        const endedAt = record.endedAt instanceof Date ? record.endedAt?.toISOString() : record.endedAt;

        return {
          ...record,
          startedAt,
          endedAt,
          // Also set the TIMESTAMPTZ columns for startedAt/endedAt
          startedAtZ: startedAt,
          endedAtZ: endedAt,
          // Note: createdAt/updatedAt will be set by database triggers
        };
      });

      return this.operations.batchInsert({
        tableName: TABLE_AI_SPANS,
        records,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'PG_STORE_BATCH_CREATE_AI_SPANS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchUpdateAISpans(args: {
    records: {
      traceId: string;
      spanId: string;
      updates: Partial<Omit<AISpanRecord, 'createdAt' | 'updatedAt' | 'spanId' | 'traceId'>>;
    }[];
  }): Promise<void> {
    try {
      return this.operations.batchUpdate({
        tableName: TABLE_AI_SPANS,
        updates: args.records.map(record => {
          const data = { ...record.updates };
          if (data.endedAt instanceof Date) {
            data.endedAt = data.endedAt.toISOString() as any;
          }
          if (data.startedAt instanceof Date) {
            data.startedAt = data.startedAt.toISOString() as any;
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
          id: 'PG_STORE_BATCH_UPDATE_AI_SPANS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchDeleteAITraces(args: { traceIds: string[] }): Promise<void> {
    try {
      const tableName = getTableName({
        indexName: TABLE_AI_SPANS,
        schemaName: getSchemaName(this.schema),
      });

      const placeholders = args.traceIds.map((_, i) => `$${i + 1}`).join(', ');
      await this.client.none(`DELETE FROM ${tableName} WHERE "traceId" IN (${placeholders})`, args.traceIds);
    } catch (error) {
      throw new MastraError(
        {
          id: 'PG_STORE_BATCH_DELETE_AI_TRACES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }
}
