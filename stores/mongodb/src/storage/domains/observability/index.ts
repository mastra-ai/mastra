import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { TracingStorageStrategy } from '@mastra/core/observability';
import { createStorageErrorId, ObservabilityStorage, TABLE_SPANS } from '@mastra/core/storage';
import type {
  SpanRecord,
  TraceRecord,
  TracesPaginatedArg,
  CreateSpanRecord,
  PaginationInfo,
  UpdateSpanRecord,
} from '@mastra/core/storage';
import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';

export class ObservabilityMongoDB extends ObservabilityStorage {
  #connector: MongoDBConnector;

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
  }

  private async getCollection(name: string) {
    return this.#connector.getCollection(name);
  }

  getDefaultIndexDefinitions(): MongoDBIndexConfig[] {
    return [
      { collection: TABLE_SPANS, keys: { spanId: 1, traceId: 1 }, options: { unique: true } },
      { collection: TABLE_SPANS, keys: { traceId: 1 } },
      { collection: TABLE_SPANS, keys: { parentSpanId: 1 } },
      { collection: TABLE_SPANS, keys: { startedAt: -1 } },
      { collection: TABLE_SPANS, keys: { spanType: 1 } },
      { collection: TABLE_SPANS, keys: { name: 1 } },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        const collection = await this.getCollection(indexDef.collection);
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        console.warn(`Failed to create index on ${indexDef.collection}:`, error);
      }
    }
  }

  async init(): Promise<void> {
    await this.createDefaultIndexes();
  }

  async dangerouslyClearAll(): Promise<void> {
    const collection = await this.getCollection(TABLE_SPANS);
    await collection.deleteMany({});
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const collection = await this.getCollection(TABLE_SPANS);
      await collection.insertOne(record);
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
            spanName: span.name,
          },
        },
        error,
      );
    }
  }

  async getTrace(traceId: string): Promise<TraceRecord | null> {
    try {
      const collection = await this.getCollection(TABLE_SPANS);

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

      const collection = await this.getCollection(TABLE_SPANS);
      await collection.updateOne({ spanId, traceId }, { $set: updateData });
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

  async getTracesPaginated({
    filters,
    pagination,
  }: TracesPaginatedArg): Promise<{ pagination: PaginationInfo; spans: SpanRecord[] }> {
    const page = pagination?.page ?? 0;
    const perPage = pagination?.perPage ?? 10;
    const { entityId, entityType, ...actualFilters } = filters || {};

    try {
      const collection = await this.getCollection(TABLE_SPANS);

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
            id: createStorageErrorId('MONGODB', 'GET_TRACES_PAGINATED', 'INVALID_ENTITY_TYPE'),
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
          id: createStorageErrorId('MONGODB', 'GET_TRACES_PAGINATED', 'FAILED'),
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

      if (records.length > 0) {
        const collection = await this.getCollection(TABLE_SPANS);
        await collection.insertMany(records);
      }
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
      if (args.records.length === 0) {
        return;
      }

      const bulkOps = args.records.map(record => {
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
          updateOne: {
            filter: { spanId: record.spanId, traceId: record.traceId },
            update: { $set: updateData },
          },
        };
      });

      const collection = await this.getCollection(TABLE_SPANS);
      await collection.bulkWrite(bulkOps);
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
      const collection = await this.getCollection(TABLE_SPANS);

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

    return span as SpanRecord;
  }
}
