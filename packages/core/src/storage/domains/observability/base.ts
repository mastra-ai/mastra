import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import { StorageDomain } from '../base';
import type {
  BatchCreateSpansArgs,
  BatchDeleteTracesArgs,
  BatchUpdateSpansArgs,
  CreateSpanArgs,
  GetRootSpanArgs,
  GetRootSpanResponse,
  GetSpanArgs,
  GetSpanResponse,
  GetTraceArgs,
  GetTraceResponse,
  ListTracesArgs,
  ListTracesResponse,
  TracingStorageStrategy,
  UpdateSpanArgs,
} from './types';

/**
 * ObservabilityStorage is not abstract because it provides default implementations
 * that throw errors - adapters override only the methods they support.
 */
export class ObservabilityStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'OBSERVABILITY',
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    // Default no-op - subclasses override
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
  async createSpan(_args: CreateSpanArgs): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_CREATE_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support creating spans',
    });
  }

  /**
   * Updates a single Span with partial data. Primarily used for realtime trace creation.
   */
  async updateSpan(_args: UpdateSpanArgs): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_UPDATE_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support updating spans',
    });
  }

  /**
   * Retrieves a single span.
   */
  async getSpan(_args: GetSpanArgs): Promise<GetSpanResponse | null> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support getting spans',
    });
  }

  /**
   * Retrieves a single root span.
   */
  async getRootSpan(_args: GetRootSpanArgs): Promise<GetRootSpanResponse | null> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_ROOT_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support getting root spans',
    });
  }

  /**
   * Retrieves a single trace with all its associated spans.
   */
  async getTrace(_args: GetTraceArgs): Promise<GetTraceResponse | null> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_TRACE_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support getting traces',
    });
  }

  /**
   * Retrieves a list of traces with optional filtering.
   */
  async listTraces(_args: ListTracesArgs): Promise<ListTracesResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_LIST_TRACES_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support listing traces',
    });
  }

  /**
   * Creates multiple Spans in a single batch.
   */
  async batchCreateSpans(_args: BatchCreateSpansArgs): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_BATCH_CREATE_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support batch creating spans',
    });
  }

  /**
   * Updates multiple Spans in a single batch.
   */
  async batchUpdateSpans(_args: BatchUpdateSpansArgs): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_BATCH_UPDATE_SPANS_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support batch updating spans',
    });
  }

  /**
   * Deletes multiple traces and all their associated spans in a single batch operation.
   */
  async batchDeleteTraces(_args: BatchDeleteTracesArgs): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_BATCH_DELETE_TRACES_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support batch deleting traces',
    });
  }
}
