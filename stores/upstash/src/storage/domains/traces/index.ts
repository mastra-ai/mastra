import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { StorageGetTracesArg, PaginationInfo, PaginationArgs } from '@mastra/core/storage';
import { TracesStorage, TABLE_TRACES } from '@mastra/core/storage';
import type { Redis } from '@upstash/redis';
import type { StoreOperationsUpstash } from '../operations';
import { ensureDate, parseJSON } from '../utils';

export class TracesUpstash extends TracesStorage {
  private client: Redis;
  private operations: StoreOperationsUpstash;

  constructor({ client, operations }: { client: Redis; operations: StoreOperationsUpstash }) {
    super();
    this.client = client;
    this.operations = operations;
  }

  /**
   * @deprecated use getTracesPaginated instead
   */
  public async getTraces(args: StorageGetTracesArg): Promise<any[]> {
    if (args.fromDate || args.toDate) {
      (args as any).dateRange = {
        start: args.fromDate,
        end: args.toDate,
      };
    }
    try {
      const { traces } = await this.getTracesPaginated(args);
      return traces;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_GET_TRACES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  public async getTracesPaginated(
    args: {
      name?: string;
      scope?: string;
      attributes?: Record<string, string>;
      filters?: Record<string, any>;
    } & PaginationArgs,
  ): Promise<PaginationInfo & { traces: any[] }> {
    const { name, scope, page = 0, perPage = 100, attributes, filters, dateRange } = args;
    const fromDate = dateRange?.start;
    const toDate = dateRange?.end;

    try {
      const pattern = `${TABLE_TRACES}:*`;
      const keys = await this.operations.scanKeys(pattern);

      if (keys.length === 0) {
        return {
          traces: [],
          total: 0,
          page,
          perPage: perPage || 100,
          hasMore: false,
        };
      }

      const pipeline = this.client.pipeline();
      keys.forEach(key => pipeline.get(key));
      const results = await pipeline.exec();

      let filteredTraces = results.filter(
        (record): record is Record<string, any> => record !== null && typeof record === 'object',
      );

      if (name) {
        filteredTraces = filteredTraces.filter(record => record.name?.toLowerCase().startsWith(name.toLowerCase()));
      }
      if (scope) {
        filteredTraces = filteredTraces.filter(record => record.scope === scope);
      }
      if (attributes) {
        filteredTraces = filteredTraces.filter(record => {
          const recordAttributes = record.attributes;
          if (!recordAttributes) return false;
          const parsedAttributes =
            typeof recordAttributes === 'string' ? JSON.parse(recordAttributes) : recordAttributes;
          return Object.entries(attributes).every(([key, value]) => parsedAttributes[key] === value);
        });
      }
      if (filters) {
        filteredTraces = filteredTraces.filter(record =>
          Object.entries(filters).every(([key, value]) => record[key] === value),
        );
      }
      if (fromDate) {
        filteredTraces = filteredTraces.filter(
          record => new Date(record.createdAt).getTime() >= new Date(fromDate).getTime(),
        );
      }
      if (toDate) {
        filteredTraces = filteredTraces.filter(
          record => new Date(record.createdAt).getTime() <= new Date(toDate).getTime(),
        );
      }

      filteredTraces.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const transformedTraces = filteredTraces.map(record => ({
        id: record.id,
        parentSpanId: record.parentSpanId,
        traceId: record.traceId,
        name: record.name,
        scope: record.scope,
        kind: record.kind,
        status: parseJSON(record.status),
        events: parseJSON(record.events),
        links: parseJSON(record.links),
        attributes: parseJSON(record.attributes),
        startTime: record.startTime,
        endTime: record.endTime,
        other: parseJSON(record.other),
        createdAt: ensureDate(record.createdAt),
      }));

      const total = transformedTraces.length;
      const resolvedPerPage = perPage || 100;
      const start = page * resolvedPerPage;
      const end = start + resolvedPerPage;
      const paginatedTraces = transformedTraces.slice(start, end);
      const hasMore = end < total;

      return {
        traces: paginatedTraces,
        total,
        page,
        perPage: resolvedPerPage,
        hasMore,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_GET_TRACES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            name: args.name || '',
            scope: args.scope || '',
          },
        },
        error,
      );
      this.logger?.trackException(mastraError);
      this.logger.error(mastraError.toString());
      return {
        traces: [],
        total: 0,
        page,
        perPage: perPage || 100,
        hasMore: false,
      };
    }
  }

  async batchTraceInsert(args: { records: Record<string, any>[] }): Promise<void> {
    return this.operations.batchInsert({
      tableName: TABLE_TRACES,
      records: args.records,
    });
  }
}
