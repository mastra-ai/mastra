import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { TracingStrategy } from '@mastra/core/observability';
import { AI_SPAN_SCHEMA, ObservabilityStorage, TABLE_AI_SPANS } from '@mastra/core/storage';
import type {
  AISpanRecord,
  AITraceRecord,
  AITracesPaginatedArg,
  CreateAISpanRecord,
  PaginationInfo,
  UpdateAISpanRecord,
} from '@mastra/core/storage';
import type { ConnectionPool } from 'mssql';
import type { StoreOperationsMSSQL } from '../operations';
import { buildDateRangeFilter, prepareWhereClause, transformFromSqlRow, getTableName, getSchemaName } from '../utils';

export class ObservabilityMSSQL extends ObservabilityStorage {
  public pool: ConnectionPool;
  private operations: StoreOperationsMSSQL;
  private schema?: string;

  constructor({
    pool,
    operations,
    schema,
  }: {
    pool: ConnectionPool;
    operations: StoreOperationsMSSQL;
    schema?: string;
  }) {
    super();
    this.pool = pool;
    this.operations = operations;
    this.schema = schema;
  }

  public get aiTracingStrategy(): {
    preferred: TracingStrategy;
    supported: TracingStrategy[];
  } {
    return {
      preferred: 'batch-with-updates',
      supported: ['batch-with-updates', 'insert-only'],
    };
  }

  async createAISpan(span: CreateAISpanRecord): Promise<void> {
    try {
      const startedAt = span.startedAt instanceof Date ? span.startedAt.toISOString() : span.startedAt;
      const endedAt = span.endedAt instanceof Date ? span.endedAt.toISOString() : span.endedAt;

      const record = {
        ...span,
        startedAt,
        endedAt,
        // Note: createdAt/updatedAt will be set by default values
      };

      return this.operations.insert({ tableName: TABLE_AI_SPANS, record });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MSSQL_STORE_CREATE_AI_SPAN_FAILED',
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

      const request = this.pool.request();
      request.input('traceId', traceId);

      const result = await request.query<AISpanRecord>(
        `SELECT
          [traceId], [spanId], [parentSpanId], [name], [scope], [spanType],
          [attributes], [metadata], [links], [input], [output], [error], [isEvent],
          [startedAt], [endedAt], [createdAt], [updatedAt]
        FROM ${tableName}
        WHERE [traceId] = @traceId
        ORDER BY [startedAt] DESC`,
      );

      if (!result.recordset || result.recordset.length === 0) {
        return null;
      }

      return {
        traceId,
        spans: result.recordset.map(span =>
          transformFromSqlRow<AISpanRecord>({
            tableName: TABLE_AI_SPANS,
            sqlRow: span,
          }),
        ),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MSSQL_STORE_GET_AI_TRACE_FAILED',
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
    updates: Partial<UpdateAISpanRecord>;
  }): Promise<void> {
    try {
      const data: Record<string, any> = { ...updates };
      if (data.endedAt instanceof Date) {
        data.endedAt = data.endedAt.toISOString();
      }
      if (data.startedAt instanceof Date) {
        data.startedAt = data.startedAt.toISOString();
      }
      // Note: updatedAt will be set automatically

      await this.operations.update({
        tableName: TABLE_AI_SPANS,
        keys: { spanId, traceId },
        data,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MSSQL_STORE_UPDATE_AI_SPAN_FAILED',
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
      ...buildDateRangeFilter(pagination?.dateRange, 'startedAt'),
      parentSpanId: null, // Only get root spans for traces
    };

    const whereClause = prepareWhereClause(filtersWithDateRange, AI_SPAN_SCHEMA);

    let actualWhereClause = whereClause.sql;
    const params = { ...whereClause.params };
    let currentParamIndex = Object.keys(params).length + 1;

    // Handle entity filtering
    if (entityId && entityType) {
      let name = '';
      if (entityType === 'workflow') {
        name = `workflow run: '${entityId}'`;
      } else if (entityType === 'agent') {
        name = `agent run: '${entityId}'`;
      } else {
        const error = new MastraError({
          id: 'MSSQL_STORE_GET_AI_TRACES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: {
            entityType,
          },
          text: `Cannot filter by entity type: ${entityType}`,
        });
        throw error;
      }

      const entityParam = `p${currentParamIndex++}`;
      if (actualWhereClause) {
        actualWhereClause += ` AND [name] = @${entityParam}`;
      } else {
        actualWhereClause = ` WHERE [name] = @${entityParam}`;
      }
      params[entityParam] = name;
    }

    const tableName = getTableName({
      indexName: TABLE_AI_SPANS,
      schemaName: getSchemaName(this.schema),
    });

    try {
      // Get total count
      const countRequest = this.pool.request();
      Object.entries(params).forEach(([key, value]) => {
        countRequest.input(key, value);
      });

      const countResult = await countRequest.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${tableName}${actualWhereClause}`,
      );

      const total = countResult.recordset[0]?.count ?? 0;

      if (total === 0) {
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

      // Get paginated results
      const dataRequest = this.pool.request();
      Object.entries(params).forEach(([key, value]) => {
        dataRequest.input(key, value);
      });
      dataRequest.input('offset', page * perPage);
      dataRequest.input('limit', perPage);

      const dataResult = await dataRequest.query<AISpanRecord>(
        `SELECT * FROM ${tableName}${actualWhereClause} ORDER BY [startedAt] DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      );

      const spans = dataResult.recordset.map(row =>
        transformFromSqlRow<AISpanRecord>({
          tableName: TABLE_AI_SPANS,
          sqlRow: row,
        }),
      );

      return {
        pagination: {
          total,
          page,
          perPage,
          hasMore: (page + 1) * perPage < total,
        },
        spans,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MSSQL_STORE_GET_AI_TRACES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchCreateAISpans(args: { records: CreateAISpanRecord[] }): Promise<void> {
    if (!args.records || args.records.length === 0) {
      return;
    }

    try {
      await this.operations.batchInsert({
        tableName: TABLE_AI_SPANS,
        records: args.records.map(span => ({
          ...span,
          startedAt: span.startedAt instanceof Date ? span.startedAt.toISOString() : span.startedAt,
          endedAt: span.endedAt instanceof Date ? span.endedAt.toISOString() : span.endedAt,
        })),
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MSSQL_STORE_BATCH_CREATE_AI_SPANS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: {
            count: args.records.length,
          },
        },
        error,
      );
    }
  }

  async batchUpdateAISpans(args: {
    records: {
      traceId: string;
      spanId: string;
      updates: Partial<UpdateAISpanRecord>;
    }[];
  }): Promise<void> {
    if (!args.records || args.records.length === 0) {
      return;
    }

    try {
      const updates = args.records.map(({ traceId, spanId, updates: data }) => {
        const processedData: Record<string, any> = { ...data };
        if (processedData.endedAt instanceof Date) {
          processedData.endedAt = processedData.endedAt.toISOString();
        }
        if (processedData.startedAt instanceof Date) {
          processedData.startedAt = processedData.startedAt.toISOString();
        }

        return {
          keys: { spanId, traceId },
          data: processedData,
        };
      });

      await this.operations.batchUpdate({
        tableName: TABLE_AI_SPANS,
        updates,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MSSQL_STORE_BATCH_UPDATE_AI_SPANS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: {
            count: args.records.length,
          },
        },
        error,
      );
    }
  }

  async batchDeleteAITraces(args: { traceIds: string[] }): Promise<void> {
    if (!args.traceIds || args.traceIds.length === 0) {
      return;
    }

    try {
      const keys = args.traceIds.map(traceId => ({ traceId }));

      await this.operations.batchDelete({
        tableName: TABLE_AI_SPANS,
        keys,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MSSQL_STORE_BATCH_DELETE_AI_TRACES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: {
            count: args.traceIds.length,
          },
        },
        error,
      );
    }
  }
}
