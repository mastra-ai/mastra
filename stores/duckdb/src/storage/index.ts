import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { StorageDomains } from '@mastra/core/storage';
import { MastraCompositeStore, ObservabilityStorage as CoreObservabilityStorage } from '@mastra/core/storage';

import { DuckDBConnection } from './db/index';
import type {
  ObservabilityDuckDBConfig,
  ObservabilityStorageDuckDB as ObservabilityStorageDuckDBImpl,
} from './domains/observability/index';

const OBSERVABILITY_UPGRADE_MESSAGE =
  'DuckDB observability storage requires `@mastra/core` with observability storage support. Upgrade `@mastra/core` to use this store.';

function isObservabilityCompatibilityError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('@mastra/core') &&
    (error.message.includes('does not provide an export named') ||
      error.message.includes('No matching export') ||
      error.message.includes('Cannot find module') ||
      error.message.includes('Cannot find package'))
  );
}

// Re-export lower-level pieces for direct use / composition
export { DuckDBConnection } from './db/index';
export type { DuckDBStorageConfig } from './db/index';
export type { ObservabilityDuckDBConfig } from './domains/observability/index';

type ObservabilityStoreImpl = ObservabilityStorageDuckDBImpl;

/**
 * Lazy DuckDB observability facade.
 *
 * This avoids loading the concrete observability implementation until init or first use,
 * which lets DuckDBStore degrade cleanly when paired with an older @mastra/core runtime.
 */
export class ObservabilityStorageDuckDB extends CoreObservabilityStorage {
  private db: DuckDBConnection;
  private delegate: ObservabilityStoreImpl | null = null;
  private loadPromise: Promise<ObservabilityStoreImpl | null> | null = null;
  private unavailableError: MastraError | null = null;

  constructor(config: ObservabilityDuckDBConfig) {
    super();
    this.db = config.db;
  }

  private createUnavailableError(cause?: unknown): MastraError {
    return new MastraError(
      {
        id: 'OBSERVABILITY_STORAGE_DUCKDB_CORE_UPGRADE_NOT_IMPLEMENTED',
        domain: ErrorDomain.MASTRA_OBSERVABILITY,
        category: ErrorCategory.SYSTEM,
        text: OBSERVABILITY_UPGRADE_MESSAGE,
      },
      cause,
    );
  }

  private async loadDelegate(): Promise<ObservabilityStoreImpl | null> {
    if (this.delegate) {
      return this.delegate;
    }

    if (this.unavailableError) {
      return null;
    }

    if (!this.loadPromise) {
      this.loadPromise = import('./domains/observability/index')
        .then(({ ObservabilityStorageDuckDB }) => {
          const delegate = new ObservabilityStorageDuckDB({ db: this.db });
          this.delegate = delegate;
          return delegate;
        })
        .catch(error => {
          if (isObservabilityCompatibilityError(error)) {
            this.unavailableError = this.createUnavailableError(error);
            return null;
          }

          throw error;
        });
    }

    return this.loadPromise;
  }

  private async requireDelegate(): Promise<ObservabilityStoreImpl> {
    const delegate = await this.loadDelegate();
    if (!delegate) {
      throw this.unavailableError ?? this.createUnavailableError();
    }

    return delegate;
  }

  get observabilityStrategy(): ObservabilityStoreImpl['observabilityStrategy'] {
    return (
      this.delegate?.observabilityStrategy ?? {
        preferred: 'event-sourced',
        supported: ['event-sourced'],
      }
    );
  }

  get tracingStrategy(): ObservabilityStoreImpl['tracingStrategy'] {
    return this.delegate?.tracingStrategy ?? this.observabilityStrategy;
  }

  async init(...args: Parameters<ObservabilityStoreImpl['init']>): ReturnType<ObservabilityStoreImpl['init']> {
    const delegate = await this.loadDelegate();
    if (!delegate) {
      return;
    }

    return delegate.init(...args);
  }

  async migrateSpans(
    ...args: Parameters<ObservabilityStoreImpl['migrateSpans']>
  ): ReturnType<ObservabilityStoreImpl['migrateSpans']> {
    const delegate = await this.requireDelegate();
    return delegate.migrateSpans(...args);
  }

  async dangerouslyClearAll(
    ...args: Parameters<ObservabilityStoreImpl['dangerouslyClearAll']>
  ): ReturnType<ObservabilityStoreImpl['dangerouslyClearAll']> {
    const delegate = await this.requireDelegate();
    return delegate.dangerouslyClearAll(...args);
  }

  async createSpan(
    ...args: Parameters<ObservabilityStoreImpl['createSpan']>
  ): ReturnType<ObservabilityStoreImpl['createSpan']> {
    const delegate = await this.requireDelegate();
    return delegate.createSpan(...args);
  }

  async updateSpan(
    ...args: Parameters<ObservabilityStoreImpl['updateSpan']>
  ): ReturnType<ObservabilityStoreImpl['updateSpan']> {
    const delegate = await this.requireDelegate();
    return delegate.updateSpan(...args);
  }

  async getSpan(...args: Parameters<ObservabilityStoreImpl['getSpan']>): ReturnType<ObservabilityStoreImpl['getSpan']> {
    const delegate = await this.requireDelegate();
    return delegate.getSpan(...args);
  }

  async getSpans(
    ...args: Parameters<ObservabilityStoreImpl['getSpans']>
  ): ReturnType<ObservabilityStoreImpl['getSpans']> {
    const delegate = await this.requireDelegate();
    return delegate.getSpans(...args);
  }

  async getRootSpan(
    ...args: Parameters<ObservabilityStoreImpl['getRootSpan']>
  ): ReturnType<ObservabilityStoreImpl['getRootSpan']> {
    const delegate = await this.requireDelegate();
    return delegate.getRootSpan(...args);
  }

  async getTrace(
    ...args: Parameters<ObservabilityStoreImpl['getTrace']>
  ): ReturnType<ObservabilityStoreImpl['getTrace']> {
    const delegate = await this.requireDelegate();
    return delegate.getTrace(...args);
  }

  async getTraceLight(
    ...args: Parameters<ObservabilityStoreImpl['getTraceLight']>
  ): ReturnType<ObservabilityStoreImpl['getTraceLight']> {
    const delegate = await this.requireDelegate();
    return delegate.getTraceLight(...args);
  }

  async listTraces(
    ...args: Parameters<ObservabilityStoreImpl['listTraces']>
  ): ReturnType<ObservabilityStoreImpl['listTraces']> {
    const delegate = await this.requireDelegate();
    return delegate.listTraces(...args);
  }

  async listBranches(
    ...args: Parameters<ObservabilityStoreImpl['listBranches']>
  ): ReturnType<ObservabilityStoreImpl['listBranches']> {
    const delegate = await this.requireDelegate();
    return delegate.listBranches(...args);
  }

  async batchCreateSpans(
    ...args: Parameters<ObservabilityStoreImpl['batchCreateSpans']>
  ): ReturnType<ObservabilityStoreImpl['batchCreateSpans']> {
    const delegate = await this.requireDelegate();
    return delegate.batchCreateSpans(...args);
  }

  async batchUpdateSpans(
    ...args: Parameters<ObservabilityStoreImpl['batchUpdateSpans']>
  ): ReturnType<ObservabilityStoreImpl['batchUpdateSpans']> {
    const delegate = await this.requireDelegate();
    return delegate.batchUpdateSpans(...args);
  }

  async batchDeleteTraces(
    ...args: Parameters<ObservabilityStoreImpl['batchDeleteTraces']>
  ): ReturnType<ObservabilityStoreImpl['batchDeleteTraces']> {
    const delegate = await this.requireDelegate();
    return delegate.batchDeleteTraces(...args);
  }

  async batchCreateLogs(
    ...args: Parameters<ObservabilityStoreImpl['batchCreateLogs']>
  ): ReturnType<ObservabilityStoreImpl['batchCreateLogs']> {
    const delegate = await this.requireDelegate();
    return delegate.batchCreateLogs(...args);
  }

  async listLogs(
    ...args: Parameters<ObservabilityStoreImpl['listLogs']>
  ): ReturnType<ObservabilityStoreImpl['listLogs']> {
    const delegate = await this.requireDelegate();
    return delegate.listLogs(...args);
  }

  async batchCreateMetrics(
    ...args: Parameters<ObservabilityStoreImpl['batchCreateMetrics']>
  ): ReturnType<ObservabilityStoreImpl['batchCreateMetrics']> {
    const delegate = await this.requireDelegate();
    return delegate.batchCreateMetrics(...args);
  }

  async listMetrics(
    ...args: Parameters<ObservabilityStoreImpl['listMetrics']>
  ): ReturnType<ObservabilityStoreImpl['listMetrics']> {
    const delegate = await this.requireDelegate();
    return delegate.listMetrics(...args);
  }

  async getMetricAggregate(
    ...args: Parameters<ObservabilityStoreImpl['getMetricAggregate']>
  ): ReturnType<ObservabilityStoreImpl['getMetricAggregate']> {
    const delegate = await this.requireDelegate();
    return delegate.getMetricAggregate(...args);
  }

  async getMetricBreakdown(
    ...args: Parameters<ObservabilityStoreImpl['getMetricBreakdown']>
  ): ReturnType<ObservabilityStoreImpl['getMetricBreakdown']> {
    const delegate = await this.requireDelegate();
    return delegate.getMetricBreakdown(...args);
  }

  async getMetricTimeSeries(
    ...args: Parameters<ObservabilityStoreImpl['getMetricTimeSeries']>
  ): ReturnType<ObservabilityStoreImpl['getMetricTimeSeries']> {
    const delegate = await this.requireDelegate();
    return delegate.getMetricTimeSeries(...args);
  }

  async getMetricPercentiles(
    ...args: Parameters<ObservabilityStoreImpl['getMetricPercentiles']>
  ): ReturnType<ObservabilityStoreImpl['getMetricPercentiles']> {
    const delegate = await this.requireDelegate();
    return delegate.getMetricPercentiles(...args);
  }

  async getMetricNames(
    ...args: Parameters<ObservabilityStoreImpl['getMetricNames']>
  ): ReturnType<ObservabilityStoreImpl['getMetricNames']> {
    const delegate = await this.requireDelegate();
    return delegate.getMetricNames(...args);
  }

  async getMetricLabelKeys(
    ...args: Parameters<ObservabilityStoreImpl['getMetricLabelKeys']>
  ): ReturnType<ObservabilityStoreImpl['getMetricLabelKeys']> {
    const delegate = await this.requireDelegate();
    return delegate.getMetricLabelKeys(...args);
  }

  async getMetricLabelValues(
    ...args: Parameters<ObservabilityStoreImpl['getMetricLabelValues']>
  ): ReturnType<ObservabilityStoreImpl['getMetricLabelValues']> {
    const delegate = await this.requireDelegate();
    return delegate.getMetricLabelValues(...args);
  }

  async getEntityTypes(
    ...args: Parameters<ObservabilityStoreImpl['getEntityTypes']>
  ): ReturnType<ObservabilityStoreImpl['getEntityTypes']> {
    const delegate = await this.requireDelegate();
    return delegate.getEntityTypes(...args);
  }

  async getEntityNames(
    ...args: Parameters<ObservabilityStoreImpl['getEntityNames']>
  ): ReturnType<ObservabilityStoreImpl['getEntityNames']> {
    const delegate = await this.requireDelegate();
    return delegate.getEntityNames(...args);
  }

  async getServiceNames(
    ...args: Parameters<ObservabilityStoreImpl['getServiceNames']>
  ): ReturnType<ObservabilityStoreImpl['getServiceNames']> {
    const delegate = await this.requireDelegate();
    return delegate.getServiceNames(...args);
  }

  async getEnvironments(
    ...args: Parameters<ObservabilityStoreImpl['getEnvironments']>
  ): ReturnType<ObservabilityStoreImpl['getEnvironments']> {
    const delegate = await this.requireDelegate();
    return delegate.getEnvironments(...args);
  }

  async getTags(...args: Parameters<ObservabilityStoreImpl['getTags']>): ReturnType<ObservabilityStoreImpl['getTags']> {
    const delegate = await this.requireDelegate();
    return delegate.getTags(...args);
  }

  async createScore(
    ...args: Parameters<ObservabilityStoreImpl['createScore']>
  ): ReturnType<ObservabilityStoreImpl['createScore']> {
    const delegate = await this.requireDelegate();
    return delegate.createScore(...args);
  }

  async batchCreateScores(
    ...args: Parameters<ObservabilityStoreImpl['batchCreateScores']>
  ): ReturnType<ObservabilityStoreImpl['batchCreateScores']> {
    const delegate = await this.requireDelegate();
    return delegate.batchCreateScores(...args);
  }

  async listScores(
    ...args: Parameters<ObservabilityStoreImpl['listScores']>
  ): ReturnType<ObservabilityStoreImpl['listScores']> {
    const delegate = await this.requireDelegate();
    return delegate.listScores(...args);
  }

  async getScoreById(
    ...args: Parameters<ObservabilityStoreImpl['getScoreById']>
  ): ReturnType<ObservabilityStoreImpl['getScoreById']> {
    const delegate = await this.requireDelegate();
    return delegate.getScoreById(...args);
  }

  async getScoreAggregate(
    ...args: Parameters<ObservabilityStoreImpl['getScoreAggregate']>
  ): ReturnType<ObservabilityStoreImpl['getScoreAggregate']> {
    const delegate = await this.requireDelegate();
    return delegate.getScoreAggregate(...args);
  }

  async getScoreBreakdown(
    ...args: Parameters<ObservabilityStoreImpl['getScoreBreakdown']>
  ): ReturnType<ObservabilityStoreImpl['getScoreBreakdown']> {
    const delegate = await this.requireDelegate();
    return delegate.getScoreBreakdown(...args);
  }

  async getScoreTimeSeries(
    ...args: Parameters<ObservabilityStoreImpl['getScoreTimeSeries']>
  ): ReturnType<ObservabilityStoreImpl['getScoreTimeSeries']> {
    const delegate = await this.requireDelegate();
    return delegate.getScoreTimeSeries(...args);
  }

  async getScorePercentiles(
    ...args: Parameters<ObservabilityStoreImpl['getScorePercentiles']>
  ): ReturnType<ObservabilityStoreImpl['getScorePercentiles']> {
    const delegate = await this.requireDelegate();
    return delegate.getScorePercentiles(...args);
  }

  async createFeedback(
    ...args: Parameters<ObservabilityStoreImpl['createFeedback']>
  ): ReturnType<ObservabilityStoreImpl['createFeedback']> {
    const delegate = await this.requireDelegate();
    return delegate.createFeedback(...args);
  }

  async batchCreateFeedback(
    ...args: Parameters<ObservabilityStoreImpl['batchCreateFeedback']>
  ): ReturnType<ObservabilityStoreImpl['batchCreateFeedback']> {
    const delegate = await this.requireDelegate();
    return delegate.batchCreateFeedback(...args);
  }

  async listFeedback(
    ...args: Parameters<ObservabilityStoreImpl['listFeedback']>
  ): ReturnType<ObservabilityStoreImpl['listFeedback']> {
    const delegate = await this.requireDelegate();
    return delegate.listFeedback(...args);
  }

  async getFeedbackAggregate(
    ...args: Parameters<ObservabilityStoreImpl['getFeedbackAggregate']>
  ): ReturnType<ObservabilityStoreImpl['getFeedbackAggregate']> {
    const delegate = await this.requireDelegate();
    return delegate.getFeedbackAggregate(...args);
  }

  async getFeedbackBreakdown(
    ...args: Parameters<ObservabilityStoreImpl['getFeedbackBreakdown']>
  ): ReturnType<ObservabilityStoreImpl['getFeedbackBreakdown']> {
    const delegate = await this.requireDelegate();
    return delegate.getFeedbackBreakdown(...args);
  }

  async getFeedbackTimeSeries(
    ...args: Parameters<ObservabilityStoreImpl['getFeedbackTimeSeries']>
  ): ReturnType<ObservabilityStoreImpl['getFeedbackTimeSeries']> {
    const delegate = await this.requireDelegate();
    return delegate.getFeedbackTimeSeries(...args);
  }

  async getFeedbackPercentiles(
    ...args: Parameters<ObservabilityStoreImpl['getFeedbackPercentiles']>
  ): ReturnType<ObservabilityStoreImpl['getFeedbackPercentiles']> {
    const delegate = await this.requireDelegate();
    return delegate.getFeedbackPercentiles(...args);
  }
}

/** Configuration for the top-level DuckDBStore composite. */
export interface DuckDBStoreConfig {
  /** Store identifier. Defaults to 'duckdb'. */
  id?: string;
  /**
   * Path to the DuckDB database file.
   * @default 'mastra.duckdb'
   * Use ':memory:' for an ephemeral in-memory database.
   */
  path?: string;
}

/**
 * DuckDB storage adapter for Mastra.
 *
 * Currently provides observability storage (traces, metrics, logs, scores, feedback).
 * Use via composition with another store for domains DuckDB doesn't yet cover.
 *
 * @example
 * ```typescript
 * // As the observability backend in a composed store
 * const storage = new MastraCompositeStore({
 *   id: 'my-store',
 *   default: new LibSQLStore({ id: 'my-store', url: 'file:./dev.db' }),
 *   domains: {
 *     observability: new DuckDBStore().observability,
 *   },
 * });
 *
 * // Or standalone (only observability domain available)
 * const duckdb = new DuckDBStore();
 * const obs = await duckdb.getStore('observability');
 * ```
 */
export class DuckDBStore extends MastraCompositeStore {
  readonly db: DuckDBConnection;
  private observabilityStore: ObservabilityStorageDuckDB;

  stores: StorageDomains;

  constructor(config: DuckDBStoreConfig = {}) {
    const id = config.id ?? 'duckdb';
    super({ id, name: 'DuckDBStore' });

    this.db = new DuckDBConnection({ path: config.path });
    this.observabilityStore = new ObservabilityStorageDuckDB({ db: this.db });

    this.stores = {
      observability: this.observabilityStore,
    };
  }

  /** Convenience accessor for the observability domain. */
  get observability(): ObservabilityStorageDuckDB {
    return this.observabilityStore;
  }
}
