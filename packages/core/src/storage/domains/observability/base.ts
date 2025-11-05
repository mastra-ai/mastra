import { MastraBase } from '../../../base';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import type { TracingStorageStrategy } from '../../../observability';
import type {
  SpanRecord,
  AITraceRecord,
  AITracesPaginatedArg,
  CreateSpanRecord,
  PaginationInfo,
  UpdateSpanRecord,
} from '../../types';

export class ObservabilityStorage extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'OBSERVABILITY',
    });
  }

  /**
   * Provides hints for tracing strategy selection by the DefaultExporter.
   * Storage adapters can override this to specify their preferred and supported strategies.
   */
  public get tracingStrategy(): {
    preferred: TracingStorageStrategy;
    supported: TracingStorageStrategy[];
  } {
    return {
      preferred: 'batch-with-updates', // Default for most SQL stores
      supported: ['realtime', 'batch-with-updates', 'insert-only'],
    };
  }

  /**
   * Creates a single Span record in the storage provider.
   */
  createSpan(_span: CreateSpanRecord): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_CREATE_AI_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support creating Spans',
    });
  }

  /**
   * Updates a single Span with partial data. Primarily used for realtime trace creation.
   */
  updateSpan(_params: { spanId: string; traceId: string; updates: Partial<UpdateSpanRecord> }): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_UPDATE_AI_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support updating Spans',
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
  getAITracesPaginated(_args: AITracesPaginatedArg): Promise<{ pagination: PaginationInfo; spans: SpanRecord[] }> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_AI_TRACES_PAGINATED_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support getting AI traces paginated',
    });
  }

  /**
   * Creates multiple Spans in a single batch.
   */
  batchCreateSpans(_args: { records: CreateSpanRecord[] }): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_BATCH_CREATE_AI_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support batch creating Spans',
    });
  }

  /**
   * Updates multiple Spans in a single batch.
   */
  batchUpdateSpans(_args: {
    records: {
      traceId: string;
      spanId: string;
      updates: Partial<UpdateSpanRecord>;
    }[];
  }): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_BATCH_UPDATE_AI_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support batch updating Spans',
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
