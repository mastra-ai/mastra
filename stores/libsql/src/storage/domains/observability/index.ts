import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { ObservabilityStorage, safelyParseJSON, TABLE_AI_SPANS } from '@mastra/core/storage';
import type { AISpanRecord, AITraceRecord, AITracesPaginatedArg, PaginationInfo } from '@mastra/core/storage';
import type { StoreOperationsLibSQL } from '../operations';
import { prepareWhereClause } from '../utils';

export class ObservabilityLibSQL extends ObservabilityStorage {
  private operations: StoreOperationsLibSQL;
  constructor({ operations }: { operations: StoreOperationsLibSQL }) {
    super();
    this.operations = operations;
  }

  async createAISpan(span: AISpanRecord): Promise<void> {
    return this.operations.insert({ tableName: TABLE_AI_SPANS, record: span });
  }

  async getAITrace(traceId: string): Promise<AITraceRecord | null> {
    const spans = await this.operations.loadMany<AISpanRecord>({
      tableName: TABLE_AI_SPANS,
      whereClause: { sql: ' WHERE traceId = ?', args: [traceId] },
      orderBy: 'startAt DESC',
    });

    if (!spans || spans.length === 0) {
      return null;
    }

    return {
      traceId,
      spans: this.transformRowsFromSql(spans),
    };
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
    const span = await this.operations.load({ tableName: TABLE_AI_SPANS, keys: { spanId, traceId } });

    if (!span) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_UPDATE_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        new Error(`Span with id ${spanId} and traceId ${traceId} not found`),
      );
    }

    await this.operations.update({
      tableName: TABLE_AI_SPANS,
      keys: { spanId, traceId },
      data: { ...updates, updatedAt: new Date().toISOString() },
    });
  }

  /**
   * Transforms SQL row data back to AISpanRecord format
   * Reverses the transformations done in prepareStatement
   */
  private transformFromSql<T = AISpanRecord>(sqlRow: Record<string, any>): T {
    const result: Record<string, any> = {};

    const jsonColumns = new Set(['scope', 'attributes', 'metadata', 'events', 'links', 'input', 'output', 'error']);
    const dateColumns = new Set(['startAt', 'endAt', 'createdAt', 'updatedAt']);

    for (const [key, value] of Object.entries(sqlRow)) {
      if (value === 'null') {
        result[key] = null;
        continue;
      }

      if (value === null || value === undefined) {
        result[key] = value;
        continue;
      }

      if (dateColumns.has(key) && typeof value === 'string') {
        result[key] = new Date(value);
        continue;
      }

      if (jsonColumns.has(key) && typeof value === 'string') {
        result[key] = safelyParseJSON(value);
        continue;
      }

      result[key] = value;
    }

    return result as T;
  }

  private transformRowsFromSql<T = AISpanRecord>(rows: Record<string, any>[]): T[] {
    return rows.map(row => this.transformFromSql<T>(row));
  }

  async getAITracesPaginated(
    args: AITracesPaginatedArg,
  ): Promise<{ pagination: PaginationInfo; spans: AISpanRecord[] }> {
    const { filter, pagination } = args;
    const page = pagination?.page ?? 0;
    const perPage = pagination?.perPage ?? 10;

    const whereClause = prepareWhereClause({
      ...filter,
      ...(pagination?.dateRange?.start
        ? {
            startAt: new Date(pagination.dateRange.start).toISOString(),
          }
        : {}),
      ...(pagination?.dateRange?.end
        ? {
            endAt: new Date(pagination.dateRange.end).toISOString(),
          }
        : {}),
    });
    const orderBy = 'startAt DESC';

    const count = await this.operations.loadTotalCount({
      tableName: TABLE_AI_SPANS,
      whereClause: { sql: whereClause.sql, args: whereClause.args },
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

    const spans = await this.operations.loadMany<AISpanRecord>({
      tableName: TABLE_AI_SPANS,
      whereClause,
      orderBy,
      offset: page * perPage,
      limit: perPage,
    });

    return {
      pagination: {
        total: spans.length,
        page,
        perPage,
        hasMore: spans.length === perPage,
      },
      spans: this.transformRowsFromSql(spans),
    };
  }

  async batchCreateAISpans(args: { records: AISpanRecord[] }): Promise<void> {
    return this.operations.batchInsert({
      tableName: TABLE_AI_SPANS,
      records: args.records.map(record => ({
        ...record,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
    });
  }

  async batchUpdateAISpans(args: {
    records: {
      traceId: string;
      spanId: string;
      updates: Partial<Omit<AISpanRecord, 'spanId' | 'traceId'>>;
    }[];
  }): Promise<void> {
    return this.operations.batchUpdate({
      tableName: TABLE_AI_SPANS,
      updates: args.records.map(record => ({
        keys: { spanId: record.spanId, traceId: record.traceId },
        data: { ...record.updates, updatedAt: new Date().toISOString() },
      })),
    });
  }

  async batchDeleteAITraces(args: { traceIds: string[] }): Promise<void> {
    const keys = args.traceIds.map(traceId => ({ traceId }));
    return this.operations.batchDelete({
      tableName: TABLE_AI_SPANS,
      keys,
    });
  }
}
