import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { TABLE_TRACES, TracesStorage } from '@mastra/core/storage';
import type { PaginationInfo, StorageGetTracesPaginatedArg } from '@mastra/core/storage';
import type { Trace } from '@mastra/core/telemetry';
import type { Service } from 'electrodb';
import type { StoreOperationsDynamoDB } from '../operations';

export class TracesStorageDynamoDB extends TracesStorage {
  private service: Service<Record<string, any>>;
  private operations: StoreOperationsDynamoDB;
  constructor({ service, operations }: { service: Service<Record<string, any>>; operations: StoreOperationsDynamoDB }) {
    super();

    this.service = service;
    this.operations = operations;
  }

  // Trace operations
  async getTraces(args: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
    filters?: Record<string, any>;
  }): Promise<any[]> {
    const { name, scope, page, perPage } = args;
    this.logger.debug('Getting traces', { name, scope, page, perPage });

    try {
      let query;

      // Determine which index to use based on the provided filters
      // Provide *all* composite key components for the relevant index
      if (name) {
        query = this.service.entities.trace.query.byName({ entity: 'trace', name });
      } else if (scope) {
        query = this.service.entities.trace.query.byScope({ entity: 'trace', scope });
      } else {
        this.logger.warn('Performing a scan operation on traces - consider using a more specific query');
        query = this.service.entities.trace.scan;
      }

      let items: any[] = [];
      let cursor = null;
      let pagesFetched = 0;
      const startPage = page > 0 ? page : 1;

      do {
        const results: { data: any[]; cursor: string | null } = await query.go({ cursor, limit: perPage });
        pagesFetched++;
        if (pagesFetched === startPage) {
          items = results.data;
          break;
        }
        cursor = results.cursor;
        if (!cursor && results.data.length > 0 && pagesFetched < startPage) {
          break;
        }
      } while (cursor && pagesFetched < startPage);

      return items;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_GET_TRACES_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async batchTraceInsert({ records }: { records: Record<string, any>[] }): Promise<void> {
    this.logger.debug('Batch inserting traces', { count: records.length });

    if (!records.length) {
      return;
    }

    try {
      // Add 'entity' type to each record before passing to generic batchInsert
      const recordsToSave = records.map(rec => ({ entity: 'trace', ...rec }));
      await this.operations.batchInsert({
        tableName: TABLE_TRACES,
        records: recordsToSave, // Pass records with 'entity' included
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_BATCH_TRACE_INSERT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { count: records.length },
        },
        error,
      );
    }
  }

  async getTracesPaginated(args: StorageGetTracesPaginatedArg): Promise<PaginationInfo & { traces: Trace[] }> {
    const { name, scope, page = 0, perPage = 100, attributes, filters, dateRange } = args;
    this.logger.debug('Getting traces with pagination', { name, scope, page, perPage, attributes, filters, dateRange });

    try {
      let query;

      // Determine which index to use based on the provided filters
      if (name) {
        query = this.service.entities.trace.query.byName({ entity: 'trace', name });
      } else if (scope) {
        query = this.service.entities.trace.query.byScope({ entity: 'trace', scope });
      } else {
        this.logger.warn('Performing a scan operation on traces - consider using a more specific query');
        query = this.service.entities.trace.scan;
      }

      // For DynamoDB, we need to fetch all data and apply pagination in memory
      // since DynamoDB doesn't support traditional offset-based pagination
      const results = await query.go({
        order: 'desc',
        pages: 'all', // Get all pages to apply filtering and pagination
      });

      if (!results.data.length) {
        return {
          traces: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      // Apply filters in memory
      let filteredData = results.data;

      // Filter by attributes if provided
      if (attributes) {
        filteredData = filteredData.filter((item: Record<string, any>) => {
          try {
            // Handle the case where attributes might be stored as "[object Object]" or JSON string
            let itemAttributes: Record<string, any> = {};

            if (item.attributes) {
              if (typeof item.attributes === 'string') {
                if (item.attributes === '[object Object]') {
                  // This means the object was stringified incorrectly
                  itemAttributes = {};
                } else {
                  try {
                    itemAttributes = JSON.parse(item.attributes);
                  } catch {
                    itemAttributes = {};
                  }
                }
              } else if (typeof item.attributes === 'object') {
                itemAttributes = item.attributes;
              }
            }

            return Object.entries(attributes).every(([key, value]) => itemAttributes[key] === value);
          } catch (e) {
            this.logger.warn('Failed to parse attributes during filtering', { item, error: e });
            return false;
          }
        });
      }

      // Filter by date range if provided
      if (dateRange?.start) {
        filteredData = filteredData.filter((item: Record<string, any>) => {
          const itemDate = new Date(item.createdAt);
          return itemDate >= dateRange.start!;
        });
      }

      if (dateRange?.end) {
        filteredData = filteredData.filter((item: Record<string, any>) => {
          const itemDate = new Date(item.createdAt);
          return itemDate <= dateRange.end!;
        });
      }

      // Apply pagination
      const total = filteredData.length;
      const start = page * perPage;
      const end = start + perPage;
      const paginatedData = filteredData.slice(start, end);

      const traces = paginatedData.map((item: any) => {
        // Handle the case where attributes might be stored as "[object Object]" or JSON string
        let attributes: Record<string, any> | undefined;
        if (item.attributes) {
          if (typeof item.attributes === 'string') {
            if (item.attributes === '[object Object]') {
              attributes = undefined;
            } else {
              try {
                attributes = JSON.parse(item.attributes);
              } catch {
                attributes = undefined;
              }
            }
          } else if (typeof item.attributes === 'object') {
            attributes = item.attributes;
          }
        }

        let status: Record<string, any> | undefined;
        if (item.status) {
          if (typeof item.status === 'string') {
            try {
              status = JSON.parse(item.status);
            } catch {
              status = undefined;
            }
          } else if (typeof item.status === 'object') {
            status = item.status;
          }
        }

        let events: any[] | undefined;
        if (item.events) {
          if (typeof item.events === 'string') {
            try {
              events = JSON.parse(item.events);
            } catch {
              events = undefined;
            }
          } else if (Array.isArray(item.events)) {
            events = item.events;
          }
        }

        let links: any[] | undefined;
        if (item.links) {
          if (typeof item.links === 'string') {
            try {
              links = JSON.parse(item.links);
            } catch {
              links = undefined;
            }
          } else if (Array.isArray(item.links)) {
            links = item.links;
          }
        }

        return {
          id: item.id,
          parentSpanId: item.parentSpanId,
          name: item.name,
          traceId: item.traceId,
          scope: item.scope,
          kind: item.kind,
          attributes,
          status,
          events,
          links,
          other: item.other,
          startTime: item.startTime,
          endTime: item.endTime,
          createdAt: item.createdAt,
        };
      });

      return {
        traces,
        total,
        page,
        perPage,
        hasMore: end < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_GET_TRACES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
