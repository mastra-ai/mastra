import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { ObservabilityStorage, TABLE_AI_SPAN, safelyParseJSON } from '@mastra/core/storage';
import type { StorageGetAiTracesPaginatedArg, PaginationInfo, AITrace, AISpanRecord } from '@mastra/core/storage';
import type { Redis } from '@upstash/redis';
import type { StoreOperationsUpstash } from '../operations';
import { parseJSON } from '../utils';

export class ObservabilityUpstash extends ObservabilityStorage {
  private client: Redis;
  private operations: StoreOperationsUpstash;

  constructor({ client, operations }: { client: Redis; operations: StoreOperationsUpstash }) {
    super();
    this.client = client;
    this.operations = operations;
  }

  async createAISpan(span: Omit<AISpanRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      const id = `${span.traceId}-${span.spanId}`;
      const key = `${TABLE_AI_SPAN}:${id}`;
      const record = { ...span, id };

      // Store directly in Redis to ensure data integrity
      await this.client.set(key, record);
    } catch (error) {
      throw new MastraError(
        {
          id: 'UPSTASH_STORAGE_CREATE_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to create AI span: ${error}`,
      );
    }
  }

  async getAISpan(id: string): Promise<Record<string, any> | null> {
    try {
      const key = `${TABLE_AI_SPAN}:${id}`;
      const data = await this.client.get(key);

      if (!data) {
        return null;
      }

      return this.transformRowToAISpan(data as Record<string, any>);
    } catch (error) {
      throw new MastraError(
        {
          id: 'UPSTASH_STORAGE_GET_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to get AI span: ${error}`,
      );
    }
  }

  async updateAISpan(id: string, updates: Partial<AISpanRecord>): Promise<void> {
    try {
      // First check if the span exists
      const existingSpan = await this.getAISpan(id);
      if (!existingSpan) {
        throw new MastraError(
          {
            id: 'UPSTASH_STORAGE_UPDATE_AI_SPAN_NOT_FOUND',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
          },
          `AI span not found for update: ${id}`,
        );
      }

      // Merge updates with existing data
      const updatedSpan = { ...existingSpan, ...updates };

      // Update the span
      const key = `${TABLE_AI_SPAN}:${id}`;
      await this.client.set(key, updatedSpan);
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: 'UPSTASH_STORAGE_UPDATE_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to update AI span: ${error}`,
      );
    }
  }

  async deleteAISpan(id: string): Promise<void> {
    try {
      const key = `${TABLE_AI_SPAN}:${id}`;
      await this.client.del(key);
    } catch (error) {
      throw new MastraError(
        {
          id: 'UPSTASH_STORAGE_DELETE_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to delete AI span: ${error}`,
      );
    }
  }

  /**
   * Builds filter conditions for AI span queries.
   * Supported filters:
   * - name: string (startsWith search)
   * - attributes: object (JSON field filtering)
   * - error: object (JSON field filtering)
   * - dateRange: object with start/end dates for startTime filtering
   * - traceId: string (exact match)
   * - spanType: number (exact match)
   */
  private buildFilterConditions(filters?: any): (span: Record<string, any>) => boolean {
    if (!filters) {
      return () => true; // No filters, return all spans
    }

    return (span: Record<string, any>): boolean => {
      // Name filtering (startsWith)
      if (filters.name && typeof filters.name === 'string') {
        if (span.name !== filters.name) {
          return false;
        }
      }

      // Attributes filtering (JSON field)
      if (filters.attributes && typeof filters.attributes === 'object') {
        const spanAttributes = parseJSON(span.attributes);
        if (!spanAttributes) return false;

        for (const [key, value] of Object.entries(filters.attributes)) {
          if (key.includes('.')) {
            // Handle nested JSON paths like 'service.name'
            const keys = key.split('.');
            let currentValue: any = spanAttributes;
            for (const k of keys) {
              if (currentValue && typeof currentValue === 'object') {
                currentValue = currentValue[k];
              } else {
                return false;
              }
            }
            if (currentValue !== value) {
              return false;
            }
          } else {
            if (spanAttributes[key] !== value) {
              return false;
            }
          }
        }
      }

      // Error filtering (JSON field)
      if (filters.error && typeof filters.error === 'object') {
        const spanError = parseJSON(span.error);
        if (!spanError) return false;

        for (const [key, value] of Object.entries(filters.error)) {
          if (key.includes('.')) {
            // Handle nested JSON paths
            const keys = key.split('.');
            let currentValue: any = spanError;
            for (const k of keys) {
              if (currentValue && typeof currentValue === 'object') {
                currentValue = currentValue[k];
              } else {
                return false;
              }
            }
            if (currentValue !== value) {
              return false;
            }
          } else {
            if (spanError[key] !== value) {
              return false;
            }
          }
        }
      }

      // Date range filtering using startTime (milliseconds since epoch)
      if (filters.dateRange?.start) {
        const startTs =
          filters.dateRange.start instanceof Date
            ? filters.dateRange.start.getTime()
            : new Date(filters.dateRange.start).getTime();
        if ((span.startTime || 0) < startTs) {
          return false;
        }
      }

      if (filters.dateRange?.end) {
        const endTs =
          filters.dateRange.end instanceof Date
            ? filters.dateRange.end.getTime()
            : new Date(filters.dateRange.end).getTime();
        if ((span.startTime || 0) > endTs) {
          return false;
        }
      }

      // TraceId filtering
      if (filters.traceId !== undefined) {
        if (span.traceId !== filters.traceId) {
          return false;
        }
      }

      // SpanType filtering
      if (filters.spanType !== undefined) {
        if (span.spanType !== filters.spanType) {
          return false;
        }
      }

      return true;
    };
  }

  async getAITrace(traceId: string): Promise<AITrace | null> {
    try {
      const pattern = `${TABLE_AI_SPAN}:*`;
      const keys = await this.operations.scanKeys(pattern);

      if (keys.length === 0) {
        return null;
      }

      const result = await this.client.mget(keys);

      if (result.length === 0) {
        return null;
      }

      return {
        traceId,
        spans: result.map(row => this.transformRowToAISpan(row as Record<string, any>)) as AISpanRecord[],
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'UPSTASH_STORAGE_GET_AI_TRACE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to get AI trace: ${error}`,
      );
    }
  }

  async getAITracesPaginated(
    args: StorageGetAiTracesPaginatedArg,
  ): Promise<PaginationInfo & { spans: Record<string, any>[] }> {
    try {
      const { filters, page = 0, perPage = 10 } = args;
      const pattern = `${TABLE_AI_SPAN}:*`;
      const keys = await this.operations.scanKeys(pattern);

      if (keys.length === 0) {
        return {
          spans: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      // Fetch all spans
      const pipeline = this.client.pipeline();
      keys.forEach(key => pipeline.get(key));
      const results = await pipeline.exec();

      const allSpans = results
        .filter((record): record is Record<string, any> => record !== null && typeof record === 'object')
        .map(record => this.transformRowToAISpan(record));

      // Separate parent and child spans
      const parentSpans = allSpans.filter(span => !span.parentSpanId);

      // Apply filters to parent spans only (for pagination)
      const filterFunction = this.buildFilterConditions(filters);
      const filteredParentSpans = parentSpans.filter(filterFunction);

      // Sort parent spans by startTime (newest first)
      filteredParentSpans.sort((a, b) => {
        const timeA = a.startTime || 0;
        const timeB = b.startTime || 0;
        return timeB - timeA; // Descending order (newest first)
      });

      // Apply pagination to parent spans
      const total = filteredParentSpans.length;
      const start = page * perPage;
      const end = start + perPage;
      const paginatedParentSpans = filteredParentSpans.slice(start, end);

      // Return only root spans (no child spans)
      return {
        spans: paginatedParentSpans,
        total,
        page,
        perPage,
        hasMore: total > end,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'UPSTASH_STORAGE_GET_AI_SPANS_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to get AI spans paginated: ${error}`,
      );
    }
  }

  private transformRowToAISpan(row: Record<string, any>): Record<string, any> {
    return {
      ...row, // Preserve all original fields including id
      scope: safelyParseJSON(row.scope),
      attributes: safelyParseJSON(row.attributes),
      metadata: safelyParseJSON(row.metadata),
      events: safelyParseJSON(row.events),
      links: safelyParseJSON(row.links),
      input: safelyParseJSON(row.input),
      output: safelyParseJSON(row.output),
      error: safelyParseJSON(row.error),
    };
  }

  async batchCreateAISpan(args: { records: Omit<AISpanRecord, 'id' | 'createdAt' | 'updatedAt'>[] }): Promise<void> {
    if (args.records.length === 0) {
      return; // No records to insert
    }

    try {
      const pipeline = this.client.pipeline();

      args.records.forEach(record => {
        const id = `${record.traceId}-${record.spanId}`;
        const key = `${TABLE_AI_SPAN}:${id}`;
        const recordWithId = { ...record, id };
        pipeline.set(key, recordWithId);
      });

      await pipeline.exec();
    } catch (error) {
      throw new MastraError(
        {
          id: 'UPSTASH_STORAGE_BATCH_AI_SPAN_CREATE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to batch create AI spans: ${error}`,
      );
    }
  }

  async batchUpdateAISpan(args: { records: { id: string; updates: Partial<AISpanRecord> }[] }): Promise<void> {
    if (args.records.length === 0) {
      return; // No updates to make
    }

    try {
      for (const { id, updates } of args.records) {
        await this.updateAISpan(id, updates);
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'UPSTASH_STORAGE_BATCH_AI_SPAN_UPDATE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to batch update AI spans: ${error}`,
      );
    }
  }

  async batchDeleteAISpan(args: { ids: string[] }): Promise<void> {
    if (args.ids.length === 0) {
      return; // No IDs to delete
    }

    try {
      const pipeline = this.client.pipeline();
      args.ids.forEach(id => {
        const key = `${TABLE_AI_SPAN}:${id}`;
        pipeline.del(key);
      });
      await pipeline.exec();
    } catch (error) {
      throw new MastraError(
        {
          id: 'UPSTASH_STORAGE_BATCH_AI_SPAN_DELETE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to batch delete AI spans: ${error}`,
      );
    }
  }
}
