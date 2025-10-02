import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { PaginationInfo, StorageGetTracesArg, StorageGetTracesPaginatedArg } from '@mastra/core/storage';
import { TABLE_TRACES, TracesStorage, safelyParseJSON } from '@mastra/core/storage';
import type { Trace } from '@mastra/core/telemetry';
import type { StoreOperationsMongoDB } from '../operations';

export class TracesStorageMongoDB extends TracesStorage {
  private operations: StoreOperationsMongoDB;

  constructor({ operations }: { operations: StoreOperationsMongoDB }) {
    super();
    this.operations = operations;
  }

  async getTraces(args: StorageGetTracesArg): Promise<Trace[]> {
    if (args.fromDate || args.toDate) {
      (args as any).dateRange = {
        start: args.fromDate,
        end: args.toDate,
      };
    }
    try {
      const result = await this.getTracesPaginated(args);
      return result.traces;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_GET_TRACES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getTracesPaginated(args: StorageGetTracesPaginatedArg): Promise<PaginationInfo & { traces: Trace[] }> {
    const { name, scope, page = 0, perPage = 100, attributes, filters, dateRange } = args;
    const fromDate = dateRange?.start;
    const toDate = dateRange?.end;
    const currentOffset = page * perPage;

    const query: any = {};
    if (name) {
      query['name'] = new RegExp(name);
    }

    if (scope) {
      query['scope'] = scope;
    }

    if (attributes) {
      query['$and'] = Object.entries(attributes).map(([key, value]) => ({
        [`attributes.${key}`]: value,
      }));
    }

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        query[key] = value;
      });
    }

    if (fromDate || toDate) {
      query['createdAt'] = {};
      if (fromDate) {
        query['createdAt']['$gte'] = fromDate;
      }
      if (toDate) {
        query['createdAt']['$lte'] = toDate;
      }
    }

    try {
      const collection = await this.operations.getCollection(TABLE_TRACES);

      // Get total count
      const total = await collection.countDocuments(query);

      if (total === 0) {
        return {
          traces: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      // Get results with pagination
      const result = await collection
        .find(query, {
          sort: { startTime: -1 },
        })
        .limit(perPage)
        .skip(currentOffset)
        .toArray();

      const traces = result.map(row => ({
        id: row.id,
        parentSpanId: row.parentSpanId,
        traceId: row.traceId,
        name: row.name,
        scope: row.scope,
        kind: row.kind,
        status: safelyParseJSON(row.status),
        events: safelyParseJSON(row.events),
        links: safelyParseJSON(row.links),
        attributes: safelyParseJSON(row.attributes),
        startTime: row.startTime,
        endTime: row.endTime,
        other: safelyParseJSON(row.other),
        createdAt: row.createdAt,
      })) as Trace[];

      return {
        traces,
        total,
        page,
        perPage,
        hasMore: currentOffset + traces.length < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_GET_TRACES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async batchTraceInsert({ records }: { records: Record<string, any>[] }): Promise<void> {
    this.logger.debug('Batch inserting traces', { count: records.length });
    await this.operations.batchInsert({
      tableName: TABLE_TRACES,
      records,
    });
  }
}
