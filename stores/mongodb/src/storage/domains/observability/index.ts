import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  listTracesArgsSchema,
  ObservabilityStorage,
  TABLE_SPANS,
  TraceStatus,
} from '@mastra/core/storage';
import type {
  SpanRecord,
  UpdateSpanRecord,
  PaginationInfo,
  ListTracesArgs,
  TracingStorageStrategy,
  UpdateSpanArgs,
  BatchDeleteTracesArgs,
  BatchCreateSpansArgs,
  BatchUpdateSpansArgs,
  CreateSpanArgs,
  GetSpanArgs,
  GetSpanResponse,
  GetRootSpanArgs,
  GetRootSpanResponse,
  GetTraceArgs,
  GetTraceResponse,
} from '@mastra/core/storage';
import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig } from '../../types';

export class ObservabilityMongoDB extends ObservabilityStorage {
  #connector: MongoDBConnector;

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
  }

  private async getCollection(name: string) {
    return this.#connector.getCollection(name);
  }

  async init(): Promise<void> {
    const collection = await this.getCollection(TABLE_SPANS);
    await collection.createIndex({ spanId: 1, traceId: 1 }, { unique: true });
    await collection.createIndex({ traceId: 1 });
    await collection.createIndex({ parentSpanId: 1 });
    await collection.createIndex({ startedAt: -1 });
    await collection.createIndex({ spanType: 1 });
    await collection.createIndex({ name: 1 });
  }

  async dangerouslyClearAll(): Promise<void> {
    const collection = await this.getCollection(TABLE_SPANS);
    await collection.deleteMany({});
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

  async createSpan(args: CreateSpanArgs): Promise<void> {
    const { span } = args;
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
            name: span.name,
          },
        },
        error,
      );
    }
  }

  async getSpan(args: GetSpanArgs): Promise<GetSpanResponse | null> {
    const { traceId, spanId } = args;
    try {
      const collection = await this.getCollection(TABLE_SPANS);
      const span = await collection.findOne({ traceId, spanId });

      if (!span) {
        return null;
      }

      return {
        span: this.transformSpanFromMongo(span),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { traceId, spanId },
        },
        error,
      );
    }
  }

  async getRootSpan(args: GetRootSpanArgs): Promise<GetRootSpanResponse | null> {
    const { traceId } = args;
    try {
      const collection = await this.getCollection(TABLE_SPANS);
      const span = await collection.findOne({ traceId, parentSpanId: null });

      if (!span) {
        return null;
      }

      return {
        span: this.transformSpanFromMongo(span),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_ROOT_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { traceId },
        },
        error,
      );
    }
  }

  async getTrace(args: GetTraceArgs): Promise<GetTraceResponse | null> {
    const { traceId } = args;
    try {
      const collection = await this.getCollection(TABLE_SPANS);

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

  async updateSpan(args: UpdateSpanArgs): Promise<void> {
    const { traceId, spanId, updates } = args;
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

  async listTraces(args: ListTracesArgs): Promise<{ pagination: PaginationInfo; spans: SpanRecord[] }> {
    // Parse args through schema to apply defaults
    const { filters, pagination, orderBy } = listTracesArgsSchema.parse(args);
    const { page, perPage } = pagination;

    try {
      const collection = await this.getCollection(TABLE_SPANS);

      // Build MongoDB query filter
      const mongoFilter: Record<string, any> = {
        parentSpanId: null, // Only get root spans for traces
      };
      const andConditions: Record<string, any>[] = [];

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
            andConditions.push({ endedAt: endedAtFilter });
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
        if (filters.scope != null) {
          for (const [key, value] of Object.entries(filters.scope)) {
            mongoFilter[`scope.${key}`] = value;
          }
        }

        // Metadata filter
        if (filters.metadata != null) {
          for (const [key, value] of Object.entries(filters.metadata)) {
            mongoFilter[`metadata.${key}`] = value;
          }
        }

        // Tags filter (all tags must be present)
        if (filters.tags != null && filters.tags.length > 0) {
          mongoFilter.tags = { $all: filters.tags };
        }

        // Status filter (derived from error and endedAt)
        if (filters.status !== undefined) {
          switch (filters.status) {
            case TraceStatus.ERROR:
              andConditions.push({ error: { $exists: true, $ne: null } });
              break;
            case TraceStatus.RUNNING:
              andConditions.push({ endedAt: null, error: null });
              break;
            case TraceStatus.SUCCESS:
              andConditions.push({ endedAt: { $exists: true, $ne: null }, error: null });
              break;
          }
        }
      }
      if (andConditions.length) {
        mongoFilter.$and = andConditions;
      }

      // Build sort
      const sortField = orderBy.field;
      const sortDirection = orderBy.direction === 'ASC' ? 1 : -1;

      // hasChildError filter requires $lookup aggregation for efficiency
      // Instead of fetching all traceIds with errors (unbounded), we use $lookup
      // to check for child errors within each trace
      if (filters?.hasChildError !== undefined) {
        const pipeline: any[] = [
          { $match: mongoFilter },
          // Lookup child spans with errors for this trace
          {
            $lookup: {
              from: TABLE_SPANS,
              let: { traceId: '$traceId' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ['$traceId', '$$traceId'] },
                    error: { $exists: true, $ne: null },
                  },
                },
                { $limit: 1 }, // Only need to know if at least one exists
              ],
              as: '_errorSpans',
            },
          },
          // Filter based on whether error spans exist
          {
            $match: filters.hasChildError
              ? { _errorSpans: { $ne: [] } } // Has at least one child with error
              : { _errorSpans: { $eq: [] } }, // No children with errors
          },
        ];

        // Get count using aggregation
        const countResult = await collection.aggregate([...pipeline, { $count: 'total' }]).toArray();
        const count = countResult[0]?.total || 0;

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

        // Get paginated spans with proper NULL ordering for endedAt
        let aggregationPipeline: any[];
        if (sortField === 'endedAt') {
          // Add helper field to sort NULLs first for DESC, last for ASC
          const nullSortValue = sortDirection === -1 ? 0 : 1;
          aggregationPipeline = [
            ...pipeline,
            {
              $addFields: {
                _endedAtNull: { $cond: [{ $eq: ['$endedAt', null] }, nullSortValue, sortDirection === -1 ? 1 : 0] },
              },
            },
            { $sort: { _endedAtNull: 1, [sortField]: sortDirection } },
            { $skip: page * perPage },
            { $limit: perPage },
            { $project: { _errorSpans: 0, _endedAtNull: 0 } },
          ];
        } else {
          aggregationPipeline = [
            ...pipeline,
            { $sort: { [sortField]: sortDirection } },
            { $skip: page * perPage },
            { $limit: perPage },
            { $project: { _errorSpans: 0 } },
          ];
        }
        const spans = await collection.aggregate(aggregationPipeline).toArray();

        return {
          pagination: {
            total: count,
            page,
            perPage,
            hasMore: (page + 1) * perPage < count,
          },
          spans: spans.map((span: any) => this.transformSpanFromMongo(span)),
        };
      }

      // Standard query path (no hasChildError filter)
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
      // MongoDB's natural NULL ordering: NULLs first for ASC, last for DESC
      // For endedAt we want the opposite: NULLs FIRST for DESC, LAST for ASC
      // So we need aggregation with $addFields to control NULL ordering for endedAt
      let spans: any[];
      if (sortField === 'endedAt') {
        // Use aggregation to handle NULL ordering for endedAt
        // Add a helper field to sort NULLs first for DESC, last for ASC
        const nullSortValue = sortDirection === -1 ? 0 : 1; // DESC: NULLs first (0), ASC: NULLs last (1)
        spans = await collection
          .aggregate([
            { $match: mongoFilter },
            {
              $addFields: {
                _endedAtNull: { $cond: [{ $eq: ['$endedAt', null] }, nullSortValue, sortDirection === -1 ? 1 : 0] },
              },
            },
            { $sort: { _endedAtNull: 1, [sortField]: sortDirection } },
            { $skip: page * perPage },
            { $limit: perPage },
            { $project: { _endedAtNull: 0 } },
          ])
          .toArray();
      } else {
        // For startedAt (never null), use simple find()
        spans = await collection
          .find(mongoFilter)
          .sort({ [sortField]: sortDirection })
          .skip(page * perPage)
          .limit(perPage)
          .toArray();
      }

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

  async batchCreateSpans(args: BatchCreateSpansArgs): Promise<void> {
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

  async batchUpdateSpans(args: BatchUpdateSpansArgs): Promise<void> {
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

  async batchDeleteTraces(args: BatchDeleteTracesArgs): Promise<void> {
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
