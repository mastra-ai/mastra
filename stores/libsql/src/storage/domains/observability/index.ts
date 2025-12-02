import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { SPAN_SCHEMA, ObservabilityStorage, TABLE_SPANS } from '@mastra/core/storage';
import type {
  SpanRecord,
  CreateSpanRecord,
  UpdateSpanRecord,
  TraceRecord,
  TracesPaginatedArg,
  PaginationInfo,
} from '@mastra/core/storage';
import type { StoreOperationsLibSQL } from '../operations';
import { buildDateRangeFilter, prepareWhereClause, transformFromSqlRow } from '../utils';

export class ObservabilityLibSQL extends ObservabilityStorage {
  private operations: StoreOperationsLibSQL;
  constructor({ operations }: { operations: StoreOperationsLibSQL }) {
    super();
    this.operations = operations;
  }

  async createSpan(span: CreateSpanRecord): Promise<void> {
    try {
      // Explicitly set createdAt/updatedAt timestamps
      const now = new Date().toISOString();
      const record = {
        ...span,
        createdAt: now,
        updatedAt: now,
      };
      return this.operations.insert({ tableName: TABLE_SPANS, record });
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_CREATE_SPAN_FAILED',
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
      const spans = await this.operations.loadMany<SpanRecord>({
        tableName: TABLE_SPANS,
        whereClause: { sql: ' WHERE traceId = ?', args: [traceId] },
        orderBy: 'startedAt DESC',
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
          id: 'LIBSQL_STORE_GET_TRACE_FAILED',
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
      await this.operations.update({
        tableName: TABLE_SPANS,
        keys: { spanId, traceId },
        data: { ...updates, updatedAt: new Date().toISOString() },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_UPDATE_SPAN_FAILED',
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
      ...buildDateRangeFilter(pagination?.dateRange, 'startedAt'),
      parentSpanId: null,
    };
    const whereClause = prepareWhereClause(filtersWithDateRange, SPAN_SCHEMA);

    let actualWhereClause = whereClause.sql || '';

    if (entityId && entityType) {
      const statement = `name = ?`;
      let name = '';
      if (entityType === 'workflow') {
        name = `workflow run: '${entityId}'`;
      } else if (entityType === 'agent') {
        name = `agent run: '${entityId}'`;
      } else {
        const error = new MastraError({
          id: 'LIBSQL_STORE_GET_TRACES_PAGINATED_FAILED',
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

      if (actualWhereClause) {
        actualWhereClause += ` AND ${statement}`;
      } else {
        actualWhereClause += `WHERE ${statement}`;
      }
    }

    const orderBy = 'startedAt DESC';

    let count = 0;
    try {
      count = await this.operations.loadTotalCount({
        tableName: TABLE_SPANS,
        whereClause: { sql: actualWhereClause, args: whereClause.args },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_GET_TRACES_PAGINATED_COUNT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }

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

    try {
      const spans = await this.operations.loadMany<SpanRecord>({
        tableName: TABLE_SPANS,
        whereClause: {
          sql: actualWhereClause,
          args: whereClause.args,
        },
        orderBy,
        offset: page * perPage,
        limit: perPage,
      });

      return {
        pagination: {
          total: count,
          page,
          perPage,
          hasMore: spans.length === perPage,
        },
        spans: spans.map(span => transformFromSqlRow<SpanRecord>({ tableName: TABLE_SPANS, sqlRow: span })),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_GET_TRACES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchCreateSpans(args: { records: CreateSpanRecord[] }): Promise<void> {
    try {
      // Use single timestamp for all records in the batch
      const now = new Date().toISOString();
      return this.operations.batchInsert({
        tableName: TABLE_SPANS,
        records: args.records.map(record => ({
          ...record,
          createdAt: now,
          updatedAt: now,
        })),
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_BATCH_CREATE_SPANS_FAILED',
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
        updates: args.records.map(record => ({
          keys: { spanId: record.spanId, traceId: record.traceId },
          data: { ...record.updates, updatedAt: new Date().toISOString() },
        })),
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_BATCH_UPDATE_SPANS_FAILED',
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
          id: 'LIBSQL_STORE_BATCH_DELETE_TRACES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }
}
