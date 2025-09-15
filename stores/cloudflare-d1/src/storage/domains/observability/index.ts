import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { ObservabilityStorage, TABLE_AI_SPANS } from '@mastra/core/storage';
import type { AITraceRecord, PaginationInfo, AITracesPaginatedArg, AISpanRecord } from '@mastra/core/storage';
import { createSqlBuilder } from '@mastra/core/storage/sql-builder';
import type { StoreOperationsD1 } from '../operations';

export class ObservabilityStorageD1 extends ObservabilityStorage {
  private operations: StoreOperationsD1;

  constructor({ operations }: { operations: StoreOperationsD1 }) {
    super();
    this.operations = operations;
  }

  async createAISpan(span: AISpanRecord): Promise<void> {
    try {
      const validatedSpan = this.validateCreateAISpanPayload(span);
      const serializedSpan = this.serializeSpanForD1(validatedSpan);

      // Use batchInsert for consistency (single record)
      await this.operations.batchInsert({
        tableName: TABLE_AI_SPANS,
        records: [serializedSpan],
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_CREATE_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to create AI span: ${error}`,
      );
    }
  }

  async getAITrace(traceId: string): Promise<AITraceRecord | null> {
    try {
      const fullTableName = this.operations.getTableName(TABLE_AI_SPANS);
      const query = createSqlBuilder().select('*').from(fullTableName).where('traceId = ?', traceId);
      const { sql, params } = query.build();

      const result = await this.operations.executeQuery({ sql, params });

      if (!result || result.length === 0) {
        return null;
      }

      const spans = result.map(this.deserializeSpanFromD1);
      return {
        traceId,
        spans,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_GET_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to get AI span: ${error}`,
      );
    }
  }

  async updateAISpan(parmas: {
    spanId: string;
    traceId: string;
    updates: Partial<Omit<AISpanRecord, 'spanId' | 'traceId'>>;
  }): Promise<void> {
    try {
      const validatedPayload = this.validateUpdateAISpanPayload(parmas.updates);
      const tableName = this.operations.getTableName(TABLE_AI_SPANS);
      const query = createSqlBuilder()
        .update(tableName, Object.keys(validatedPayload), Object.values(validatedPayload))
        .where('traceId = ?', parmas.traceId)
        .andWhere('spanId = ?', parmas.spanId);
      const { sql, params } = query.build();
      await this.operations.executeQuery({ sql, params });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_UPDATE_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to update AI span: ${error}`,
      );
    }
  }

  async getAITracesPaginated({
    filters,
    pagination,
  }: AITracesPaginatedArg): Promise<{ pagination: PaginationInfo; spans: AISpanRecord[] }> {
    try {
      const page = pagination?.page ?? 0;
      const perPage = pagination?.perPage ?? 10;
      const { entityId, entityType, ...actualFilters } = filters || {};
      const fullTableName = this.operations.getTableName(TABLE_AI_SPANS);

      // Build the base query using SQL builder
      const buildQuery = (isCount = false) => {
        const query = isCount
          ? createSqlBuilder().count().from(fullTableName)
          : createSqlBuilder().select('*').from(fullTableName);

        // Always filter for top-level spans only
        query.where('parentSpanId IS NULL');

        // Add filters
        Object.entries(actualFilters || {}).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query.andWhere(`${key} = ?`, value);
          }
        });

        // Add date range filtering
        if (pagination?.dateRange?.start) {
          query.andWhere('startedAt >= ?', new Date(pagination.dateRange.start).toISOString());
        }
        if (pagination?.dateRange?.end) {
          query.andWhere('startedAt <= ?', new Date(pagination.dateRange.end).toISOString());
        }

        // Add entity filtering
        if (entityId && entityType) {
          let name = '';
          if (entityType === 'workflow') {
            name = `workflow run: '${entityId}'`;
          } else if (entityType === 'agent') {
            name = `agent run: '${entityId}'`;
          } else {
            throw new MastraError({
              id: 'CLOUDFLARE_D1_STORAGE_GET_AI_TRACES_PAGINATED_FAILED',
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.USER,
              details: { entityType },
              text: `Cannot filter by entity type: ${entityType}`,
            });
          }
          query.andWhere('name = ?', name);
        }

        // Add ordering and pagination for data query
        if (!isCount) {
          query.orderBy('startedAt', 'DESC');
          query.limit(perPage);
          query.offset(page * perPage);
        }

        return query.build();
      };

      // Get count
      const countQuery = buildQuery(true);

      const countResult = await this.operations.executeQuery({
        sql: countQuery.sql,
        params: countQuery.params,
        first: true,
      });
      const total = Number((countResult as Record<string, any>)?.count ?? 0);

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

      // Get data
      const dataQuery = buildQuery(false);
      const result = await this.operations.executeQuery({
        sql: dataQuery.sql,
        params: dataQuery.params,
      });

      const spans = result?.map((span: Record<string, any>) => this.deserializeSpanFromD1(span)) || [];

      return {
        pagination: {
          total,
          page,
          perPage,
          hasMore: spans.length === perPage,
        },
        spans: spans as AISpanRecord[],
      };
    } catch (error: any) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_GET_AI_TRACES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to get AI traces paginated: ${error}`,
      );
    }
  }

  async batchCreateAISpans({ records }: { records: AISpanRecord[] }): Promise<void> {
    try {
      const serializedRecords = records
        .map(record => {
          try {
            return this.serializeSpanForD1(this.validateCreateAISpanPayload(record));
          } catch (error: any) {
            const mastraError = new MastraError(
              {
                id: 'CLOUDFLARE_D1_STORAGE_BATCH_CREATE_AI_SPAN_VALIDATION_FAILED',
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.THIRD_PARTY,
              },
              `Failed to validate AI span: ${error}`,
            );
            this.logger?.trackException(mastraError);
            this.logger?.error(mastraError.toString());
            return null;
          }
        })
        .filter(record => record !== null);

      await this.operations.batchInsert({ tableName: TABLE_AI_SPANS, records: serializedRecords });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_BATCH_CREATE_AI_SPANS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to batch create AI spans: ${error}`,
      );
    }
  }

  async batchDeleteAITraces(args: { traceIds: string[] }): Promise<void> {
    try {
      await this.operations.batchDeleteByField({
        tableName: TABLE_AI_SPANS,
        field: 'traceId',
        values: args.traceIds,
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_DELETE_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to delete AI spans: ${error}`,
      );
    }
  }

  async batchUpdateAISpans({
    records,
  }: {
    records: { traceId: string; spanId: string; updates: Partial<Omit<AISpanRecord, 'spanId' | 'traceId'>> }[];
  }): Promise<void> {
    try {
      const updates = records
        .map(record => {
          try {
            const validatedPayload = this.validateUpdateAISpanPayload(record.updates);
            return {
              keys: { spanId: record.spanId, traceId: record.traceId },
              data: { ...validatedPayload, updatedAt: new Date().toISOString() },
            };
          } catch (error: any) {
            const mastraError = new MastraError(
              {
                id: 'CLOUDFLARE_D1_STORAGE_BATCH_UPDATE_AI_SPAN_VALIDATION_FAILED',
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.THIRD_PARTY,
              },
              error,
            );
            this.logger?.trackException(mastraError);
            this.logger?.error(mastraError.toString());
            return null;
          }
        })
        .filter(update => update !== null);

      await this.operations.batchUpdate({ tableName: TABLE_AI_SPANS, updates });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_BATCH_UPDATE_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to batch update AI spans: ${error}`,
      );
    }
  }

  private serializeSpanForD1(span: Partial<AISpanRecord>) {
    const processedSpan: Record<string, any> = { ...span };

    // Ensure all Date objects are converted to strings for D1
    for (const [key, value] of Object.entries(processedSpan)) {
      if (value instanceof Date) {
        processedSpan[key] = value.toISOString();
      }
    }

    // Ensure all object fields are properly serialized to JSON strings
    for (const [key, value] of Object.entries(processedSpan)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        try {
          processedSpan[key] = JSON.stringify(value);
        } catch (error) {
          this.logger?.error(`Failed to serialize span for D1: ${error}`);
          // If JSON serialization fails, set to null
          processedSpan[key] = null;
        }
      }
    }

    return processedSpan;
  }

  private deserializeSpanFromD1(span: Record<string, any>): Record<string, any> {
    const deserialized: Record<string, any> = { ...span };
    deserialized.createdAt = new Date(deserialized.createdAt);
    deserialized.updatedAt = deserialized.updatedAt ? new Date(deserialized.updatedAt) : null;
    deserialized.startedAt = new Date(deserialized.startedAt);
    deserialized.endedAt = deserialized.endedAt ? new Date(deserialized.endedAt) : null;

    const jsonFields = ['scope', 'attributes', 'metadata', 'events', 'links', 'input', 'output', 'error'];
    for (const field of jsonFields) {
      if (span[field] && typeof span[field] === 'string') {
        try {
          const parsed = JSON.parse(span[field]);
          if (typeof parsed === 'object') {
            deserialized[field] = parsed;
          }
        } catch {
          // Keep as string if not valid JSON
        }
      }
    }

    return deserialized;
  }
}
