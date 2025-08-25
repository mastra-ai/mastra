import type { ClickHouseClient } from '@clickhouse/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { StorageGetAiTracesPaginatedArg, PaginationInfo, AITrace, AISpanRecord } from '@mastra/core/storage';
import { ObservabilityStorage, TABLE_AI_SPAN, safelyParseJSON } from '@mastra/core/storage';
import type { StoreOperationsClickhouse } from '../operations';

export class ObservabilityClickhouse extends ObservabilityStorage {
  protected client: ClickHouseClient;
  protected operations: StoreOperationsClickhouse;

  constructor({ client, operations }: { client: ClickHouseClient; operations: StoreOperationsClickhouse }) {
    super();
    this.client = client;
    this.operations = operations;
  }

  async createAISpan(span: Omit<AISpanRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      const id = `${span.traceId}-${span.spanId}`;

      // Prepare the record with timestamps
      const record = {
        ...span,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.operations.insert({
        tableName: TABLE_AI_SPAN,
        record,
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_CREATE_AI_SPAN_FAILED',
          text: 'Failed to create AI span in ClickHouseStorage',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { error: error?.message },
        },
        error,
      );
    }
  }

  async getAISpan(id: string): Promise<AISpanRecord | null> {
    try {
      const result = await this.client.query({
        query: `SELECT * FROM ${TABLE_AI_SPAN} WHERE id = {var_id:String}`,
        query_params: { var_id: id },
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      if (!result) {
        return null;
      }

      const rows = await result.json();

      if (!rows.data || rows.data.length === 0) {
        return null;
      }

      const row = rows.data[0] as any;

      // Parse JSON fields back to objects
      return this.parseJsonFields(row);
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_GET_AI_SPAN_FAILED',
          text: 'Failed to get AI span in ClickHouseStorage',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { error: error?.message, id },
        },
        error,
      );
    }
  }

  private parseJsonFields(row: any): AISpanRecord {
    return {
      ...row,
      parentSpanId: row.parentSpanId === '' ? null : row.parentSpanId,
      scope: safelyParseJSON(row.scope),
      attributes: safelyParseJSON(row.attributes),
      metadata: safelyParseJSON(row.metadata),
      events: safelyParseJSON(row.events),
      links: safelyParseJSON(row.links),
      input: safelyParseJSON(row.input),
      output: safelyParseJSON(row.output),
      error: safelyParseJSON(row.error),
    } as AISpanRecord;
  }

  async updateAISpan(id: string, updates: Partial<AISpanRecord>): Promise<void> {
    try {
      // First check if the span exists
      const existingSpan = await this.getAISpan(id);
      if (!existingSpan) {
        throw new MastraError(
          {
            id: 'CLICKHOUSE_STORAGE_UPDATE_AI_SPAN_NOT_FOUND',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            text: `AI span not found for update: ${id}`,
          },
          `AI span not found for update: ${id}`,
        );
      }

      // Prepare the update record with updatedAt timestamp
      const updateRecord = {
        ...updates,
        updatedAt: new Date(),
      };

      // Build SET clauses for the UPDATE statement
      const setClauses: string[] = [];
      const values: Record<string, any> = { var_id: id };

      Object.entries(updateRecord).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'createdAt') {
          // Don't update id or createdAt
          const paramName = `var_${key}`;
          if (key === 'updatedAt') {
            setClauses.push(`"${key}" = parseDateTime64BestEffort({${paramName}:String})`);
            values[paramName] = value instanceof Date ? value.toISOString() : value?.toString();
          } else if (typeof value === 'object' && value !== null) {
            // Handle object fields by stringifying them
            setClauses.push(`"${key}" = {${paramName}:String}`);
            values[paramName] = JSON.stringify(value);
          } else {
            setClauses.push(`"${key}" = {${paramName}:String}`);
            values[paramName] = value;
          }
        }
      });

      if (setClauses.length === 0) {
        return; // No updates to make
      }

      // Use ALTER TABLE UPDATE for ClickHouse
      const updateQuery = `
        ALTER TABLE ${TABLE_AI_SPAN}
        UPDATE ${setClauses.join(', ')}
        WHERE id = {var_id:String}
      `;

      await this.client.command({
        query: updateQuery,
        query_params: values,
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      // Optimize table to apply changes immediately
      await this.client.command({
        query: `OPTIMIZE TABLE ${TABLE_AI_SPAN} FINAL`,
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_UPDATE_AI_SPAN_FAILED',
          text: 'Failed to update AI span in ClickHouseStorage',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { error: error?.message, id },
        },
        error,
      );
    }
  }

  async deleteAISpan(id: string): Promise<void> {
    try {
      // First check if the span exists
      const existingSpan = await this.getAISpan(id);
      if (!existingSpan) {
        return; // No error if span doesn't exist, just return
      }

      // Delete the span using ClickHouse DELETE FROM
      await this.client.command({
        query: `DELETE FROM ${TABLE_AI_SPAN} WHERE id = {var_id:String}`,
        query_params: { var_id: id },
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      // Optimize table to apply changes immediately
      await this.client.command({
        query: `OPTIMIZE TABLE ${TABLE_AI_SPAN} FINAL`,
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_DELETE_AI_SPAN_FAILED',
          text: 'Failed to delete AI span in ClickHouseStorage',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { error: error?.message, id },
        },
        error,
      );
    }
  }

  async batchCreateAISpan(args: { records: Omit<AISpanRecord, 'id' | 'createdAt' | 'updatedAt'>[] }): Promise<void> {
    if (args.records.length === 0) {
      return; // No records to insert
    }

    try {
      // Prepare records with IDs and timestamps
      const recordsWithIds = args.records.map(record => ({
        ...record,
        id: `${record.traceId}-${record.spanId}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await this.operations.batchInsert({
        tableName: TABLE_AI_SPAN,
        records: recordsWithIds,
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_BATCH_AI_SPAN_CREATE_FAILED',
          text: 'Failed to batch create AI spans in ClickHouseStorage',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { error: error?.message, recordCount: args.records.length },
        },
        error,
      );
    }
  }

  async batchUpdateAISpan(args: { records: { id: string; updates: Partial<AISpanRecord> }[] }): Promise<void> {
    if (args.records.length === 0) {
      return; // No updates to make
    }

    try {
      // Process each update record
      const updatePromises: Promise<any>[] = [];

      for (const { id, updates } of args.records) {
        // First, get the existing span to merge with updates
        const existingSpan = await this.getAISpan(id);
        if (!existingSpan) {
          continue; // Skip if span doesn't exist
        }

        // Prepare the updated record by merging existing data with updates
        const updateRecord = {
          ...existingSpan,
          ...updates,
          updatedAt: new Date(),
        };

        // Build SET clauses for the UPDATE statement
        const setClauses: string[] = [];
        const values: Record<string, any> = { var_id: id };

        Object.entries(updateRecord).forEach(([key, value]) => {
          if (key !== 'id' && key !== 'createdAt') {
            // Don't update id or createdAt
            // Sanitize the key to create a valid parameter name
            const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '_');
            const paramName = `var_${sanitizedKey}`;
            if (key === 'updatedAt') {
              setClauses.push(`"${key}" = parseDateTime64BestEffort({${paramName}:String})`);
              values[paramName] = value instanceof Date ? value.toISOString() : value?.toString();
            } else if (typeof value === 'object' && value !== null) {
              // Handle object fields by stringifying them
              setClauses.push(`"${key}" = {${paramName}:String}`);
              values[paramName] = JSON.stringify(value);
            } else {
              setClauses.push(`"${key}" = {${paramName}:String}`);
              values[paramName] = value;
            }
          }
        });

        if (setClauses.length === 0) {
          continue; // Skip records with no updates
        }

        // Use ALTER TABLE UPDATE for ClickHouse
        const updateQuery = `
          ALTER TABLE ${TABLE_AI_SPAN}
          UPDATE ${setClauses.join(', ')}
          WHERE id = {var_id:String}
        `;

        updatePromises.push(
          this.client.command({
            query: updateQuery,
            query_params: values,
            clickhouse_settings: {
              date_time_input_format: 'best_effort',
              use_client_time_zone: 1,
              output_format_json_quote_64bit_integers: 0,
            },
          }),
        );
      }

      // Execute all updates
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }

      // Optimize table to apply changes immediately
      await this.client.command({
        query: `OPTIMIZE TABLE ${TABLE_AI_SPAN} FINAL`,
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_BATCH_AI_SPAN_UPDATE_FAILED',
          text: 'Failed to batch update AI spans in ClickHouseStorage',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { error: error?.message, recordCount: args.records.length },
        },
        error,
      );
    }
  }

  async batchDeleteAISpan(args: { ids: string[] }): Promise<void> {
    if (args.ids.length === 0) {
      return; // No IDs to delete
    }

    try {
      const deletePromises: Promise<any>[] = [];

      for (const id of args.ids) {
        deletePromises.push(
          this.client.command({
            query: `DELETE FROM ${TABLE_AI_SPAN} WHERE id = {var_id:String}`,
            query_params: { var_id: id },
            clickhouse_settings: {
              date_time_input_format: 'best_effort',
              use_client_time_zone: 1,
              output_format_json_quote_64bit_integers: 0,
            },
          }),
        );
      }

      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
      }

      await this.client.command({
        query: `OPTIMIZE TABLE ${TABLE_AI_SPAN} FINAL`,
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_BATCH_AI_SPAN_DELETE_FAILED',
          text: 'Failed to batch delete AI spans in ClickHouseStorage',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { error: error?.message, idCount: args.ids.length },
        },
        error,
      );
    }
  }

  async getAITrace(traceId: string): Promise<AITrace | null> {
    try {
      const result = await this.client.query({
        query: `SELECT * FROM ${TABLE_AI_SPAN} WHERE traceId = {var_traceId:String}`,
        query_params: { var_traceId: traceId },
      });

      const spanData = await result.json();

      if (!spanData.data || spanData.data.length === 0) {
        return null;
      }

      const spans = spanData.data.map(this.parseJsonFields);

      return {
        traceId,
        spans,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_GET_AI_TRACE_FAILED',
          text: 'Failed to get AI trace in ClickHouseStorage',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { error: error?.message, traceId },
        },
        error,
      );
    }
  }

  async getAITracesPaginated(
    args: StorageGetAiTracesPaginatedArg,
  ): Promise<PaginationInfo & { spans: Record<string, any>[] }> {
    try {
      const { filters, page = 0, perPage = 10 } = args;
      const offset = page * perPage;

      // Build filter conditions for root spans
      const conditions: string[] = ["(parentSpanId IS NULL OR parentSpanId = '')"];
      const queryArgs: Record<string, any> = {};

      if (filters?.name) {
        conditions.push(`name = {var_name:String}`);
        queryArgs.var_name = filters.name;
      }

      if (filters?.spanType !== undefined) {
        conditions.push(`spanType = {var_spanType:Int32}`);
        queryArgs.var_spanType = filters.spanType;
      }

      // Date range filtering based on startTime (milliseconds since epoch)
      if (filters?.dateRange?.start) {
        const startTs =
          filters.dateRange.start instanceof Date
            ? filters.dateRange.start.getTime()
            : new Date(filters.dateRange.start as any).getTime();
        conditions.push(`startTime >= {var_from_time:Int64}`);
        queryArgs.var_from_time = startTs;
      }

      if (filters?.dateRange?.end) {
        const endTs =
          filters.dateRange.end instanceof Date
            ? filters.dateRange.end.getTime()
            : new Date(filters.dateRange.end as any).getTime();
        conditions.push(`startTime <= {var_to_time:Int64}`);
        queryArgs.var_to_time = endTs;
      }

      // Handle attributes filtering (JSON field)
      if (filters?.attributes && typeof filters.attributes === 'object') {
        Object.entries(filters.attributes).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            conditions.push(`JSONExtractString(attributes, '${key}') = {var_attr_${key}:String}`);
            queryArgs[`var_attr_${key}`] = value;
          }
        });
      }

      // Build where clause
      const whereClause = conditions.join(' AND ');

      // First, get total count of root spans
      let total = 0;
      if (conditions.length > 1) {
        // More than just 'parentSpanId IS NULL'
        const countResult = await this.client.query({
          query: `SELECT COUNT(*) as count FROM ${TABLE_AI_SPAN} WHERE ${whereClause}`,
          query_params: queryArgs,
          clickhouse_settings: {
            date_time_input_format: 'best_effort',
            date_time_output_format: 'iso',
            use_client_time_zone: 1,
            output_format_json_quote_64bit_integers: 0,
          },
        });
        const countData = await countResult.json();

        total = Number((countData.data?.[0] as any)?.count ?? 0);
      } else {
        // Just count root spans without additional filters
        const countResult = await this.client.query({
          query: `SELECT COUNT(*) as count FROM ${TABLE_AI_SPAN} WHERE (parentSpanId IS NULL OR parentSpanId = '')`,
          clickhouse_settings: {
            date_time_input_format: 'best_effort',
            date_time_output_format: 'iso',
            use_client_time_zone: 1,
            output_format_json_quote_64bit_integers: 0,
          },
        });
        const countData = await countResult.json();
        total = Number((countData.data?.[0] as any)?.count ?? 0);
      }

      const rootSpansResult = await this.client.query({
        query: `SELECT *, toDateTime64(createdAt, 3) as createdAt, toDateTime64(updatedAt, 3) as updatedAt FROM ${TABLE_AI_SPAN} WHERE ${whereClause} ORDER BY startTime DESC LIMIT {var_limit:UInt32} OFFSET {var_offset:UInt32}`,
        query_params: { ...queryArgs, var_limit: perPage, var_offset: offset },
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      const rootSpansData = await rootSpansResult.json();
      const rootSpans = rootSpansData.data || [];

      // Process root spans with proper JSON field parsing
      const processedSpans = rootSpans.map(this.parseJsonFields);

      return {
        spans: processedSpans as Record<string, any>[],
        total,
        page,
        perPage,
        hasMore: total > (page + 1) * perPage,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'CLICKHOUSE_STORAGE_GET_AI_TRACES_PAGINATED_FAILED',
          text: 'Failed to get AI traces paginated in ClickHouseStorage',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { error: error?.message },
        },
        error,
      );
    }
  }
}
