import type { TracingStrategy } from '../../../ai-tracing';
import { MastraBase } from '../../../base';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import type { AISpanRecord, AITraceRecord, AITracesPaginatedArg, PaginationInfo } from '../../types';

export class ObservabilityStorage extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'OBSERVABILITY',
    });
  }

  /**
   * Provides hints for AI tracing strategy selection by the DefaultExporter.
   * Storage adapters can override this to specify their preferred and supported strategies.
   */
  public get aiTracingStrategy(): {
    preferred: TracingStrategy;
    supported: TracingStrategy[];
  } {
    return {
      preferred: 'batch-with-updates', // Default for most SQL stores
      supported: ['realtime', 'batch-with-updates', 'insert-only'],
    };
  }

  /**
   * Creates a single AI span record in the storage provider.
   */
  createAISpan(_span: Omit<AISpanRecord, 'createdAt' | 'updatedAt'>): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_CREATE_AI_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support creating AI spans',
    });
  }

  /**
   * Updates a single AI span with partial data. Primarily used for realtime trace creation.
   */
  updateAISpan(_params: {
    spanId: string;
    traceId: string;
    updates: Partial<Omit<AISpanRecord, 'createdAt' | 'updatedAt' | 'spanId' | 'traceId'>>;
  }): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_UPDATE_AI_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support updating AI spans',
    });
  }

  /**
   * Retrieves a single AI trace with all its associated spans.
   */
  getAITrace(_traceId: string): Promise<AITraceRecord | null> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_AI_TRACE_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support getting AI traces',
    });
  }

  /**
   * Retrieves a paginated list of AI traces with optional filtering.
   */
  getAITracesPaginated(_args: AITracesPaginatedArg): Promise<{ pagination: PaginationInfo; spans: AISpanRecord[] }> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_AI_TRACES_PAGINATED_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support getting AI traces paginated',
    });
  }

  /**
   * Creates multiple AI spans in a single batch.
   */
  batchCreateAISpans(_args: { records: Omit<AISpanRecord, 'createdAt' | 'updatedAt'>[] }): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_BATCH_CREATE_AI_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support batch creating AI spans',
    });
  }

  /**
   * Updates multiple AI spans in a single batch.
   */
  batchUpdateAISpans(_args: {
    records: {
      traceId: string;
      spanId: string;
      updates: Partial<Omit<AISpanRecord, 'createdAt' | 'updatedAt' | 'spanId' | 'traceId'>>;
    }[];
  }): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_BATCH_UPDATE_AI_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support batch updating AI spans',
    });
  }

  /**
   * Deletes multiple AI traces and all their associated spans in a single batch operation.
   */
  batchDeleteAITraces(_args: { traceIds: string[] }): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_BATCH_DELETE_AI_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support batch deleting AI traces',
    });
  }
}
