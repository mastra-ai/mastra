import type { Connection } from '@lancedb/lancedb';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { ObservabilityStorage, TABLE_AI_SPAN } from '@mastra/core/storage';
import type { AITrace, PaginationInfo, StorageGetAiTracesPaginatedArg, AISpanRecord } from '@mastra/core/storage';
import type { StoreOperationsLance } from '../operations';
import { getTableSchema, processResultWithTypeConversion } from '../utils';

export class ObservabilityLance extends ObservabilityStorage {
  private operations: StoreOperationsLance;
  private lanceClient: Connection;
  constructor({ operations, lanceClient }: { operations: StoreOperationsLance; lanceClient: Connection }) {
    super();
    this.operations = operations;
    this.lanceClient = lanceClient;
  }

  /**
   * Converts object fields to JSON strings for storage
   * @param record The record containing fields that may need JSON stringification
   * @returns A new record with JSON fields converted to strings
   */
  private _stringifyJsonFields(record: Record<string, any>): Record<string, any> {
    const processedRecord = { ...record };

    // Convert object fields to JSON strings for storage
    if (processedRecord.scope !== undefined) {
      processedRecord.scope = processedRecord.scope ? JSON.stringify(processedRecord.scope) : null;
    }
    if (processedRecord.attributes !== undefined) {
      processedRecord.attributes = processedRecord.attributes ? JSON.stringify(processedRecord.attributes) : null;
    }
    if (processedRecord.metadata !== undefined) {
      processedRecord.metadata = processedRecord.metadata ? JSON.stringify(processedRecord.metadata) : null;
    }
    if (processedRecord.events !== undefined) {
      processedRecord.events = processedRecord.events ? JSON.stringify(processedRecord.events) : null;
    }
    if (processedRecord.links !== undefined) {
      processedRecord.links = processedRecord.links ? JSON.stringify(processedRecord.links) : null;
    }
    if (processedRecord.input !== undefined) {
      processedRecord.input = processedRecord.input ? JSON.stringify(processedRecord.input) : null;
    }
    if (processedRecord.output !== undefined) {
      processedRecord.output = processedRecord.output ? JSON.stringify(processedRecord.output) : null;
    }
    if (processedRecord.error !== undefined) {
      processedRecord.error = processedRecord.error ? JSON.stringify(processedRecord.error) : null;
    }

    return processedRecord;
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

      // Convert object fields to JSON strings for storage
      const processedRecord = this._stringifyJsonFields(record);

      await this.operations.insert({
        tableName: TABLE_AI_SPAN,
        record: processedRecord,
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORAGE_CREATE_AI_SPAN_FAILED',
          text: 'Failed to create AI span in LanceStorage',
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
      const table = await this.lanceClient.openTable(TABLE_AI_SPAN);
      const query = table.query().where(`id = '${id}'`).limit(1);
      const records = await query.toArray();

      if (records.length === 0) return null;

      const schema = await getTableSchema({ tableName: TABLE_AI_SPAN, client: this.lanceClient });
      return processResultWithTypeConversion(records[0], schema) as AISpanRecord;
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORAGE_GET_AI_SPAN_FAILED',
          text: 'Failed to get AI span in LanceStorage',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { error: error?.message },
        },
        error,
      );
    }
  }

  async updateAISpan(id: string, updates: Record<string, any>): Promise<void> {
    try {
      // First check if the span exists
      const existingSpan = await this.getAISpan(id);
      if (!existingSpan) {
        throw new MastraError(
          {
            id: 'LANCE_STORAGE_UPDATE_AI_SPAN_NOT_FOUND',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            text: `AI span not found for update: ${id}`,
          },
          `AI span not found for update: ${id}`,
        );
      }

      // Prepare the update record
      const updateRecord: Record<string, any> = {
        id,
        ...updates,
        updatedAt: new Date(),
      };

      // Convert object fields to JSON strings for storage
      const processedUpdateRecord = this._stringifyJsonFields(updateRecord);

      // Use mergeInsert to update the existing record
      const table = await this.lanceClient.openTable(TABLE_AI_SPAN);
      await table.mergeInsert(['id']).whenMatchedUpdateAll().whenNotMatchedInsertAll().execute([processedUpdateRecord]);
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORAGE_UPDATE_AI_SPAN_FAILED',
          text: 'Failed to update AI span in LanceStorage',
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
        return;
      }

      // Delete the span using the id predicate
      const table = await this.lanceClient.openTable(TABLE_AI_SPAN);
      await table.delete(`id = '${id}'`);
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORAGE_DELETE_AI_SPAN_FAILED',
          text: 'Failed to delete AI span in LanceStorage',
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

      // Convert object fields to JSON strings for storage
      const processedRecords = recordsWithIds.map(record => this._stringifyJsonFields(record));

      await this.operations.batchInsert({
        tableName: TABLE_AI_SPAN,
        records: processedRecords,
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORAGE_BATCH_AI_SPAN_CREATE_FAILED',
          text: 'Failed to batch create AI spans in LanceStorage',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { error: error?.message, recordCount: args.records.length },
        },
        error,
      );
    }
  }

  async batchUpdateAISpan(args: { records: { id: string; updates: Record<string, any> }[] }): Promise<void> {
    if (args.records.length === 0) {
      return; // No updates to make
    }

    try {
      // Process each update record
      const updateRecords = args.records.map(({ id, updates }) => {
        const updateRecord: Record<string, any> = {
          id,
          ...updates,
          updatedAt: new Date(),
        };

        // Convert object fields to JSON strings for storage
        return this._stringifyJsonFields(updateRecord);
      });

      // Use mergeInsert to update existing records
      const table = await this.lanceClient.openTable(TABLE_AI_SPAN);
      await table.mergeInsert(['id']).whenMatchedUpdateAll().whenNotMatchedInsertAll().execute(updateRecords);
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORAGE_BATCH_AI_SPAN_UPDATE_FAILED',
          text: 'Failed to batch update AI spans in LanceStorage',
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
      const table = await this.lanceClient.openTable(TABLE_AI_SPAN);

      // Delete each span individually since LanceDB doesn't support IN clause for delete
      for (const id of args.ids) {
        await table.delete(`id = '${id}'`);
      }
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORAGE_BATCH_AI_SPAN_DELETE_FAILED',
          text: 'Failed to batch delete AI spans in LanceStorage',
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
      const table = await this.lanceClient.openTable(TABLE_AI_SPAN);
      const query = table.query().where(`\`traceId\` = '${traceId}'`);
      const records = await query.toArray();

      if (records.length === 0) {
        return null;
      }

      const schema = await getTableSchema({ tableName: TABLE_AI_SPAN, client: this.lanceClient });

      return {
        traceId,
        spans: records.map(record => processResultWithTypeConversion(record, schema)) as AISpanRecord[],
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORAGE_GET_AI_TRACE_FAILED',
          text: 'Failed to get AI trace in LanceStorage',
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

      const table = await this.lanceClient.openTable(TABLE_AI_SPAN);

      // Build filter conditions for root spans
      const conditions: string[] = ['`parentSpanId` IS NULL'];

      if (filters?.name) {
        conditions.push(`\`name\` = '${filters.name}'`);
      }

      if (filters?.spanType !== undefined) {
        conditions.push(`\`spanType\` = ${filters.spanType}`);
      }

      if (filters?.dateRange?.start) {
        const startTs =
          filters.dateRange.start instanceof Date
            ? filters.dateRange.start.getTime()
            : new Date(filters.dateRange.start).getTime();
        conditions.push(`\`startTime\` >= ${startTs}`);
      }

      if (filters?.dateRange?.end) {
        const endTs =
          filters.dateRange.end instanceof Date
            ? filters.dateRange.end.getTime()
            : new Date(filters.dateRange.end).getTime();
        conditions.push(`\`startTime\` <= ${endTs}`);
      }

      // Handle attributes filtering (JSON field)
      if (filters?.attributes && typeof filters.attributes === 'object') {
        Object.entries(filters.attributes).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            // Use LIKE query on the JSON string field with proper escaping
            const jsonPattern = `"${key}":"${value}"`;
            conditions.push(`\`attributes\` LIKE '%${jsonPattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}%'`);
          }
        });
      }

      // Build where clause
      const whereClause = conditions.join(' AND ');

      // First, get total count of root spans
      let total = 0;
      if (conditions.length > 1) {
        // More than just 'parentSpanId IS NULL'
        const countQuery = table.query().where(whereClause);
        const allRootSpans = await countQuery.toArray();
        total = allRootSpans.length;
      } else {
        // Just count root spans without additional filters
        const countQuery = table.query().where('`parentSpanId` IS NULL');
        const allRootSpans = await countQuery.toArray();
        total = allRootSpans.length;
      }

      // Fetch root spans with pagination
      let rootSpansQuery = table.query().where(whereClause);
      rootSpansQuery = rootSpansQuery.limit(perPage);
      if (offset > 0) {
        rootSpansQuery = rootSpansQuery.offset(offset);
      }

      const rootSpans = await rootSpansQuery.toArray();

      // Sort root spans by startTime descending (newest first)
      rootSpans.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));

      if (rootSpans.length === 0) {
        return {
          spans: [],
          total,
          page,
          perPage,
          hasMore: total > (page + 1) * perPage,
        };
      }

      // Process root spans with proper type conversion (no child spans)
      const schema = await getTableSchema({ tableName: TABLE_AI_SPAN, client: this.lanceClient });
      const processedSpans = rootSpans.map(span => processResultWithTypeConversion(span, schema)) as Record<
        string,
        any
      >[];

      return {
        spans: processedSpans,
        total,
        page,
        perPage,
        hasMore: total > (page + 1) * perPage,
      };
    } catch (error: any) {
      throw new MastraError(
        {
          id: 'LANCE_STORAGE_GET_AI_TRACES_PAGINATED_FAILED',
          text: 'Failed to get AI traces paginated in LanceStorage',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { error: error?.message },
        },
        error,
      );
    }
  }
}
