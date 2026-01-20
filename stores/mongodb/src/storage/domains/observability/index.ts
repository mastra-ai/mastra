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
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';

export class ObservabilityMongoDB extends ObservabilityStorage {
  #connector: MongoDBConnector;
  #skipDefaultIndexes?: boolean;
  #indexes?: MongoDBIndexConfig[];

  /** Collections managed by this domain */
  static readonly MANAGED_COLLECTIONS = [TABLE_SPANS] as const;

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
    this.#skipDefaultIndexes = config.skipDefaultIndexes;
    // Filter indexes to only those for collections managed by this domain
    this.#indexes = config.indexes?.filter(idx =>
      (ObservabilityMongoDB.MANAGED_COLLECTIONS as readonly string[]).includes(idx.collection),
    );
  }

  private async getCollection(name: string) {
    return this.#connector.getCollection(name);
  }

  /**
   * Returns default index definitions for the observability domain collections.
   * These indexes optimize common query patterns for span and trace lookups.
   */
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
    if (this.#skipDefaultIndexes) {
      return;
    }

    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        const collection = await this.getCollection(indexDef.collection);
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index on ${indexDef.collection}:`, error);
      }
    }
  }

  /**
   * Creates custom user-defined indexes for this domain's collections.
   */
  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) {
      return;
    }

    for (const indexDef of this.#indexes) {
      try {
        const collection = await this.getCollection(indexDef.collection);
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index on ${indexDef.collection}:`, error);
      }
    }
  }

  async init(): Promise<void> {
    // Check if unique index already exists - if so, skip migration check
    // This avoids running expensive queries on every init after migration is complete
    const uniqueIndexExists = await this.spansUniqueIndexExists();
    if (!uniqueIndexExists) {
      // Check for duplicates before attempting to create unique index
      const duplicateInfo = await this.checkForDuplicateSpans();
      if (duplicateInfo.hasDuplicates) {
        // Duplicates exist - throw error requiring manual migration
        const errorMessage =
          `\n` +
          `===========================================================================\n` +
          `MIGRATION REQUIRED: Duplicate spans detected in ${TABLE_SPANS} collection\n` +
          `===========================================================================\n` +
          `\n` +
          `Found ${duplicateInfo.duplicateCount} duplicate (traceId, spanId) combinations.\n` +
          `\n` +
          `The spans collection requires a unique index on (traceId, spanId), but your\n` +
          `database contains duplicate entries that must be resolved first.\n` +
          `\n` +
          `To fix this, run the manual migration command:\n` +
          `\n` +
          `  npx mastra migrate\n` +
          `\n` +
          `This command will:\n` +
          `  1. Remove duplicate spans (keeping the most complete/recent version)\n` +
          `  2. Add the required unique index\n` +
          `\n` +
          `Note: This migration may take some time for large collections.\n` +
          `===========================================================================\n`;

        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'MIGRATION_REQUIRED', 'DUPLICATE_SPANS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: errorMessage,
        });
      }
    }
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  /**
   * Checks if the unique index on (spanId, traceId) already exists on the spans collection.
   * Used to skip deduplication when the index already exists (migration already complete).
   */
  private async spansUniqueIndexExists(): Promise<boolean> {
    try {
      const collection = await this.getCollection(TABLE_SPANS);
      const indexes = await collection.indexes();
      // Look for unique index on spanId_1_traceId_1
      return indexes.some(idx => idx.unique === true && idx.key?.spanId === 1 && idx.key?.traceId === 1);
    } catch {
      // If we can't check indexes (e.g., collection doesn't exist), assume index doesn't exist
      return false;
    }
  }

  /**
   * Checks for duplicate (traceId, spanId) combinations in the spans collection.
   * Returns information about duplicates for logging/CLI purposes.
   */
  private async checkForDuplicateSpans(): Promise<{
    hasDuplicates: boolean;
    duplicateCount: number;
  }> {
    try {
      const collection = await this.getCollection(TABLE_SPANS);

      // Count duplicate (traceId, spanId) combinations
      const result = await collection
        .aggregate([
          {
            $group: {
              _id: { traceId: '$traceId', spanId: '$spanId' },
              count: { $sum: 1 },
            },
          },
          { $match: { count: { $gt: 1 } } },
          { $count: 'duplicateCount' },
        ])
        .toArray();

      const duplicateCount = result[0]?.duplicateCount ?? 0;
      return {
        hasDuplicates: duplicateCount > 0,
        duplicateCount,
      };
    } catch (error) {
      // If collection doesn't exist or other error, assume no duplicates
      this.logger?.debug?.(`Could not check for duplicates: ${error}`);
      return { hasDuplicates: false, duplicateCount: 0 };
    }
  }

  /**
   * Manually run the spans migration to deduplicate and add the unique index.
   * This is intended to be called from the CLI when duplicates are detected.
   *
   * @returns Migration result with status and details
   */
  async migrateSpans(): Promise<{
    success: boolean;
    alreadyMigrated: boolean;
    duplicatesRemoved: number;
    message: string;
  }> {
    // Check if already migrated
    const indexExists = await this.spansUniqueIndexExists();
    if (indexExists) {
      return {
        success: true,
        alreadyMigrated: true,
        duplicatesRemoved: 0,
        message: `Migration already complete. Unique index exists on ${TABLE_SPANS} collection.`,
      };
    }

    // Check for duplicates
    const duplicateInfo = await this.checkForDuplicateSpans();

    if (duplicateInfo.hasDuplicates) {
      this.logger?.info?.(
        `Found ${duplicateInfo.duplicateCount} duplicate (traceId, spanId) combinations. Starting deduplication...`,
      );

      // Run deduplication
      await this.deduplicateSpans();
    } else {
      this.logger?.info?.(`No duplicate spans found.`);
    }

    // Create indexes (including the unique index)
    await this.createDefaultIndexes();
    await this.createCustomIndexes();

    return {
      success: true,
      alreadyMigrated: false,
      duplicatesRemoved: duplicateInfo.duplicateCount,
      message: duplicateInfo.hasDuplicates
        ? `Migration complete. Removed duplicates and added unique index to ${TABLE_SPANS} collection.`
        : `Migration complete. Added unique index to ${TABLE_SPANS} collection.`,
    };
  }

  /**
   * Check migration status for the spans collection.
   * Returns information about whether migration is needed.
   */
  async checkSpansMigrationStatus(): Promise<{
    needsMigration: boolean;
    hasDuplicates: boolean;
    duplicateCount: number;
    constraintExists: boolean;
    tableName: string;
  }> {
    const indexExists = await this.spansUniqueIndexExists();

    if (indexExists) {
      return {
        needsMigration: false,
        hasDuplicates: false,
        duplicateCount: 0,
        constraintExists: true,
        tableName: TABLE_SPANS,
      };
    }

    const duplicateInfo = await this.checkForDuplicateSpans();
    return {
      needsMigration: true,
      hasDuplicates: duplicateInfo.hasDuplicates,
      duplicateCount: duplicateInfo.duplicateCount,
      constraintExists: false,
      tableName: TABLE_SPANS,
    };
  }

  /**
   * Deduplicates spans with the same (traceId, spanId) combination.
   * This is needed for databases that existed before the unique constraint was added.
   *
   * Priority for keeping spans:
   * 1. Completed spans (endedAt IS NOT NULL) over incomplete spans
   * 2. Most recent updatedAt
   * 3. Most recent createdAt (as tiebreaker)
   *
   * Note: This prioritizes migration completion over perfect data preservation.
   * Old trace data may be lost, which is acceptable for this use case.
   */
  private async deduplicateSpans(): Promise<void> {
    try {
      const collection = await this.getCollection(TABLE_SPANS);

      // Quick check: are there any duplicates at all? Use limit 1 for speed on large collections.
      const duplicateCheck = await collection
        .aggregate([
          {
            $group: {
              _id: { traceId: '$traceId', spanId: '$spanId' },
              count: { $sum: 1 },
            },
          },
          { $match: { count: { $gt: 1 } } },
          { $limit: 1 },
        ])
        .toArray();

      if (duplicateCheck.length === 0) {
        this.logger?.debug?.('No duplicate spans found');
        return;
      }

      this.logger?.info?.('Duplicate spans detected, starting deduplication...');

      // Find IDs to delete using aggregation - only collects ObjectIds, not full documents.
      // This avoids OOM issues on large collections with many duplicates.
      // Priority: completed spans (endedAt NOT NULL) > most recent updatedAt > most recent createdAt
      const idsToDelete = await collection
        .aggregate([
          // Sort by priority (affects which document $first picks within each group)
          {
            $sort: {
              // Completed spans first (endedAt exists and is not null)
              endedAt: -1,
              updatedAt: -1,
              createdAt: -1,
            },
          },
          // Group by (traceId, spanId), keeping the first (best) _id and all _ids
          {
            $group: {
              _id: { traceId: '$traceId', spanId: '$spanId' },
              keepId: { $first: '$_id' }, // The best one to keep (after sort)
              allIds: { $push: '$_id' }, // All ObjectIds (just 12 bytes each, not full docs)
              count: { $sum: 1 },
            },
          },
          // Only consider groups with duplicates
          { $match: { count: { $gt: 1 } } },
          // Get IDs to delete (allIds minus keepId)
          {
            $project: {
              idsToDelete: {
                $filter: {
                  input: '$allIds',
                  cond: { $ne: ['$$this', '$keepId'] },
                },
              },
            },
          },
          // Unwind to get flat list of IDs
          { $unwind: '$idsToDelete' },
          // Just output the ID
          { $project: { _id: '$idsToDelete' } },
        ])
        .toArray();

      if (idsToDelete.length === 0) {
        this.logger?.debug?.('No duplicates to delete after aggregation');
        return;
      }

      // Delete all duplicates in one operation
      const deleteResult = await collection.deleteMany({
        _id: { $in: idsToDelete.map(d => d._id) },
      });

      this.logger?.info?.(`Deduplication complete: removed ${deleteResult.deletedCount} duplicate spans`);
    } catch (error) {
      this.logger?.warn?.('Failed to deduplicate spans:', error);
      // Don't throw - deduplication is best-effort to allow migration to continue
    }
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
        // allowDiskUse enables aggregation to write to temporary files if memory limit (100MB) is exceeded
        const countResult = await collection
          .aggregate([...pipeline, { $count: 'total' }], { allowDiskUse: true })
          .toArray();
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
        const spans = await collection.aggregate(aggregationPipeline, { allowDiskUse: true }).toArray();

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
          .aggregate(
            [
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
            ],
            { allowDiskUse: true },
          )
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
