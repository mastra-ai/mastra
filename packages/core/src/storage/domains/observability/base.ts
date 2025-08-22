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
   * Creates a single AI span record in the storage provider.
   * @param span - The AI span record to create
   * @returns Promise that resolves when the span is successfully created
   * @throws {MastraError} When the storage provider doesn't support creating AI spans
   */
  createAISpan(span: AISpanRecord): Promise<void> {
    throw new MastraError({
      id: 'CREATE_AI_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support creating AI spans',
    });
  }

  /**
   * Updates a single AI span with partial data. Primarily used for realtime trace creation.
   * @param params - The update parameters
   * @param params.spanId - The unique identifier of the AI span to update
   * @param params.traceId - The unique identifier of the trace the span belongs to
   * @param params.updates - Partial updates to apply to the AI span (excludes spanId and traceId)
   * @returns Promise that resolves when the span is successfully updated
   * @throws {MastraError} When the storage provider doesn't support updating AI spans
   */
  updateAISpan(params: {
    spanId: string;
    traceId: string;
    updates: Partial<Omit<AISpanRecord, 'spanId' | 'traceId'>>;
  }): Promise<void> {
    throw new MastraError({
      id: 'UPDATE_AI_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support updating AI spans',
    });
  }

  /**
   * Retrieves a single AI trace with all its associated spans.
   * @param traceId - The unique identifier of the trace to retrieve
   * @returns Promise resolving to the complete trace record, or null if not found
   * @throws {MastraError} When the storage provider doesn't support getting AI traces
   */
  getAITrace(traceId: string): Promise<AITraceRecord | null> {
    throw new MastraError({
      id: 'GET_AI_TRACE_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support getting AI traces',
    });
  }

  /**
   * Retrieves a paginated list of AI traces with optional filtering.
   * Returns only the top-level AI span for each trace. Use `getAITrace()` to get the full history for a single trace.
   * @param args - The query arguments for retrieving traces
   * @param args.filter - Optional filtering criteria for traces
   * @param args.filter.name - Optional name filter for AI traces
   * @param args.filter.spanType - Optional span type filter
   * @param args.pagination - Pagination options
   * @param args.pagination.dateRange - Optional date range for pagination
   * @param args.pagination.page - Page number (defaults to 0)
   * @param args.pagination.perPage - Items per page (defaults to 100)
   * @returns Promise resolving to paginated traces with pagination metadata
   * @throws {MastraError} When the storage provider doesn't support paginated trace retrieval
   */
  getAITracesPaginated(args: AITracesPaginatedArg): Promise<PaginationInfo & { traces: AITraceRecord[] }> {
    throw new MastraError({
      id: 'GET_AI_TRACES_PAGINATED_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support getting AI traces paginated',
    });
  }

  /**
   * Creates multiple AI spans in a single batch operation for improved performance.
   * @param args - The batch creation arguments
   * @param args.records - Array of AI span records to create
   * @returns Promise that resolves when all spans are successfully created
   * @throws {MastraError} When the storage provider doesn't support batch creating AI spans
   */
  batchCreateAISpans(args: { records: AISpanRecord[] }): Promise<void> {
    throw new MastraError({
      id: 'BATCH_CREATE_AI_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support batch creating AI spans',
    });
  }

  /**
   * Updates multiple AI spans in a single batch operation for improved performance.
   * @param args - The batch update arguments
   * @param args.records - Array of span update requests
   * @param args.records[].traceId - The unique identifier of the trace containing the span
   * @param args.records[].spanId - The unique identifier of the span to update
   * @param args.records[].updates - Partial updates to apply to the span (excludes spanId and traceId)
   * @returns Promise that resolves when all spans are successfully updated
   * @throws {MastraError} When the storage provider doesn't support batch updating AI spans
   */
  batchUpdateAISpans(args: {
    records: {
      traceId: string;
      spanId: string;
      updates: Partial<Omit<AISpanRecord, 'spanId' | 'traceId'>>;
    }[];
  }): Promise<void> {
    throw new MastraError({
      id: 'BATCH_UPDATE_AI_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support batch updating AI spans',
    });
  }

  /**
   * Deletes multiple AI traces and all their associated spans in a single batch operation.
   * @param args - Array of trace deletion requests
   * @param args[].traceIds - The unique identifier of the trace to delete
   * @returns Promise that resolves when all traces are successfully deleted
   * @throws {MastraError} When the storage provider doesn't support batch deleting AI traces
   */
  batchDeleteAITraces(args: { traceIds: string }[]): Promise<void> {
    throw new MastraError({
      id: 'BATCH_DELETE_AI_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support batch deleting AI spans',
    });
  }
}
