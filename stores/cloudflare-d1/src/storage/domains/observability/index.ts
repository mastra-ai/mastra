import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { ObservabilityStorage, TABLE_AI_SPAN } from '@mastra/core/storage';
import type { AITrace, PaginationInfo, StorageGetAiTracesPaginatedArg } from '@mastra/core/storage';
import { createSqlBuilder } from '../../sql-builder';
import type { StoreOperationsD1 } from '../operations';

export class ObservabilityStorageD1 extends ObservabilityStorage {
  private operations: StoreOperationsD1;

  constructor({ operations }: { operations: StoreOperationsD1 }) {
    super();
    this.operations = operations;
  }

  private serializeSpanForD1(span: Record<string, any>): Record<string, any> {
    const processedSpan = { ...span };

    // Ensure all Date objects are converted to strings for D1
    for (const [key, value] of Object.entries(processedSpan)) {
      if (value instanceof Date) {
        processedSpan[key] = value.toISOString();
      }
    }

    // Ensure all object fields are properly serialized to JSON strings
    for (const [key, value] of Object.entries(processedSpan)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        try {
          processedSpan[key] = JSON.stringify(value);
        } catch (error) {
          this.logger?.error(`Failed to serialize span for D1: ${error}`);
          // If JSON serialization fails, set to null
          processedSpan[key] = null;
        }
      }
    }

    return processedSpan;
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

      // Set timestamp if not provided
      if (!span.createdAt) {
        span.createdAt = new Date().toISOString();
      }

      const processedSpan = this.serializeSpanForD1(span);

      // Use batchInsert for consistency (single record)
      await this.operations.batchInsert({
        tableName: TABLE_AI_SPAN,
        records: [processedSpan],
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_CREATE_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to create AI span: ${error}`,
      );
    }
  }

  async getAISpan(id: string): Promise<Record<string, any> | null> {
    try {
      const fullTableName = this.operations.getTableName(TABLE_AI_SPAN);
      const query = createSqlBuilder().select('*').from(fullTableName).where('id = ?', id);
      const { sql, params } = query.build();

      const result = await this.operations.executeQuery({ sql, params, first: true });

      if (!result) {
        return null;
      }

      // Deserialize JSON fields
      const deserialized: Record<string, any> = { ...result };
      for (const [key, value] of Object.entries(result)) {
        if (value && typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            if (typeof parsed === 'object') {
              deserialized[key] = parsed;
            }
          } catch {
            // Keep as string if not valid JSON
          }
        }
      }

      return deserialized;
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_GET_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to get AI span: ${error}`,
      );
    }
  }

  async updateAISpan(id: string, updates: Record<string, any>): Promise<void> {
    try {
      // First, get the existing span to merge with updates
      const existingSpan = await this.getAISpan(id);

      if (!existingSpan) {
        throw new MastraError(
          {
            id: 'CLOUDFLARE_D1_STORAGE_UPDATE_AI_SPAN_NOT_FOUND',
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
      };

      // Serialize the updated span for D1
      const processedSpan = this.serializeSpanForD1(updatedSpan);

      // Build UPDATE query
      const fullTableName = this.operations.getTableName(TABLE_AI_SPAN);
      const setClauses: string[] = [];
      const values: any[] = [];

      for (const [key, value] of Object.entries(processedSpan)) {
        if (key !== 'id') {
          // Don't update the ID
          setClauses.push(`${key} = ?`);
          values.push(value);
        }
      }

      // Add the ID for the WHERE clause
      values.push(id);

      const sql = `UPDATE ${fullTableName} SET ${setClauses.join(', ')} WHERE id = ?`;

      await this.operations.executeQuery({ sql, params: values });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_UPDATE_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to update AI span: ${error}`,
      );
    }
  }

  async deleteAISpan(id: string): Promise<void> {
    try {
      // Check if the span exists before attempting to delete
      const existingSpan = await this.getAISpan(id);

      if (!existingSpan) {
        return;
      }

      // Build DELETE query
      const fullTableName = this.operations.getTableName(TABLE_AI_SPAN);
      const sql = `DELETE FROM ${fullTableName} WHERE id = ?`;

      await this.operations.executeQuery({ sql, params: [id] });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_DELETE_AI_SPAN_FAILED',
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

        // Set timestamp if not provided
        if (!span.createdAt) {
          span.createdAt = new Date().toISOString();
        }

        return span;
      });

      // Serialize all spans for D1
      const serializedRecords = processedRecords.map(span => this.serializeSpanForD1(span));

      // Use batchInsert for efficiency
      await this.operations.batchInsert({
        tableName: TABLE_AI_SPAN,
        records: serializedRecords,
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_BATCH_AI_SPAN_CREATE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to batch create AI spans: ${error}`,
      );
    }
  }

  async getAITrace(traceId: string): Promise<AITrace | null> {
    try {
      const fullTableName = this.operations.getTableName(TABLE_AI_SPAN);
      const query = createSqlBuilder().select('*').from(fullTableName).where('traceId = ?', traceId);
      const { sql, params } = query.build();

      const result = await this.operations.executeQuery({ sql, params });

      if (!result || result.length === 0) {
        return null;
      }

      return {
        traceId,
        spans: Array.isArray(result) ? result : [result],
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_GET_AI_TRACE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to get AI trace: ${error}`,
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
          // Get the existing span to merge with updates
          const existingSpan = await this.getAISpan(id);

          if (!existingSpan) {
            // Skip if span doesn't exist (silent failure for batch operations)
            return;
          }

          // Merge existing data with updates
          const updatedSpan = {
            ...existingSpan,
            ...updates,
          };

          // Serialize the updated span for D1
          const processedSpan = this.serializeSpanForD1(updatedSpan);

          // Build UPDATE query
          const fullTableName = this.operations.getTableName(TABLE_AI_SPAN);
          const setClauses: string[] = [];
          const values: any[] = [];

          for (const [key, value] of Object.entries(processedSpan)) {
            if (key !== 'id') {
              // Don't update the ID
              setClauses.push(`${key} = ?`);
              values.push(value);
            }
          }

          // Add the ID for the WHERE clause
          values.push(id);

          const sql = `UPDATE ${fullTableName} SET ${setClauses.join(', ')} WHERE id = ?`;

          await this.operations.executeQuery({ sql, params: values });
        }),
      );
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_BATCH_AI_SPAN_UPDATE_FAILED',
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
          // Check if the span exists before attempting to delete
          const existingSpan = await this.getAISpan(id);

          if (!existingSpan) {
            // Skip if span doesn't exist (silent failure for batch operations)
            return;
          }

          // Build DELETE query
          const fullTableName = this.operations.getTableName(TABLE_AI_SPAN);
          const sql = `DELETE FROM ${fullTableName} WHERE id = ?`;

          await this.operations.executeQuery({ sql, params: [id] });
        }),
      );
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_BATCH_AI_SPAN_DELETE_FAILED',
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
    const { filters, page = 0, perPage = 10 } = args;
    const currentOffset = page * perPage;

    try {
      const fullTableName = this.operations.getTableName(TABLE_AI_SPAN);

      // Build filter conditions
      const { conditions, params } = this.buildFilterConditions(filters);
      const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

      // Get total count of root spans (parentSpanId IS NULL)
      const countSql = `SELECT COUNT(*) as count FROM ${fullTableName} WHERE parentSpanId IS NULL ${whereClause}`;
      const countResult = await this.operations.executeQuery({
        sql: countSql,
        params: params,
      });
      const total = Array.isArray(countResult) ? Number(countResult[0]?.count || 0) : Number(countResult?.count || 0);

      // Get paginated parent spans only (no child spans)
      const parentSql = `
        SELECT * FROM ${fullTableName} 
        WHERE parentSpanId IS NULL ${whereClause}
        ORDER BY startTime DESC 
        LIMIT ? OFFSET ?
      `;
      const parentResult = await this.operations.executeQuery({
        sql: parentSql,
        params: [...params, perPage, currentOffset],
      });

      const parentSpans = Array.isArray(parentResult) ? parentResult : [];

      // Deserialize JSON fields for root spans only
      const deserializedSpans = parentSpans.map(span => this.deserializeSpanFromD1(span));

      return {
        spans: deserializedSpans,
        total,
        page,
        perPage,
        hasMore: total > currentOffset + perPage,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORAGE_GET_AI_TRACES_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to get AI traces paginated: ${error}`,
      );
    }
  }

  private buildFilterConditions(filters?: any): { conditions: string[]; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];

    if (!filters) {
      return { conditions, params };
    }

    // Name filtering (exact match)
    if (filters.name) {
      conditions.push('name = ?');
      params.push(filters.name);
    }

    // Scope filtering
    if (filters.scope) {
      for (const [key, value] of Object.entries(filters.scope)) {
        conditions.push(`json_extract(scope, '$.${key}') = ?`);
        params.push(value);
      }
    }

    // Attributes filtering
    if (filters.attributes) {
      for (const [key, value] of Object.entries(filters.attributes)) {
        conditions.push(`json_extract(attributes, '$.${key}') = ?`);
        params.push(value);
      }
    }

    // Error filtering
    if (filters.error) {
      for (const [key, value] of Object.entries(filters.error)) {
        conditions.push(`json_extract(error, '$.${key}') = ?`);
        params.push(value);
      }
    }

    // SpanType filtering
    if (filters.spanType !== undefined) {
      conditions.push('spanType = ?');
      params.push(filters.spanType);
    }

    // Date range filtering using startTime (milliseconds since epoch)
    if (filters.dateRange?.start) {
      const startTs =
        filters.dateRange.start instanceof Date
          ? filters.dateRange.start.getTime()
          : new Date(filters.dateRange.start).getTime();
      conditions.push('startTime >= ?');
      params.push(startTs);
    }

    if (filters.dateRange?.end) {
      const endTs =
        filters.dateRange.end instanceof Date
          ? filters.dateRange.end.getTime()
          : new Date(filters.dateRange.end).getTime();
      conditions.push('startTime <= ?');
      params.push(endTs);
    }

    return { conditions, params };
  }

  private deserializeSpanFromD1(span: Record<string, any>): Record<string, any> {
    const deserialized: Record<string, any> = { ...span };

    // Deserialize JSON fields
    const jsonFields = ['scope', 'attributes', 'metadata', 'events', 'links', 'input', 'output', 'error'];
    for (const field of jsonFields) {
      if (span[field] && typeof span[field] === 'string') {
        try {
          const parsed = JSON.parse(span[field]);
          if (typeof parsed === 'object') {
            deserialized[field] = parsed;
          }
        } catch {
          // Keep as string if not valid JSON
        }
      }
    }

    return deserialized;
  }
}
