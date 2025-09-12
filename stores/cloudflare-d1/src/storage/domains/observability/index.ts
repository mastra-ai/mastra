import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { ObservabilityStorage, TABLE_AI_SPANS } from '@mastra/core/storage';
import type { AITraceRecord, PaginationInfo, AITracesPaginatedArg, AISpanRecord } from '@mastra/core/storage';
import { createSqlBuilder } from '../../sql-builder';
import type { StoreOperationsD1 } from '../operations';

export class ObservabilityStorageD1 extends ObservabilityStorage {
  private operations: StoreOperationsD1;

  constructor({ operations }: { operations: StoreOperationsD1 }) {
    super();
    this.operations = operations;
  }

  async createAISpan(span: AISpanRecord): Promise<void> {
    try {

      const validatedSpan = this.validateCreateAISpanPayload(span);
      const serializedSpan = this.serializeSpanForD1(validatedSpan);

      console.log('serializedSpan', serializedSpan);

      // Use batchInsert for consistency (single record)
      await this.operations.batchInsert({
        tableName: TABLE_AI_SPANS,
        records: [serializedSpan],
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

  async getAITrace(traceId: string): Promise<AITraceRecord | null> {
    try {
      const fullTableName = this.operations.getTableName(TABLE_AI_SPANS);
      const query = createSqlBuilder().select('*').from(fullTableName).where('traceId = ?', traceId);
      const { sql, params } = query.build();

      const result = await this.operations.executeQuery({ sql, params });

      if (!result) {
        return null;
      }

      const spans = result.map(this.deserializeSpanFromD1);
      return {
        traceId,
        spans,
      }
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

  async updateAISpan(_params: { spanId: string; traceId: string; updates: Partial<Omit<AISpanRecord, 'spanId' | 'traceId'>>; }): Promise<void> {
      try {
        const validatedPayload = this.validateUpdateAISpanPayload(params.updates);
        const id = this.generateId({ traceId: params.traceId, spanId: params.spanId });
        const span = this.collection.get(id);
        
      }
  }

  private serializeSpanForD1(span: AISpanRecord) {
    const processedSpan: Record<string, any> = { ...span };

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

  private deserializeSpanFromD1(span: Record<string, any>): Record<string, any> {
    const deserialized: Record<string, any> = { ...span };
    deserialized.createdAt = new Date(deserialized.createdAt);
    deserialized.updatedAt = deserialized.updatedAt ? new Date(deserialized.updatedAt) : null;
    deserialized.startedAt = new Date(deserialized.startedAt);
    deserialized.endedAt = deserialized.endedAt ? new Date(deserialized.endedAt) : null;

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