import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { TABLE_TRACES, TracesStorage } from '@mastra/core/storage';
import type { StorageGetTracesArg, StorageGetTracesPaginatedArg, PaginationInfo } from '@mastra/core/storage';
import type { Trace } from '@mastra/core/telemetry';
import type { StoreOperationsCloudflare } from '../operations';

export class TracesStorageCloudflare extends TracesStorage {
  private operations: StoreOperationsCloudflare;

  constructor({ operations }: { operations: StoreOperationsCloudflare }) {
    super();
    this.operations = operations;
  }

  async getTraces(args: StorageGetTracesArg): Promise<Trace[]> {
    // Convert the old interface to the new paginated interface
    const paginatedArgs: StorageGetTracesPaginatedArg = {
      name: args.name,
      scope: args.scope,
      page: args.page,
      perPage: args.perPage,
      attributes: args.attributes,
      filters: args.filters,
      dateRange:
        args.fromDate || args.toDate
          ? {
              start: args.fromDate,
              end: args.toDate,
            }
          : undefined,
    };

    try {
      const result = await this.getTracesPaginated(paginatedArgs);
      return result.traces;
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_GET_TRACES_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to retrieve traces: ${error instanceof Error ? error.message : String(error)}`,
          details: {
            name: args.name ?? '',
            scope: args.scope ?? '',
          },
        },
        error,
      );
    }
  }

  async getTracesPaginated(args: StorageGetTracesPaginatedArg): Promise<PaginationInfo & { traces: Trace[] }> {
    try {
      const { name, scope, attributes, filters, page = 0, perPage = 100, dateRange } = args;

      // List all keys in the traces table
      const prefix = this.operations.namespacePrefix ? `${this.operations.namespacePrefix}:` : '';
      const keyObjs = await this.operations.listKV(TABLE_TRACES, { prefix: `${prefix}${TABLE_TRACES}` });

      const traces: Trace[] = [];

      for (const { name: key } of keyObjs) {
        try {
          const data = await this.operations.getKV(TABLE_TRACES, key);
          if (!data) continue;

          // Filter by name
          if (name && data.name !== name) continue;

          // Filter by scope
          if (scope && data.scope !== scope) continue;

          // Filter by attributes
          if (attributes) {
            const dataAttributes = data.attributes || {};
            let shouldSkip = false;
            for (const [key, value] of Object.entries(attributes)) {
              if (dataAttributes[key] !== value) {
                shouldSkip = true;
                break;
              }
            }
            if (shouldSkip) continue;
          }

          // Filter by date range
          if (dateRange?.start || dateRange?.end) {
            const traceDate = new Date(data.createdAt || 0);
            if (dateRange.start && traceDate < dateRange.start) continue;
            if (dateRange.end && traceDate > dateRange.end) continue;
          }

          // Filter by custom filters
          if (filters) {
            let shouldSkip = false;
            for (const [key, value] of Object.entries(filters)) {
              if (data[key] !== value) {
                shouldSkip = true;
                break;
              }
            }
            if (shouldSkip) continue;
          }

          traces.push(data);
        } catch (err) {
          this.logger.error('Failed to parse trace:', { key, error: err });
        }
      }

      // Sort by timestamp descending
      traces.sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });

      // Apply pagination
      const total = traces.length;
      const start = page * perPage;
      const end = start + perPage;
      const pagedTraces = traces.slice(start, end);

      return {
        traces: pagedTraces,
        total,
        page,
        perPage,
        hasMore: end < total,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_GET_TRACES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: 'Error getting traces with pagination',
        },
        error,
      );
      this.logger.trackException?.(mastraError);
      this.logger.error(mastraError.toString());
      return { traces: [], total: 0, page: 0, perPage: 100, hasMore: false };
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
