import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { ObservabilityStorage, TABLE_AI_SPAN, safelyParseJSON } from '@mastra/core/storage';
import type { StorageGetAiTracesPaginatedArg, PaginationInfo, AITrace, AISpanRecord } from '@mastra/core/storage';
import type { IDatabase } from 'pg-promise';
import type { StoreOperationsPG } from '../operations';
import { getSchemaName, getTableName } from '../utils';

export class ObservabilityPG extends ObservabilityStorage {
  private client: IDatabase<{}>;
  private operations: StoreOperationsPG;
  private schema?: string;

  constructor({ client, operations, schema }: { client: any; operations: StoreOperationsPG; schema?: string }) {
    super();
    this.client = client;
    this.operations = operations;
    this.schema = schema;
  }

  async createAISpan(span: Omit<AISpanRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      const id = `${span.traceId}-${span.spanId}`;
      await this.operations.insert({
        tableName: TABLE_AI_SPAN,
        record: { ...span, id },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'PG_STORAGE_CREATE_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to create AI span: ${error}`,
      );
    }
  }

  async getAISpan(id: string): Promise<Record<string, any> | null> {
    try {
      const result = await this.client.oneOrNone<Record<string, any>>(
        `SELECT * FROM ${getTableName({ indexName: TABLE_AI_SPAN, schemaName: getSchemaName(this.schema) })} WHERE id = $1`,
        [id],
      );

      if (!result) {
        return null;
      }

      return this.transformRowToAISpan(result);
    } catch (error) {
      throw new MastraError(
        {
          id: 'PG_STORAGE_GET_AI_SPAN_FAILED',
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
            id: 'PG_STORAGE_UPDATE_AI_SPAN_NOT_FOUND',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
          },
          `AI span not found for update: ${id}`,
        );
      }

      // Build update query dynamically
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          updateFields.push(`"${key}" = $${paramIndex++}`);
          updateValues.push(value);
        }
      });

      if (updateFields.length === 0) {
        return; // No updates to make
      }

      updateValues.push(id); // Add id for WHERE clause
      const updateSql = `
        UPDATE ${getTableName({ indexName: TABLE_AI_SPAN, schemaName: getSchemaName(this.schema) })}
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
      `;

      await this.client.none(updateSql, updateValues);
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: 'PG_STORAGE_UPDATE_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to update AI span: ${error}`,
      );
    }
  }

  async deleteAISpan(id: string): Promise<void> {
    try {
      await this.client.none(
        `DELETE FROM ${getTableName({ indexName: TABLE_AI_SPAN, schemaName: getSchemaName(this.schema) })} WHERE id = $1`,
        [id],
      );
    } catch (error) {
      throw new MastraError(
        {
          id: 'PG_STORAGE_DELETE_AI_SPAN_FAILED',
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
   * - name: string (LIKE search with % suffix)
   * - attributes: object (JSON field filtering)
   * - error: object (JSON field filtering)
   * - dateRange: object with start/end dates for startTime filtering
   * - traceId: string (exact match)
   * - spanType: number (exact match)
   */
  private buildFilterConditions(filters?: any): { conditions: string[]; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (!filters) {
      return { conditions, params };
    }

    // Name filtering
    if (filters.name) {
      conditions.push(`name = $${paramIndex++}`);
      params.push(filters.name);
    }

    // Attributes filtering (JSON field)
    if (filters.attributes && typeof filters.attributes === 'object') {
      Object.entries(filters.attributes).forEach(([key, value]) => {
        if (value === null) {
          conditions.push(`(attributes->>'${key}' IS NULL OR NOT (attributes ? '${key}'))`);
        } else {
          // Handle nested JSON paths like 'service.name'
          if (key.includes('.')) {
            const jsonPath = key
              .split('.')
              .map(k => `'${k}'`)
              .join('->');
            conditions.push(`attributes->${jsonPath} = $${paramIndex++}`);
          } else {
            conditions.push(`attributes->>'${key}' = $${paramIndex++}`);
          }
          params.push(String(value)); // Convert to string for JSON comparison
        }
      });
    }

    // Error filtering (JSON field)
    if (filters.error && typeof filters.error === 'object') {
      Object.entries(filters.error).forEach(([key, value]) => {
        if (value === null) {
          conditions.push(`(error->>'${key}' IS NULL OR NOT (error ? '${key}'))`);
        } else {
          // Handle nested JSON paths like 'service.name'
          if (key.includes('.')) {
            const jsonPath = key
              .split('.')
              .map(k => `'${k}'`)
              .join('->');
            conditions.push(`error->${jsonPath} = $${paramIndex++}`);
          } else {
            conditions.push(`error->>'${key}' = $${paramIndex++}`);
          }
          params.push(String(value)); // Convert to string for JSON comparison
        }
      });
    }

    // Date range filtering using startTime (milliseconds since epoch)
    if (filters.dateRange?.start) {
      const startTs =
        filters.dateRange.start instanceof Date
          ? filters.dateRange.start.getTime()
          : new Date(filters.dateRange.start).getTime();
      conditions.push(`"startTime" >= $${paramIndex++}`);
      params.push(startTs);
    }

    if (filters.dateRange?.end) {
      const endTs =
        filters.dateRange.end instanceof Date
          ? filters.dateRange.end.getTime()
          : new Date(filters.dateRange.end).getTime();
      conditions.push(`"startTime" <= $${paramIndex++}`);
      params.push(endTs);
    }

    // SpanType filtering
    if (filters.spanType !== undefined) {
      conditions.push(`"spanType" = $${paramIndex++}`);
      params.push(filters.spanType);
    }

    return { conditions, params };
  }

  async getAITrace(traceId: string): Promise<AITrace | null> {
    try {
      const result = await this.client.manyOrNone<Record<string, any>>(
        `SELECT * FROM ${getTableName({ indexName: TABLE_AI_SPAN, schemaName: getSchemaName(this.schema) })} WHERE "traceId" = $1`,
        [traceId],
      );

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
          id: 'PG_STORAGE_GET_AI_TRACE_FAILED',
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
      const currentOffset = page * perPage;

      // Build filter conditions
      const { conditions, params } = this.buildFilterConditions(filters);
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count total matching parent spans
      const countSql = `
        SELECT COUNT(*) as count 
        FROM ${getTableName({ indexName: TABLE_AI_SPAN, schemaName: getSchemaName(this.schema) })}
        WHERE "parentSpanId" IS NULL${whereClause ? ` AND ${conditions.join(' AND ')}` : ''}
      `;

      const countResult = await this.client.oneOrNone<{ count: string }>(countSql, params);
      const total = Number(countResult?.count ?? 0);

      if (total === 0) {
        return {
          spans: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      // Get paginated parent spans only (no child spans)
      const parentSql = `
        SELECT * FROM ${getTableName({ indexName: TABLE_AI_SPAN, schemaName: getSchemaName(this.schema) })}
        WHERE "parentSpanId" IS NULL${whereClause ? ` AND ${conditions.join(' AND ')}` : ''}
        ORDER BY "startTime" DESC 
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const parentResult = await this.client.manyOrNone<Record<string, any>>(parentSql, [
        ...params,
        perPage,
        currentOffset,
      ]);

      const parentSpans = parentResult.map((row: Record<string, any>) => this.transformRowToAISpan(row));

      // Return only root spans (no child spans)
      return {
        spans: parentSpans,
        total,
        page,
        perPage,
        hasMore: total > currentOffset + perPage,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'PG_STORAGE_GET_AI_SPANS_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to get AI spans paginated: ${error}`,
      );
    }
  }

  private transformRowToAISpan(row: Record<string, any>): Record<string, any> {
    const { scope, attributes, metadata, events, links, input, output, error, ...rest } = row;

    return {
      ...rest,
      scope: safelyParseJSON(scope),
      attributes: safelyParseJSON(attributes),
      metadata: safelyParseJSON(metadata),
      events: safelyParseJSON(events),
      links: safelyParseJSON(links),
      input: safelyParseJSON(input),
      output: safelyParseJSON(output),
      error: safelyParseJSON(error),
    } as AISpanRecord;
  }

  async batchCreateAISpan(args: { records: Omit<AISpanRecord, 'id' | 'createdAt' | 'updatedAt'>[] }): Promise<void> {
    if (args.records.length === 0) {
      return; // No records to insert
    }

    try {
      const recordsWithIds = args.records.map(record => ({
        ...record,
        id: `${record.traceId}-${record.spanId}`,
      }));

      await this.operations.batchInsert({
        tableName: TABLE_AI_SPAN,
        records: recordsWithIds,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'PG_STORAGE_BATCH_AI_SPAN_CREATE_FAILED',
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
          id: 'PG_STORAGE_BATCH_AI_SPAN_UPDATE_FAILED',
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
      const placeholders = args.ids.map((_, i) => `$${i + 1}`).join(',');
      await this.client.none(
        `DELETE FROM ${getTableName({ indexName: TABLE_AI_SPAN, schemaName: getSchemaName(this.schema) })} WHERE id IN (${placeholders})`,
        args.ids,
      );
    } catch (error) {
      throw new MastraError(
        {
          id: 'PG_STORAGE_BATCH_AI_SPAN_DELETE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to batch delete AI spans: ${error}`,
      );
    }
  }
}
