import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { ObservabilityStorage, TABLE_AI_SPAN, safelyParseJSON } from '@mastra/core/storage';
import type { StorageGetAiTracesPaginatedArg, PaginationInfo, AITrace, AISpanRecord } from '@mastra/core/storage';
import type { Service } from 'electrodb';
import { aiSpanEntity } from '../../../entities/ai-span';
import type { StoreOperationsDynamoDB } from '../operations';

export class ObservabilityDynamoDB extends ObservabilityStorage {
  private service: Service<Record<string, any>>;
  private operations: StoreOperationsDynamoDB;
  constructor({ service, operations }: { service: Service<Record<string, any>>; operations: StoreOperationsDynamoDB }) {
    super();
    this.service = service;
    this.operations = operations;
  }

  async createAISpan(span: Omit<AISpanRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      const id = `${span.traceId}-${span.spanId}`;
      const record = this.preprocessAiSpanRecord({
        entity: 'ai-span',
        id,
        traceId: span.traceId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId || 'ROOT', // Convert null to 'ROOT'
        name: span.name,
        scope: span.scope,
        spanType: span.spanType,
        attributes: span.attributes,
        metadata: span.metadata,
        events: span.events,
        links: span.links,
        input: span.input,
        output: span.output,
        error: span.error,
        startTime: span.startTime,
        endTime: span.endTime,
        createdAt: new Date().toISOString(),
      });

      await this.service.entities.ai_span.create(record).go();
    } catch (error) {
      throw new MastraError(
        {
          id: 'DYNAMODB_STORAGE_CREATE_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to create AI span: ${error}`,
      );
    }
  }

  async getAISpan(id: string): Promise<Record<string, any> | null> {
    try {
      const result = await this.service.entities.ai_span.query.primary({ entity: 'ai-span', id }).go();

      if (result.data.length === 0) {
        return null;
      }

      return this.transformRowToAISpan(result.data[0]);
    } catch (error) {
      throw new MastraError(
        {
          id: 'DYNAMODB_STORAGE_GET_AI_SPAN_FAILED',
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
            id: 'DYNAMODB_STORAGE_UPDATE_AI_SPAN_NOT_FOUND',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
          },
          `AI span not found for update: ${id}`,
        );
      }

      // Remove undefined values and prepare update
      const cleanUpdates = Object.fromEntries(Object.entries(updates).filter(([_, value]) => value !== undefined));

      if (Object.keys(cleanUpdates).length === 0) {
        return; // No updates to make
      }

      // Preprocess the updates to ensure proper DynamoDB format
      const processedUpdates = this.preprocessAiSpanRecord(cleanUpdates);

      // Add updatedAt timestamp
      processedUpdates.updatedAt = new Date().toISOString();

      await this.service.entities.ai_span.update({ entity: 'ai-span', id }).set(processedUpdates).go();
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: 'DYNAMODB_STORAGE_UPDATE_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to update AI span: ${error}`,
      );
    }
  }

  async deleteAISpan(id: string): Promise<void> {
    try {
      await aiSpanEntity.delete({ entity: 'ai-span', id }).go();
    } catch (error) {
      throw new MastraError(
        {
          id: 'DYNAMODB_STORAGE_DELETE_AI_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to delete AI span: ${error}`,
      );
    }
  }

  /**
   * Preprocesses AI span records to ensure they are in valid DynamoDB format.
   * This method handles JSON stringification and date conversion to prevent
   * ElectroDB validation errors.
   */
  private preprocessAiSpanRecord(record: Record<string, any>): Record<string, any> {
    const processed = { ...record };

    for (const key in processed) {
      if (processed[key] === undefined || processed[key] === null) {
        delete processed[key];
      }
    }

    // Convert Date objects to ISO strings for date fields
    if (processed.createdAt instanceof Date) {
      processed.createdAt = processed.createdAt.toISOString();
    }
    if (processed.updatedAt instanceof Date) {
      processed.updatedAt = processed.updatedAt.toISOString();
    }

    // Convert JSON fields to strings if they're objects, or set to null if undefined
    // These fields have set/get functions in the entity but validation happens before set
    if (typeof processed.scope === 'object') {
      processed.scope = JSON.stringify(processed.scope);
    }

    if (typeof processed.attributes === 'object') {
      processed.attributes = JSON.stringify(processed.attributes);
    }

    if (typeof processed.metadata === 'object') {
      processed.metadata = JSON.stringify(processed.metadata);
    }

    if (typeof processed.events === 'object') {
      processed.events = JSON.stringify(processed.events);
    }

    if (typeof processed.links === 'object') {
      processed.links = JSON.stringify(processed.links);
    }

    if (typeof processed.input === 'object') {
      processed.input = JSON.stringify(processed.input);
    }

    if (typeof processed.output === 'object') {
      processed.output = JSON.stringify(processed.output);
    }

    if (typeof processed.error === 'object') {
      processed.error = JSON.stringify(processed.error);
    }

    return processed;
  }

  async getAITrace(traceId: string): Promise<AITrace | null> {
    try {
      const result = await this.service.entities.ai_span.query.byTraceId({ entity: 'ai-span', traceId }).go();

      console.log(`result`, JSON.stringify(result, null, 2));

      if (result.data.length === 0) {
        return null;
      }

      return {
        traceId,
        spans: result.data.map((span: Record<string, any>) => this.transformRowToAISpan(span)),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'DYNAMODB_STORAGE_GET_AI_TRACE_FAILED',
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
    // TODO: fix filtering for json properties
    const { filters, page = 0, perPage = 10 } = args;

    try {
      let query;

      // Determine which index to use based on the provided filters
      if (filters?.name) {
        query = this.service.entities.ai_span.query.byName({ entity: 'ai-span', name: filters.name });
      } else if (filters?.spanType !== undefined) {
        query = this.service.entities.ai_span.query.bySpanType({ entity: 'ai-span', spanType: filters.spanType });
      } else if (filters?.traceId !== undefined) {
        query = this.service.entities.ai_span.query.byTraceId({ entity: 'ai-span', traceId: filters.traceId });
      } else if (filters?.createdAt !== undefined) {
        const createdAt = filters.createdAt instanceof Date ? filters.createdAt.toISOString() : filters.createdAt;
        query = this.service.entities.ai_span.query.byCreatedAt({ entity: 'ai-span', createdAt });
      } else {
        this.logger.warn('Performing a scan operation on AI spans - consider using a more specific query');
        // Use scan operation to get all spans - this is more reliable for getting all data
        query = this.service.entities.ai_span.scan;
      }

      // For DynamoDB, we need to fetch all data and apply pagination in memory
      // since DynamoDB doesn't support traditional offset-based pagination
      const results = await query.go({
        pages: 'all', // Get all pages to apply filtering and pagination
      });

      if (!results.data.length) {
        return {
          spans: [],
          total: 0,
          page,
          perPage,
          hasMore: false,
        };
      }

      // Apply filters in memory
      let filteredData = results.data;

      // Filter for parent spans (parentSpanId === 'ROOT')
      filteredData = filteredData.filter((item: Record<string, any>) => {
        return item.parentSpanId === 'ROOT';
      });

      // Apply date range filtering on startTime if provided
      if (filters?.dateRange?.start) {
        const startTs =
          filters.dateRange.start instanceof Date
            ? filters.dateRange.start.getTime()
            : new Date(filters.dateRange.start).getTime();
        filteredData = filteredData.filter((item: Record<string, any>) => {
          return item.startTime >= startTs;
        });
      }

      if (filters?.dateRange?.end) {
        const endTs =
          filters.dateRange.end instanceof Date
            ? filters.dateRange.end.getTime()
            : new Date(filters.dateRange.end).getTime();
        filteredData = filteredData.filter((item: Record<string, any>) => {
          return item.startTime <= endTs;
        });
      }

      // Sort by startTime in descending order (newest first) to ensure consistent ordering
      filteredData.sort((a: Record<string, any>, b: Record<string, any>) => {
        const timeA = a.startTime || 0;
        const timeB = b.startTime || 0;
        return timeB - timeA; // Descending order (newest first)
      });

      // Apply pagination
      const total = filteredData.length;
      const start = page * perPage;
      const end = start + perPage;
      const paginatedData = filteredData.slice(start, end);

      // Transform the paginated parent spans only (no child spans)
      const parentSpans = paginatedData.map((item: Record<string, any>) => this.transformRowToAISpan(item));

      return {
        spans: parentSpans,
        total,
        page,
        perPage,
        hasMore: end < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'DYNAMODB_STORAGE_GET_AI_SPANS_PAGINATED_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to get AI spans paginated: ${error}`,
      );
    }
  }

  private transformRowToAISpan(row: Record<string, any>): Record<string, any> {
    return {
      ...row,
      parentSpanId: row.parentSpanId === 'ROOT' ? null : row.parentSpanId,
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
      const recordsWithIds = args.records.map(record =>
        this.preprocessAiSpanRecord({
          entity: 'ai-span',
          id: `${record.traceId}-${record.spanId}`,
          traceId: record.traceId,
          spanId: record.spanId,
          parentSpanId: record.parentSpanId || 'ROOT', // Convert null to 'ROOT'
          name: record.name,
          scope: record.scope,
          spanType: record.spanType,
          attributes: record.attributes,
          metadata: record.metadata,
          events: record.events,
          links: record.links,
          input: record.input,
          output: record.output,
          error: record.error,
          startTime: record.startTime,
          endTime: record.endTime,
          createdAt: new Date().toISOString(),
        }),
      );

      // Use batchInsert like traces implementation
      await this.operations.batchInsert({
        tableName: TABLE_AI_SPAN,
        records: recordsWithIds, // Records already have 'entity' included
      });
    } catch (error) {
      throw new MastraError(
        {
          id: 'DYNAMODB_STORAGE_BATCH_AI_SPAN_CREATE_FAILED',
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
          id: 'DYNAMODB_STORAGE_BATCH_AI_SPAN_UPDATE_FAILED',
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
      // DynamoDB batch delete has a limit of 25 items per request
      const batchSize = 25;
      for (let i = 0; i < args.ids.length; i += batchSize) {
        const batch = args.ids.slice(i, i + batchSize);
        const deleteRequests = batch.map(id => ({ entity: 'ai-span', id }));
        await this.service.entities.ai_span.delete(deleteRequests).go();
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'DYNAMODB_STORAGE_BATCH_AI_SPAN_DELETE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        `Failed to batch delete AI spans: ${error}`,
      );
    }
  }
}
