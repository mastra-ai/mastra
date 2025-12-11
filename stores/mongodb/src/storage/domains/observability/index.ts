import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId, ObservabilityStorage, TABLE_SPANS, TraceStatus } from '@mastra/core/storage';
import type {
  SpanRecord,
  TraceRecord,
  CreateSpanRecord,
  PaginationInfo,
  UpdateSpanRecord,
  ListTracesArgs,
  TracingStorageStrategy,
} from '@mastra/core/storage';
import type { StoreOperationsMongoDB } from '../operations';

export class ObservabilityMongoDB extends ObservabilityStorage {
  private operations: StoreOperationsMongoDB;

  constructor({ operations }: { operations: StoreOperationsMongoDB }) {
    super();
    this.operations = operations;
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return this.operations.insert({ tableName: TABLE_SPANS, record });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'CREATE_SPAN', 'FAILED'),
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

  async getTrace(traceId: string): Promise<TraceRecord | null> {
    try {
      const collection = await this.operations.getCollection(TABLE_SPANS);

      const spans = await collection.find({ traceId }).sort({ startedAt: 1 }).toArray();

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
          id: createStorageErrorId('MONGODB', 'GET_TRACE', 'FAILED'),
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

      // Add updatedAt timestamp
      const updateData = {
        ...data,
        updatedAt: new Date().toISOString(),
      };

      await this.operations.update({
        tableName: TABLE_SPANS,
        keys: { spanId, traceId },
        data: updateData,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'UPDATE_SPAN', 'FAILED'),
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

  async listTraces({
    filters,
    pagination,
    orderBy,
  }: ListTracesArgs): Promise<{ pagination: PaginationInfo; spans: SpanRecord[] }> {
    const page = pagination?.page ?? 0;
    const perPage = pagination?.perPage ?? 100;

    try {
      const collection = await this.operations.getCollection(TABLE_SPANS);

      // Build MongoDB query filter
      const mongoFilter: Record<string, any> = {
        parentSpanId: null, // Only get root spans for traces
      };

      if (filters) {
        // Date range filters
        if (filters.startedAt) {
          const startedAtFilter: Record<string, any> = {};
          if (filters.startedAt.start) {
            startedAtFilter.$gte = filters.startedAt.start.toISOString();
          }
          if (filters.startedAt.end) {
            startedAtFilter.$lte = filters.startedAt.end.toISOString();
          }
          if (Object.keys(startedAtFilter).length > 0) {
            mongoFilter.startedAt = startedAtFilter;
          }
        }

        if (filters.endedAt) {
          const endedAtFilter: Record<string, any> = {};
          if (filters.endedAt.start) {
            endedAtFilter.$gte = filters.endedAt.start.toISOString();
          }
          if (filters.endedAt.end) {
            endedAtFilter.$lte = filters.endedAt.end.toISOString();
          }
          if (Object.keys(endedAtFilter).length > 0) {
            mongoFilter.endedAt = endedAtFilter;
          }
        }

        // Span type filter
        if (filters.spanType !== undefined) {
          mongoFilter.spanType = filters.spanType;
        }

        // Entity filters
        if (filters.entityType !== undefined) {
          mongoFilter.entityType = filters.entityType;
        }
        if (filters.entityId !== undefined) {
          mongoFilter.entityId = filters.entityId;
        }
        if (filters.entityName !== undefined) {
          mongoFilter.entityName = filters.entityName;
        }

        // Identity & Tenancy filters
        if (filters.userId !== undefined) {
          mongoFilter.userId = filters.userId;
        }
        if (filters.organizationId !== undefined) {
          mongoFilter.organizationId = filters.organizationId;
        }
        if (filters.resourceId !== undefined) {
          mongoFilter.resourceId = filters.resourceId;
        }

        // Correlation ID filters
        if (filters.runId !== undefined) {
          mongoFilter.runId = filters.runId;
        }
        if (filters.sessionId !== undefined) {
          mongoFilter.sessionId = filters.sessionId;
        }
        if (filters.threadId !== undefined) {
          mongoFilter.threadId = filters.threadId;
        }
        if (filters.requestId !== undefined) {
          mongoFilter.requestId = filters.requestId;
        }

        // Deployment context filters
        if (filters.environment !== undefined) {
          mongoFilter.environment = filters.environment;
        }
        if (filters.source !== undefined) {
          mongoFilter.source = filters.source;
        }
        if (filters.serviceName !== undefined) {
          mongoFilter.serviceName = filters.serviceName;
        }

        // Scope filter (MongoDB supports dot notation for nested fields)
        if (filters.scope !== undefined) {
          for (const [key, value] of Object.entries(filters.scope)) {
            mongoFilter[`scope.${key}`] = value;
          }
        }

        // Metadata filter
        if (filters.metadata !== undefined) {
          for (const [key, value] of Object.entries(filters.metadata)) {
            mongoFilter[`metadata.${key}`] = value;
          }
        }

        // Tags filter (all tags must be present)
        if (filters.tags !== undefined && filters.tags.length > 0) {
          mongoFilter.tags = { $all: filters.tags };
        }

        // Status filter (derived from error and endedAt)
        if (filters.status !== undefined) {
          switch (filters.status) {
            case TraceStatus.ERROR:
              mongoFilter.error = { $ne: null };
              break;
            case TraceStatus.RUNNING:
              mongoFilter.endedAt = null;
              mongoFilter.error = null;
              break;
            case TraceStatus.SUCCESS:
              mongoFilter.endedAt = { $ne: null };
              mongoFilter.error = null;
              break;
          }
        }

        // hasChildError filter (requires aggregation or separate query)
        if (filters.hasChildError !== undefined) {
          // For MongoDB, we need to use aggregation to check for child errors
          // This is a simplified approach - we'll get traces and filter them
          // A more efficient approach would use $lookup aggregation
          const traceIdsWithErrors = await collection
            .distinct('traceId', { error: { $ne: null } })
            .catch(() => [] as string[]);

          if (filters.hasChildError) {
            mongoFilter.traceId = { $in: traceIdsWithErrors };
          } else {
            mongoFilter.traceId = { $nin: traceIdsWithErrors };
          }
        }
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

      // Build sort
      const sortField = orderBy?.field === 'endedAt' ? 'endedAt' : 'startedAt';
      const sortDirection = orderBy?.direction === 'ASC' ? 1 : -1;

      // Get paginated spans
      const spans = await collection
        .find(mongoFilter)
        .sort({ [sortField]: sortDirection })
        .skip(page * perPage)
        .limit(perPage)
        .toArray();

      return {
        pagination: {
          total: count,
          page,
          perPage,
          hasMore: (page + 1) * perPage < count,
        },
        spans: spans.map((span: any) => this.transformSpanFromMongo(span)),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_TRACES', 'FAILED'),
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
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      return this.operations.batchInsert({
        tableName: TABLE_SPANS,
        records,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'BATCH_CREATE_SPANS', 'FAILED'),
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
        updates: args.records.map(record => {
          const data: Partial<UpdateSpanRecord> = { ...record.updates };

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
          id: createStorageErrorId('MONGODB', 'BATCH_UPDATE_SPANS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchDeleteTraces(args: { traceIds: string[] }): Promise<void> {
    try {
      const collection = await this.operations.getCollection(TABLE_SPANS);

      await collection.deleteMany({
        traceId: { $in: args.traceIds },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'BATCH_DELETE_TRACES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  /**
   * Transform MongoDB document to SpanRecord format
   */
  private transformSpanFromMongo(doc: any): SpanRecord {
    // Remove MongoDB's _id field and return clean span record
    const { _id, ...span } = doc;

    // Ensure dates are properly formatted
    if (span.createdAt && typeof span.createdAt === 'string') {
      span.createdAt = new Date(span.createdAt);
    }
    if (span.updatedAt && typeof span.updatedAt === 'string') {
      span.updatedAt = new Date(span.updatedAt);
    }
    if (span.startedAt && typeof span.startedAt === 'string') {
      span.startedAt = new Date(span.startedAt);
    }
    if (span.endedAt && typeof span.endedAt === 'string') {
      span.endedAt = new Date(span.endedAt);
    }

    return span as SpanRecord;
  }
}
