import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { AI_SPAN_SCHEMA, ObservabilityStorage, TABLE_AI_SPANS } from '@mastra/core/storage';
import type { AISpanRecord, AITraceRecord, AITracesPaginatedArg, PaginationInfo } from '@mastra/core/storage';
import type { StoreOperationsLibSQL } from '../operations';
import { buildDateRangeFilter, prepareWhereClause, transformFromSqlRow } from '../utils';

export class ObservabilityLibSQL extends ObservabilityStorage {
  private operations: StoreOperationsLibSQL;
  constructor({ operations }: { operations: StoreOperationsLibSQL }) {
    super();
    this.operations = operations;
  }

  async createAISpan(span: AISpanRecord): Promise<void> {
    try {
      return this.operations.insert({ tableName: TABLE_AI_SPANS, record: span });
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_CREATE_AI_SPAN_FAILED',
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
      const spans = await this.operations.loadMany<AISpanRecord>({
        tableName: TABLE_AI_SPANS,
        whereClause: { sql: ' WHERE traceId = ?', args: [traceId] },
        orderBy: 'startedAt DESC',
      });

      if (!spans || spans.length === 0) {
        return null;
      }

      return {
        traceId,
        spans: spans.map(span => transformFromSqlRow<AISpanRecord>({ tableName: TABLE_AI_SPANS, sqlRow: span })),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_GET_AI_TRACE_FAILED',
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
    updates: Partial<Omit<AISpanRecord, 'spanId' | 'traceId'>>;
  }): Promise<void> {
    try {
      await this.operations.update({
        tableName: TABLE_AI_SPANS,
        keys: { spanId, traceId },
        data: { ...updates, updatedAt: new Date().toISOString() },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_UPDATE_AI_SPAN_FAILED',
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

    const filtersWithDateRange: Record<string, any> = {
      ...filters,
      ...buildDateRangeFilter(pagination?.dateRange, 'startedAt'),
    };
    const whereClause = prepareWhereClause(filtersWithDateRange, AI_SPAN_SCHEMA);
    const orderBy = 'startedAt DESC';

    let count = 0;
    try {
      count = await this.operations.loadTotalCount({
        tableName: TABLE_AI_SPANS,
        whereClause: { sql: whereClause.sql, args: whereClause.args },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_GET_AI_TRACES_PAGINATED_COUNT_FAILED',
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
      const spans = await this.operations.loadMany<AISpanRecord>({
        tableName: TABLE_AI_SPANS,
        whereClause,
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
        spans: spans.map(span => transformFromSqlRow<AISpanRecord>({ tableName: TABLE_AI_SPANS, sqlRow: span })),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_GET_AI_TRACES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchCreateAISpans(args: { records: AISpanRecord[] }): Promise<void> {
    try {
      return this.operations.batchInsert({
        tableName: TABLE_AI_SPANS,
        records: args.records.map(record => ({
          ...record,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_BATCH_CREATE_AI_SPANS_FAILED',
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
      updates: Partial<Omit<AISpanRecord, 'spanId' | 'traceId'>>;
    }[];
  }): Promise<void> {
    try {
      return this.operations.batchUpdate({
        tableName: TABLE_AI_SPANS,
        updates: args.records.map(record => ({
          keys: { spanId: record.spanId, traceId: record.traceId },
          data: { ...record.updates, updatedAt: new Date().toISOString() },
        })),
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_BATCH_UPDATE_AI_SPANS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchDeleteAITraces(args: { traceIds: string[] }): Promise<void> {
    try {
      const keys = args.traceIds.map(traceId => ({ traceId }));
      return this.operations.batchDelete({
        tableName: TABLE_AI_SPANS,
        keys,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_BATCH_DELETE_AI_TRACES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }
}
