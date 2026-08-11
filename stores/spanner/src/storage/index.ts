import { Spanner } from '@google-cloud/spanner';
import type { Database, Instance } from '@google-cloud/spanner';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId, MastraCompositeStore } from '@mastra/core/storage';
import type { StorageDomains, CreateIndexOptions } from '@mastra/core/storage';

import type { SpannerInitMode } from './db';
import { AgentsSpanner } from './domains/agents';
import { BackgroundTasksSpanner } from './domains/background-tasks';
import { BlobsSpanner } from './domains/blobs';
import { ChannelsSpanner } from './domains/channels';
import { DatasetsSpanner } from './domains/datasets';
import { ExperimentsSpanner } from './domains/experiments';
import { FavoritesSpanner } from './domains/favorites';
import { MCPClientsSpanner } from './domains/mcp-clients';
import { MCPServersSpanner } from './domains/mcp-servers';
import { MemorySpanner } from './domains/memory';
import { ObservabilitySpanner } from './domains/observability';
import { PromptBlocksSpanner } from './domains/prompt-blocks';
import { SchedulesSpanner } from './domains/schedules';
import { ScorerDefinitionsSpanner } from './domains/scorer-definitions';
import { ScoresSpanner } from './domains/scores';
import { SkillsSpanner } from './domains/skills';
import { WorkflowDefinitionsSpanner } from './domains/workflow-definitions';
import { WorkflowsSpanner } from './domains/workflows';
import { WorkspacesSpanner } from './domains/workspaces';

// Export domain classes for direct use with MastraStorage composition
export {
  AgentsSpanner,
  BackgroundTasksSpanner,
  BlobsSpanner,
  ChannelsSpanner,
  DatasetsSpanner,
  ExperimentsSpanner,
  FavoritesSpanner,
  MCPClientsSpanner,
  MCPServersSpanner,
  MemorySpanner,
  ObservabilitySpanner,
  PromptBlocksSpanner,
  SchedulesSpanner,
  ScorerDefinitionsSpanner,
  ScoresSpanner,
  SkillsSpanner,
  WorkflowDefinitionsSpanner,
  WorkflowsSpanner,
  WorkspacesSpanner,
};
export type { SpannerDomainConfig, SpannerInitMode } from './db';

/** Domain keys this adapter implements; the only valid values for `enabledDomains`. */
export const SPANNER_DOMAIN_KEYS = [
  'scores',
  'workflows',
  'memory',
  'backgroundTasks',
  'agents',
  'mcpClients',
  'mcpServers',
  'skills',
  'blobs',
  'promptBlocks',
  'scorerDefinitions',
  'schedules',
  'observability',
  'channels',
  'datasets',
  'experiments',
  'favorites',
  'workspaces',
  'workflowDefinitions',
] as const satisfies ReadonlyArray<keyof StorageDomains>;

export type SpannerDomainKey = (typeof SPANNER_DOMAIN_KEYS)[number];

/**
 * Cloud Spanner configuration accepted by `SpannerStore`.
 *
 * Supports either:
 * - Pre-configured `database` (a `@google-cloud/spanner` Database handle), or
 * - Connection details (`projectId`, `instanceId`, `databaseId`) from which the
 *   store creates a Spanner client internally.
 */
export type SpannerConfigType = {
  id: string;
  /**
   * When true, automatic initialization (table creation/migrations) is disabled.
   *
   * When `disableInit` is true, the store will not automatically create or alter
   * tables on first use. You must call `storage.init()` explicitly during a
   * separate deploy/migration step.
   */
  disableInit?: boolean;
  /**
   * When true, default indexes will not be created during initialization.
   * @default false
   */
  skipDefaultIndexes?: boolean;
  /**
   * Custom indexes to create during initialization. Each index must specify the
   * table it belongs to; the store routes indexes to the correct domain.
   */
  indexes?: CreateIndexOptions[];
  /**
   * Controls whether `init()` is allowed to apply schema changes.
   *
   * - `'sync'` (default): the adapter creates missing tables, columns, and
   *   indexes during `init()`. This is the historical behavior.
   * - `'validate'`: the adapter applies no DDL during `init()` and instead
   *   verifies that every table, column, and default/custom index it would
   *   have created already exists. Missing schema elements throw a typed
   *   user error so the operator can reconcile the externally-managed
   *   schema with what the adapter expects.
   *
   * `'validate'` is intended for environments where another process
   * (Terraform, Liquibase, a release pipeline, etc.) owns the schema.
   * @default 'sync'
   */
  initMode?: SpannerInitMode;
  /**
   * When true, versioned domains (agents / skills / prompt-blocks /
   * mcp-clients / mcp-servers / scorer-definitions) sweep orphaned draft
   * thin-row records during `init()`  i.e. drafts whose paired version
   * row was never written. The transactional `create()` rewrite makes
   * these orphans impossible going forward; this opt-in is for cleaning
   * up legacy data left by older deployments or for environments where
   * the small startup cost is acceptable.
   * @default false
   */
  cleanupStaleDraftsOnStartup?: boolean;
  /**
   * Restricts which storage domains this adapter constructs and initializes.
   *
   * When omitted (the default), all domains the adapter implements are
   * registered, matching historical behavior. When provided, only the listed
   * domains are constructed and added to `this.stores`; `init()` will only
   * touch those domains, and `getStore()` returns `undefined` for the rest.
   *
   * Useful when another store owns some domains in a composite, or when the
   * deployment environment manages only a subset of the schema (e.g. a
   * workflows-only Spanner database in `initMode: 'validate'`, where
   * validating tables for unused domains would fail).
   */
  enabledDomains?: ReadonlyArray<SpannerDomainKey>;
  /**
   * Maximum acceptable staleness (in milliseconds) for the observability
   * domain's read paths (metrics list / aggregates / breakdowns /
   * time-series / percentiles / discovery). When set to a positive value,
   * those queries run as bounded-staleness single-use reads, which Spanner
   * can route to any replica that's at least that fresh. They stop
   * competing with leader-region writes for CPU and can land on a closer
   * replica.
   *
   * Default is `10000` (weak reads against the leader).
   * @default 10000
   */
  dashboardStalenessMs?: number;
  /**
   * When true (the default), the observability domain's metric methods
   * throw `*_NOT_IMPLEMENTED` and the metrics table is not created during
   * `init()`. The `MastraStorageExporter` reads those errors and silently
   * drops metric emissions.
   *
   * This is the recommended default because Spanner is row-oriented and
   * OLTP-shaped — the metrics workload is write-heavy, scan-heavy, and
   * benefits from columnar storage. Pair Spanner spans with a dedicated
   * OLAP metrics store (DuckDB, ClickHouse) via a
   * `MastraCompositeStore`-level wrapper that fans out by signal.
   * @default true
   */
  disableMetrics?: boolean;
} & (
  | {
      /** Pre-configured Spanner Database handle. */
      database: Database;
    }
  | {
      projectId: string;
      instanceId: string;
      databaseId: string;
      /**
       * Optional pass-through to the `@google-cloud/spanner` client constructor.
       * Useful for credentials, custom service paths (e.g. against the emulator),
       * or auth overrides.
       */
      spannerOptions?: ConstructorParameters<typeof Spanner>[0];
    }
);

export type SpannerConfig = SpannerConfigType;

const isPreConfiguredDatabase = (config: SpannerConfigType): config is SpannerConfigType & { database: Database } =>
  'database' in config && !!(config as any).database;

/**
 * Google Cloud Spanner storage adapter for Mastra. Implements the GoogleSQL
 * dialect of Cloud Spanner.
 *
 * @example
 * ```typescript
 * const storage = new SpannerStore({
 *   id: 'my-store',
 *   projectId: 'my-project',
 *   instanceId: 'my-instance',
 *   databaseId: 'mastra',
 * });
 *
 * const memory = await storage.getStore('memory');
 * await memory?.saveThread({ thread });
 * ```
 */
export class SpannerStore extends MastraCompositeStore {
  public database: Database;
  public spanner?: Spanner;
  public instance?: Instance;
  private readonly ownsClient: boolean;
  stores: StorageDomains;

  constructor(config: SpannerConfigType) {
    if (!config.id || config.id.trim() === '') {
      throw new Error('SpannerStore: id must be provided and cannot be empty.');
    }
    super({ id: config.id, name: 'SpannerStore', disableInit: config.disableInit });
    try {
      if (isPreConfiguredDatabase(config)) {
        this.database = config.database;
        this.ownsClient = false;
      } else {
        for (const key of ['projectId', 'instanceId', 'databaseId'] as const) {
          if (!(key in config) || typeof (config as any)[key] !== 'string' || (config as any)[key].trim() === '') {
            throw new Error(`SpannerStore: ${key} must be provided and cannot be empty.`);
          }
        }
        this.spanner = new Spanner({
          projectId: config.projectId,
          ...(config.spannerOptions ?? {}),
        });
        this.instance = this.spanner.instance(config.instanceId);
        this.database = this.instance.database(config.databaseId);
        this.ownsClient = true;
      }

      const domainConfig = {
        database: this.database,
        skipDefaultIndexes: config.skipDefaultIndexes,
        indexes: config.indexes,
        initMode: config.initMode,
        cleanupStaleDraftsOnStartup: config.cleanupStaleDraftsOnStartup,
        dashboardStalenessMs: config.dashboardStalenessMs,
        disableMetrics: config.disableMetrics,
      };

      let enabled: Set<SpannerDomainKey> | null = null;
      if (config.enabledDomains) {
        enabled = new Set();
        for (const key of config.enabledDomains) {
          if (!(SPANNER_DOMAIN_KEYS as readonly string[]).includes(key)) {
            throw new Error(
              `SpannerStore: enabledDomains contains unknown domain '${key}'. Valid keys: ${SPANNER_DOMAIN_KEYS.join(', ')}.`,
            );
          }
          enabled.add(key);
        }
        if (enabled.size === 0) {
          throw new Error('SpannerStore: enabledDomains must contain at least one domain when provided.');
        }
      }
      const wants = (key: SpannerDomainKey) => enabled === null || enabled.has(key);

      this.stores = {
        ...(wants('scores') && { scores: new ScoresSpanner(domainConfig) }),
        ...(wants('workflows') && { workflows: new WorkflowsSpanner(domainConfig) }),
        ...(wants('memory') && { memory: new MemorySpanner(domainConfig) }),
        ...(wants('backgroundTasks') && { backgroundTasks: new BackgroundTasksSpanner(domainConfig) }),
        ...(wants('agents') && { agents: new AgentsSpanner(domainConfig) }),
        ...(wants('mcpClients') && { mcpClients: new MCPClientsSpanner(domainConfig) }),
        ...(wants('mcpServers') && { mcpServers: new MCPServersSpanner(domainConfig) }),
        ...(wants('skills') && { skills: new SkillsSpanner(domainConfig) }),
        ...(wants('blobs') && { blobs: new BlobsSpanner(domainConfig) }),
        ...(wants('promptBlocks') && { promptBlocks: new PromptBlocksSpanner(domainConfig) }),
        ...(wants('scorerDefinitions') && { scorerDefinitions: new ScorerDefinitionsSpanner(domainConfig) }),
        ...(wants('schedules') && { schedules: new SchedulesSpanner(domainConfig) }),
        ...(wants('observability') && { observability: new ObservabilitySpanner(domainConfig) }),
        ...(wants('channels') && { channels: new ChannelsSpanner(domainConfig) }),
        ...(wants('datasets') && { datasets: new DatasetsSpanner(domainConfig) }),
        ...(wants('experiments') && { experiments: new ExperimentsSpanner(domainConfig) }),
        ...(wants('favorites') && { favorites: new FavoritesSpanner(domainConfig) }),
        ...(wants('workspaces') && { workspaces: new WorkspacesSpanner(domainConfig) }),
        ...(wants('workflowDefinitions') && {
          workflowDefinitions: new WorkflowDefinitionsSpanner(domainConfig),
        }),
      };
    } catch (e) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'INITIALIZATION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        e,
      );
    }
  }

  /**
   * Initializes the storage by running each domain's `init()` sequentially.
   *
   * Spanner does not allow concurrent schema changes against the same database,
   * so the default `MastraCompositeStore.init()` (which fans out via
   * `Promise.all`) cannot be used here.
   *
   * Concurrent callers all await the same in-flight promise: the first call
   * installs a pending `hasInitialized` immediately, before any awaits, so a
   * second caller landing on `init()` sees it and queues behind the same loop
   * instead of starting its own.
   */
  async init(): Promise<void> {
    if ((this as any).shouldCacheInit && (this as any).hasInitialized) {
      await (this as any).hasInitialized;
      return;
    }

    let resolveInit!: (value: boolean) => void;
    let rejectInit!: (reason: unknown) => void;
    const pending = new Promise<boolean>((resolve, reject) => {
      resolveInit = resolve;
      rejectInit = reject;
    });
    // Install the pending promise before any await, so concurrent init() calls
    // observe it and wait on the same loop.
    (this as any).hasInitialized = pending;
    // Concurrent callers attach their own .then/.catch via `await`, but the
    // root throw below propagates to the current call. Attach a no-op catch
    // here so a rejected `pending` without other awaiters is not flagged as
    // an unhandled rejection.
    pending.catch(e => {
      this.logger?.warn?.('Initialization failed', e);
    });

    try {
      // Initialize domains sequentially to avoid concurrent DDL errors in Spanner.
      const domainOrder: Array<keyof StorageDomains> = [
        'memory',
        'workflows',
        'scores',
        'backgroundTasks',
        'agents',
        'mcpClients',
        'mcpServers',
        'skills',
        'blobs',
        'promptBlocks',
        'scorerDefinitions',
        'schedules',
        'observability',
        'channels',
        'datasets',
        'experiments',
        'workspaces',
        'favorites',
        'workflowDefinitions',
      ];
      for (const key of domainOrder) {
        const store = this.stores?.[key];
        if (store) {
          await store.init();
        }
      }
      resolveInit(true);
    } catch (error) {
      // Allow a future init() call to retry the loop after a failure.
      (this as any).hasInitialized = null;
      const wrapped =
        error instanceof MastraError
          ? error
          : new MastraError(
              {
                id: createStorageErrorId('SPANNER', 'INIT', 'FAILED'),
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.THIRD_PARTY,
              },
              error,
            );
      rejectInit(wrapped);
      throw wrapped;
    }
  }

  /**
   * Closes the Spanner client and database handle if this store owns them.
   * Pre-configured databases are left alone for the caller to manage.
   */
  async close() {
    if (!this.ownsClient) return;
    try {
      await this.database.close();
      if (this.spanner) {
        // Spanner node lib wraps most functions (including this one with PromisifyAll), but currently there's a bug that causes awaiting on it to hand indefinitely.
        // Current workaround is to just call it without await https://github.com/googleapis/google-cloud-node/issues/8106
        void this.spanner.close();
      }
    } catch (error) {
      throw error;
    }
  }
}
