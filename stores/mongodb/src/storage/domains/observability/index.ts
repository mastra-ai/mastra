import type { TracingStrategy } from '@mastra/core/ai-tracing';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { ObservabilityStorage, TABLE_AI_SPANS } from '@mastra/core/storage';
import type {
  AISpanRecord,
  AITraceRecord,
  AITracesPaginatedArg,
  CreateAISpanRecord,
  PaginationInfo,
  UpdateAISpanRecord,
} from '@mastra/core/storage';
import type { StoreOperationsMongoDB } from '../operations';

export class ObservabilityMongoDB extends ObservabilityStorage {
  private operations: StoreOperationsMongoDB;

  constructor({ operations }: { operations: StoreOperationsMongoDB }) {
    super();
    this.operations = operations;
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return this.operations.insert({ tableName: TABLE_AI_SPANS, record });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MONGODB_STORE_CREATE_AI_SPAN_FAILED',
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
      const collection = await this.operations.getCollection(TABLE_AI_SPANS);

      const spans = await collection.find({ traceId }).sort({ startedAt: -1 }).toArray();

      if (!spans || spans.length === 0) {
        return null;
      }

      return {
        traceId,
        spans: spans.map((span: any) => this.transformSpanFromMongo(span)),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MONGODB_STORE_GET_AI_TRACE_FAILED',
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
      const data = { ...updates };
      if (data.endedAt instanceof Date) {
        data.endedAt = data.endedAt.toISOString() as any;
      }
      if (data.startedAt instanceof Date) {
        data.startedAt = data.startedAt.toISOString() as any;
      }

      // Add updatedAt timestamp
      const updateData = {
        ...data,
        updatedAt: new Date().toISOString(),
      };

      await this.operations.update({
        tableName: TABLE_AI_SPANS,
        keys: { spanId, traceId },
        data: updateData,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MONGODB_STORE_UPDATE_AI_SPAN_FAILED',
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

    try {
      const collection = await this.operations.getCollection(TABLE_AI_SPANS);

      // Build MongoDB query filter
      const mongoFilter: Record<string, any> = {
        parentSpanId: null, // Only get root spans for traces
        ...actualFilters,
      };

      // Handle date range filtering
      if (pagination?.dateRange) {
        const dateFilter: Record<string, any> = {};
        if (pagination.dateRange.start) {
          dateFilter.$gte =
            pagination.dateRange.start instanceof Date
              ? pagination.dateRange.start.toISOString()
              : pagination.dateRange.start;
        }
        if (pagination.dateRange.end) {
          dateFilter.$lte =
            pagination.dateRange.end instanceof Date
              ? pagination.dateRange.end.toISOString()
              : pagination.dateRange.end;
        }
        if (Object.keys(dateFilter).length > 0) {
          mongoFilter.startedAt = dateFilter;
        }
      }

      // Handle entity filtering
      if (entityId && entityType) {
        let name = '';
        if (entityType === 'workflow') {
          name = `workflow run: '${entityId}'`;
        } else if (entityType === 'agent') {
          name = `agent run: '${entityId}'`;
        } else {
          const error = new MastraError({
            id: 'MONGODB_STORE_GET_AI_TRACES_PAGINATED_FAILED',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: {
              entityType,
            },
            text: `Cannot filter by entity type: ${entityType}`,
          });
          throw error;
        }
        mongoFilter.name = name;
      }

      // Get total count
      const count = await collection.countDocuments(mongoFilter);

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
      const spans = await collection
        .find(mongoFilter)
        .sort({ startedAt: -1 })
        .skip(page * perPage)
        .limit(perPage)
        .toArray();

      return {
        pagination: {
          total: count,
          page,
          perPage,
          hasMore: spans.length === perPage,
        },
        spans: spans.map((span: any) => this.transformSpanFromMongo(span)),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MONGODB_STORE_GET_AI_TRACES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchCreateAISpans(args: { records: CreateAISpanRecord[] }): Promise<void> {
    try {
      const records = args.records.map(record => {
        const startedAt = record.startedAt instanceof Date ? record.startedAt.toISOString() : record.startedAt;
        const endedAt = record.endedAt instanceof Date ? record.endedAt.toISOString() : record.endedAt;

        return {
          ...record,
          startedAt,
          endedAt,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      return this.operations.batchInsert({
        tableName: TABLE_AI_SPANS,
        records,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MONGODB_STORE_BATCH_CREATE_AI_SPANS_FAILED',
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
      updates: Partial<UpdateAISpanRecord>;
    }[];
  }): Promise<void> {
    try {
      return this.operations.batchUpdate({
        tableName: TABLE_AI_SPANS,
        updates: args.records.map(record => {
          const data: Partial<UpdateAISpanRecord> = { ...record.updates };

          if (data.endedAt instanceof Date) {
            data.endedAt = data.endedAt.toISOString() as any;
          }
          if (data.startedAt instanceof Date) {
            data.startedAt = data.startedAt.toISOString() as any;
          }

          // Add updatedAt timestamp
          const updateData = {
            ...data,
            updatedAt: new Date().toISOString(),
          };

          return {
            keys: { spanId: record.spanId, traceId: record.traceId },
            data: updateData,
          };
        }),
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MONGODB_STORE_BATCH_UPDATE_AI_SPANS_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchDeleteAITraces(args: { traceIds: string[] }): Promise<void> {
    try {
      const collection = await this.operations.getCollection(TABLE_AI_SPANS);

      await collection.deleteMany({
        traceId: { $in: args.traceIds },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'MONGODB_STORE_BATCH_DELETE_AI_TRACES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  /**
   * Transform MongoDB document to AISpanRecord format
   */
  private transformSpanFromMongo(doc: any): AISpanRecord {
    // Remove MongoDB's _id field and return clean span record
    const { _id, ...span } = doc;

    // Ensure dates are properly formatted
    if (span.startedAt && typeof span.startedAt === 'string') {
      span.startedAt = span.startedAt;
    }
    if (span.endedAt && typeof span.endedAt === 'string') {
      span.endedAt = span.endedAt;
    }
    if (span.createdAt && typeof span.createdAt === 'string') {
      span.createdAt = new Date(span.createdAt);
    }
    if (span.updatedAt && typeof span.updatedAt === 'string') {
      span.updatedAt = new Date(span.updatedAt);
    }

    return span as AISpanRecord;
  }
}
