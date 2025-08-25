import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { ObservabilityStorage, TABLE_AI_SPAN } from '@mastra/core/storage';
import type { AITrace, PaginationInfo, StorageGetAiTracesPaginatedArg, AISpanRecord } from '@mastra/core/storage';
import type { StoreOperationsCloudflare } from '../operations';

export class ObservabilityStorageCloudflare extends ObservabilityStorage {
  private operations: StoreOperationsCloudflare;

  constructor({ operations }: { operations: StoreOperationsCloudflare }) {
    super();
    this.operations = operations;
  }

  async createAISpan(span: Record<string, any>): Promise<void> {
    try {
      // Ensure required fields are present
      if (!span.traceId) {
        span.traceId = crypto.randomUUID();
      }

      if (!span.spanId) {
        span.spanId = crypto.randomUUID();
      }

      // Generate ID as combination of traceId-spanId
      span.id = `${span.traceId}-${span.spanId}`;

      // Set timestamps if not provided
      if (!span.createdAt) {
        span.createdAt = new Date().toISOString();
      }

      if (!span.updatedAt) {
        span.updatedAt = new Date().toISOString();
      }

      // Store the span in KV storage using batchInsert for consistency
      await this.operations.batchInsert({
        tableName: TABLE_AI_SPAN,
        records: [span],
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_CREATE_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to create AI span: ${error}`,
      );
    }
  }

  async getAISpan(id: string): Promise<Record<string, any> | null> {
    try {
      // Generate the proper key for the span
      const key = this.operations.getKey(TABLE_AI_SPAN, { id });

      // Retrieve the span from KV storage
      const span = await this.operations.getKV(TABLE_AI_SPAN, key);
      if (!span) {
        return null;
      }

      return span;
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_GET_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to get AI span: ${error}`,
      );
    }
  }

  async getAITrace(traceId: string): Promise<AITrace | null> {
    try {
      const prefix = this.operations.namespacePrefix ? `${this.operations.namespacePrefix}:` : '';
      const keyObjs = await this.operations.listKV(TABLE_AI_SPAN, { prefix: `${prefix}${TABLE_AI_SPAN}` });

      const allSpans: AISpanRecord[] = [];

      for (const { name: key } of keyObjs) {
        const data = await this.operations.getKV(TABLE_AI_SPAN, key);
        if (!data) continue;

        if (data.traceId === traceId) {
          allSpans.push(data);
        }
      }

      if (allSpans.length === 0) {
        return null;
      }

      return {
        traceId,
        spans: allSpans,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_GET_AI_TRACE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to get AI trace: ${error}`,
      );
    }
  }

  async updateAISpan(id: string, updates: Record<string, any>): Promise<void> {
    try {
      // Generate the proper key for the span
      const key = this.operations.getKey(TABLE_AI_SPAN, { id });

      // First, get the existing span to merge with updates
      const existingSpan = await this.operations.getKV(TABLE_AI_SPAN, key);

      if (!existingSpan) {
        throw new MastraError(
          {
            id: 'CLOUDFLARE_STORAGE_UPDATE_AI_SPAN_NOT_FOUND',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
          },
          `AI span with id ${id} not found`,
        );
      }

      // Merge existing data with updates
      const updatedSpan = {
        ...existingSpan,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      // Store the updated span back to KV storage
      await this.operations.putKV({
        tableName: TABLE_AI_SPAN,
        key: key,
        value: updatedSpan,
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_UPDATE_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to update AI span: ${error}`,
      );
    }
  }

  async deleteAISpan(id: string): Promise<void> {
    try {
      // Generate the proper key for the span
      const key = this.operations.getKey(TABLE_AI_SPAN, { id });

      // Check if the span exists before attempting to delete
      const existingSpan = await this.operations.getKV(TABLE_AI_SPAN, key);

      if (!existingSpan) {
        return;
      }

      // Delete the span from KV storage
      await this.operations.deleteKV(TABLE_AI_SPAN, key);
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_DELETE_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to delete AI span: ${error}`,
      );
    }
  }

  async batchCreateAISpan(args: { records: Record<string, any>[] }): Promise<void> {
    try {
      if (!args.records || args.records.length === 0) {
        return;
      }

      // Process each span to ensure proper IDs and timestamps
      const processedRecords = args.records.map(span => {
        // Ensure required fields are present
        if (!span.traceId) {
          span.traceId = crypto.randomUUID();
        }

        if (!span.spanId) {
          span.spanId = crypto.randomUUID();
        }

        // Generate ID as combination of traceId-spanId
        span.id = `${span.traceId}-${span.spanId}`;

        // Set timestamps if not provided
        if (!span.createdAt) {
          span.createdAt = new Date().toISOString();
        }

        if (!span.updatedAt) {
          span.updatedAt = new Date().toISOString();
        }

        return span;
      });

      // Use the batch insert operation for efficiency
      await this.operations.batchInsert({
        tableName: TABLE_AI_SPAN,
        records: processedRecords,
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_BATCH_AI_SPAN_CREATE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to batch create AI spans: ${error}`,
      );
    }
  }

  async batchUpdateAISpan(args: { records: { id: string; updates: Record<string, any> }[] }): Promise<void> {
    try {
      if (!args.records || args.records.length === 0) {
        return;
      }

      // Process each update operation
      await Promise.all(
        args.records.map(async ({ id, updates }) => {
          // Generate the proper key for the span
          const key = this.operations.getKey(TABLE_AI_SPAN, { id });

          // Get the existing span to merge with updates
          const existingSpan = await this.operations.getKV(TABLE_AI_SPAN, key);

          if (!existingSpan) {
            // Skip if span doesn't exist (silent failure for batch operations)
            return;
          }

          // Merge existing data with updates
          const updatedSpan = {
            ...existingSpan,
            ...updates,
            updatedAt: new Date().toISOString(),
          };

          // Store the updated span back to KV storage
          await this.operations.putKV({
            tableName: TABLE_AI_SPAN,
            key: key,
            value: updatedSpan,
          });
        }),
      );
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_BATCH_AI_SPAN_UPDATE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to batch update AI spans: ${error}`,
      );
    }
  }

  async batchDeleteAISpan(args: { ids: string[] }): Promise<void> {
    try {
      if (!args.ids || args.ids.length === 0) {
        return;
      }

      // Process each delete operation
      await Promise.all(
        args.ids.map(async id => {
          // Generate the proper key for the span
          const key = this.operations.getKey(TABLE_AI_SPAN, { id });

          // Check if the span exists before attempting to delete
          const existingSpan = await this.operations.getKV(TABLE_AI_SPAN, key);

          if (!existingSpan) {
            // Skip if span doesn't exist (silent failure for batch operations)
            return;
          }

          // Delete the span from KV storage
          await this.operations.deleteKV(TABLE_AI_SPAN, key);
        }),
      );
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_BATCH_AI_SPAN_DELETE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to batch delete AI spans: ${error}`,
      );
    }
  }

  async getAITracesPaginated(
    args: StorageGetAiTracesPaginatedArg,
  ): Promise<PaginationInfo & { spans: Record<string, any>[] }> {
    try {
      const { filters, page = 0, perPage = 100 } = args;

      // List all keys in the AI spans table
      const prefix = this.operations.namespacePrefix ? `${this.operations.namespacePrefix}:` : '';
      const keyObjs = await this.operations.listKV(TABLE_AI_SPAN, { prefix: `${prefix}${TABLE_AI_SPAN}` });

      const allSpans: Record<string, any>[] = [];
      const rootSpans: Record<string, any>[] = [];

      // First pass: collect all spans and separate root from child spans
      for (const { name: key } of keyObjs) {
        try {
          const data = await this.operations.getKV(TABLE_AI_SPAN, key);
          if (!data) continue;

          if (data.parentSpanId === null || data.parentSpanId === undefined) {
            // This is a root span
            rootSpans.push(data);
          }

          allSpans.push(data);
        } catch (err) {
          this.logger.error('Failed to parse span:', { key, error: err });
        }
      }

      // Pre-compute date range filtering values using startTime (ms)
      const rangeStartTs = filters?.dateRange?.start
        ? filters.dateRange.start instanceof Date
          ? filters.dateRange.start.getTime()
          : new Date(filters.dateRange.start).getTime()
        : undefined;
      const rangeEndTs = filters?.dateRange?.end
        ? filters.dateRange.end instanceof Date
          ? filters.dateRange.end.getTime()
          : new Date(filters.dateRange.end).getTime()
        : undefined;

      // Apply filters to root spans only
      let filteredRootSpans = rootSpans.filter(span => {
        // Name filtering (exact match)
        if (filters?.name && span.name !== filters.name) {
          return false;
        }

        // Scope filtering (if provided)
        if (filters?.scope) {
          const spanScope = span.scope || {};
          for (const [key, value] of Object.entries(filters.scope)) {
            if (spanScope[key] !== value) {
              return false;
            }
          }
        }

        // Attributes filtering
        if (filters?.attributes) {
          const spanAttributes = span.attributes || {};
          for (const [key, value] of Object.entries(filters.attributes)) {
            if (spanAttributes[key] !== value) {
              return false;
            }
          }
        }

        // Error filtering
        if (filters?.error) {
          const spanError = span.error || {};
          for (const [key, value] of Object.entries(filters.error)) {
            if (spanError[key] !== value) {
              return false;
            }
          }
        }

        // SpanType filtering
        if (filters?.spanType !== undefined && span.spanType !== filters.spanType) {
          return false;
        }

        // Date range filtering using startTime
        if (rangeStartTs !== undefined && (typeof span.startTime !== 'number' || span.startTime < rangeStartTs)) {
          return false;
        }
        if (rangeEndTs !== undefined && (typeof span.startTime !== 'number' || span.startTime > rangeEndTs)) {
          return false;
        }

        return true;
      });

      // Sort root spans by startTime descending (newest first)
      filteredRootSpans.sort((a, b) => {
        const aTime = typeof a.startTime === 'number' ? a.startTime : 0;
        const bTime = typeof b.startTime === 'number' ? b.startTime : 0;
        return bTime - aTime;
      });

      // Apply pagination to root spans only
      const total = filteredRootSpans.length;
      const start = page * perPage;
      const end = start + perPage;
      const pagedRootSpans = filteredRootSpans.slice(start, end);

      // Return only root spans (no child spans)
      return {
        spans: pagedRootSpans,
        total, // Total count of root spans (not including children)
        page,
        perPage,
        hasMore: end < total,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_GET_AI_TRACES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to get AI traces paginated: ${error}`,
      );
    }
  }
}
