import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { TracingStorageStrategy } from '@mastra/core/observability';
import { SPAN_SCHEMA, ObservabilityStorageBase, TABLE_SPANS, TABLE_SCHEMAS } from '@mastra/core/storage';
import type {
  SpanRecord,
  TraceRecord,
  TracesPaginatedArg,
  CreateSpanRecord,
  PaginationInfo,
  UpdateSpanRecord,
} from '@mastra/core/storage';
import type sql from 'mssql';
import { MSSQLDomainBase } from '../base';
import type { MSSQLDomainConfig } from '../base';
import type { StoreOperationsMSSQL } from '../operations';
import { IndexManagementMSSQL } from '../operations';
import { buildDateRangeFilter, prepareWhereClause, transformFromSqlRow, getTableName, getSchemaName } from '../utils';

export class ObservabilityStorageMSSQL extends ObservabilityStorageBase {
  private domainBase: MSSQLDomainBase;
  indexManagement?: IndexManagementMSSQL;

  constructor(opts: MSSQLDomainConfig) {
    super();
    this.domainBase = new MSSQLDomainBase(opts);
  }

  private get pool(): sql.ConnectionPool {
    return this.domainBase['pool'];
  }

  private get schema(): string {
    return this.domainBase['schema'];
  }

  private get operations(): StoreOperationsMSSQL {
    return this.domainBase['operations'];
  }

  async createIndexes(): Promise<void> {
    // Create indexes for observability domain
    const indexManagement = new IndexManagementMSSQL({ pool: this.pool, schemaName: this.schema });
    const schemaPrefix = this.schema && this.schema !== 'dbo' ? `${this.schema}_` : '';
    this.indexManagement = indexManagement;

    // Create traceId + startedAt index
    try {
      await indexManagement.createIndex({
        name: `${schemaPrefix}mastra_ai_spans_traceid_startedat_idx`,
        table: TABLE_SPANS,
        columns: ['traceId', 'startedAt DESC'],
      });
    } catch (error) {
      // Log but don't fail initialization - indexes are performance optimizations
      this.logger?.warn?.('Failed to create observability traceId index:', error);
    }

    // Create parentSpanId + startedAt index
    try {
      await indexManagement.createIndex({
        name: `${schemaPrefix}mastra_ai_spans_parentspanid_startedat_idx`,
        table: TABLE_SPANS,
        columns: ['parentSpanId', 'startedAt DESC'],
      });
    } catch (error) {
      // Log but don't fail initialization - indexes are performance optimizations
      this.logger?.warn?.('Failed to create observability parentSpanId index:', error);
    }

    // Create name index
    try {
      await indexManagement.createIndex({
        name: `${schemaPrefix}mastra_ai_spans_name_idx`,
        table: TABLE_SPANS,
        columns: ['name'],
      });
    } catch (error) {
      // Log but don't fail initialization - indexes are performance optimizations
      this.logger?.warn?.('Failed to create observability name index:', error);
    }

    // Create spanType + startedAt index
    try {
      await indexManagement.createIndex({
        name: `${schemaPrefix}mastra_ai_spans_spantype_startedat_idx`,
        table: TABLE_SPANS,
        columns: ['spanType', 'startedAt DESC'],
      });
    } catch (error) {
      // Log but don't fail initialization - indexes are performance optimizations
      this.logger?.warn?.('Failed to create observability spanType index:', error);
    }
  }

  async dropIndexes(): Promise<void> {
    if (!this.indexManagement) {
      this.indexManagement = new IndexManagementMSSQL({ pool: this.pool, schemaName: this.schema });
    }
    const schemaPrefix = this.schema && this.schema !== 'dbo' ? `${this.schema}_` : '';
    await this.indexManagement.dropIndex(`${schemaPrefix}mastra_ai_spans_traceid_startedat_idx`);
    await this.indexManagement.dropIndex(`${schemaPrefix}mastra_ai_spans_parentspanid_startedat_idx`);
    await this.indexManagement.dropIndex(`${schemaPrefix}mastra_ai_spans_name_idx`);
    await this.indexManagement.dropIndex(`${schemaPrefix}mastra_ai_spans_spantype_startedat_idx`);
  }

  async init(): Promise<void> {
    await this.operations.createTable({ tableName: TABLE_SPANS, schema: TABLE_SCHEMAS[TABLE_SPANS] });
    await this.createIndexes();
  }

  async close(): Promise<void> {
    await this.domainBase.close();
  }

  async dropData(): Promise<void> {
    await this.operations.clearTable({ tableName: TABLE_SPANS });
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

  async createSpan(span: CreateSpanRecord): Promise<void> {
    try {
      const startedAt = span.startedAt instanceof Date ? span.startedAt.toISOString() : span.startedAt;
      const endedAt = span.endedAt instanceof Date ? span.endedAt.toISOString() : span.endedAt;

      const record = {
        ...span,
        startedAt,
        endedAt,
        // Note: createdAt/updatedAt will be set by default values
      };

      return this.operations.insert({ tableName: TABLE_SPANS, record });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MSSQL_STORE_CREATE_SPAN_FAILED',
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
        schemaName: getSchemaName(this.schema),
      });

      const request = this.pool.request();
      request.input('traceId', traceId);

      const result = await request.query<SpanRecord>(
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
          transformFromSqlRow<SpanRecord>({
            tableName: TABLE_SPANS,
            sqlRow: span,
          }),
        ),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MSSQL_STORE_GET_TRACE_FAILED',
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
        data.endedAt = data.endedAt.toISOString();
      }
      if (data.startedAt instanceof Date) {
        data.startedAt = data.startedAt.toISOString();
      }
      // Note: updatedAt will be set automatically

      await this.operations.update({
        tableName: TABLE_SPANS,
        keys: { spanId, traceId },
        data,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MSSQL_STORE_UPDATE_SPAN_FAILED',
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
      parentSpanId: null, // Only get root spans for traces
    };

    const whereClause = prepareWhereClause(filtersWithDateRange, SPAN_SCHEMA);

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
          id: 'MSSQL_STORE_GET_TRACES_PAGINATED_FAILED',
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
      indexName: TABLE_SPANS,
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

      const dataResult = await dataRequest.query<SpanRecord>(
        `SELECT * FROM ${tableName}${actualWhereClause} ORDER BY [startedAt] DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      );

      const spans = dataResult.recordset.map(row =>
        transformFromSqlRow<SpanRecord>({
          tableName: TABLE_SPANS,
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
          id: 'MSSQL_STORE_GET_TRACES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchCreateSpans(args: { records: CreateSpanRecord[] }): Promise<void> {
    if (!args.records || args.records.length === 0) {
      return;
    }

    try {
      await this.operations.batchInsert({
        tableName: TABLE_SPANS,
        records: args.records.map(span => ({
          ...span,
          startedAt: span.startedAt instanceof Date ? span.startedAt.toISOString() : span.startedAt,
          endedAt: span.endedAt instanceof Date ? span.endedAt.toISOString() : span.endedAt,
        })),
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MSSQL_STORE_BATCH_CREATE_SPANS_FAILED',
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

  async batchUpdateSpans(args: {
    records: {
      traceId: string;
      spanId: string;
      updates: Partial<UpdateSpanRecord>;
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
        tableName: TABLE_SPANS,
        updates,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MSSQL_STORE_BATCH_UPDATE_SPANS_FAILED',
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

  async batchDeleteTraces(args: { traceIds: string[] }): Promise<void> {
    if (!args.traceIds || args.traceIds.length === 0) {
      return;
    }

    try {
      const keys = args.traceIds.map(traceId => ({ traceId }));

      await this.operations.batchDelete({
        tableName: TABLE_SPANS,
        keys,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MSSQL_STORE_BATCH_DELETE_TRACES_FAILED',
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
