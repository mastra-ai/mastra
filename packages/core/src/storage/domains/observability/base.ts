import { MastraBase } from '../../../base';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import type { TracingStorageStrategy } from '../../../observability';
import type { TABLE_SPANS } from '../../constants';
import type {
  SpanRecord,
  TraceRecord,
  TracesPaginatedArg,
  CreateSpanRecord,
  PaginationInfo,
  UpdateSpanRecord,
  CreateIndexOptions,
  IndexInfo,
  StorageIndexStats,
} from '../../types';
export abstract class ObservabilityStorageBase extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'OBSERVABILITY',
    });
  }

  init(): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_INITIALIZE_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider has not been initialized',
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
      id: 'OBSERVABILITY_CREATE_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support creating spans',
    });
  }

  /**
   * Updates a single Span with partial data. Primarily used for realtime trace creation.
   */
  updateSpan(_params: { spanId: string; traceId: string; updates: Partial<UpdateSpanRecord> }): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_UPDATE_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support updating spans',
    });
  }

  /**
   * Retrieves a single trace with all its associated spans.
   */
  getTrace(_traceId: string): Promise<TraceRecord | null> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_TRACE_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support getting traces',
    });
  }

  /**
   * Retrieves a paginated list of traces with optional filtering.
   */
  listTraces(_args: TracesPaginatedArg): Promise<{ pagination: PaginationInfo; spans: SpanRecord[] }> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_TRACES_PAGINATED_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support getting traces paginated',
    });
  }

  /**
   * Creates multiple Spans in a single batch.
   */
  batchCreateSpans(_args: { records: CreateSpanRecord[] }): Promise<void> {
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
  batchUpdateSpans(_args: {
    records: {
      traceId: string;
      spanId: string;
      updates: Partial<UpdateSpanRecord>;
    }[];
  }): Promise<void> {
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
  batchDeleteTraces(_args: { traceIds: string[] }): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_BATCH_DELETE_TRACES_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support batch deleting traces',
    });
  }

  abstract dropData(): Promise<void>;

  async createIndexes(): Promise<void> {
    // Optional: subclasses can override this method to implement index creation
  }

  async dropIndexes(): Promise<void> {
    // Optional: subclasses can override this method to implement index dropping
  }

  async createIndex<T extends typeof TABLE_SPANS>({
    name: _name,
    table: _table,
    columns: _columns,
  }: {
    table: T;
  } & Omit<CreateIndexOptions, 'table'>): Promise<void> {
    // Optional: subclasses can override this method to implement index creation
  }

  async listIndexes<T extends typeof TABLE_SPANS>(_table: T): Promise<IndexInfo[]> {
    // Optional: subclasses can override this method to implement index listing
    return [];
  }

  async describeIndex(_name: string): Promise<StorageIndexStats> {
    // Optional: subclasses can override this method to implement index description
    throw new Error(
      `Index description is not supported by this storage adapter (${this.constructor.name}). ` +
        `The describeIndex method needs to be implemented in the storage adapter.`,
    );
  }

  async dropIndex(_name: string): Promise<void> {
    // Optional: subclasses can override this method to implement index dropping
  }
}
