import type { ConnectionOptions } from 'node:tls';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId, MastraCompositeStore } from '@mastra/core/storage';
import type { StorageDomains } from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';
import { Pool } from 'pg';
import {
  validateConfig,
  isCloudSqlConfig,
  isConnectionStringConfig,
  isHostConfig,
  isPoolConfig,
} from '../shared/config';
import type { PostgresStoreConfig } from '../shared/config';
import { buildConnectionStringPoolConfig } from '../shared/pool-config';
import { PinnedClientAdapter, PoolAdapter, RoutingDbClient } from './client';
import type { DbClient, PoolClient } from './client';
import type { PgDomainClientConfig } from './db';
import { getSchemaName } from './db';
import { AgentsPG } from './domains/agents';
import { BackgroundTasksPG } from './domains/background-tasks';
import { BlobsPG } from './domains/blobs';
import { ChannelsPG } from './domains/channels';
import { DatasetsPG } from './domains/datasets';
import { ExperimentsPG } from './domains/experiments';
import { FavoritesPG } from './domains/favorites';
import { MCPClientsPG } from './domains/mcp-clients';
import { MCPServersPG } from './domains/mcp-servers';
import { MemoryPG } from './domains/memory';
import { NotificationsPG } from './domains/notifications';
import { ObservabilityPG } from './domains/observability';
import { ObservabilityStoragePostgresVNext } from './domains/observability/v-next';
import type { VNextPostgresObservabilityConfig } from './domains/observability/v-next';
import { PromptBlocksPG } from './domains/prompt-blocks';
import { SchedulesPG } from './domains/schedules';
import { ScorerDefinitionsPG } from './domains/scorer-definitions';
import { ScoresPG } from './domains/scores';
import { SkillsPG } from './domains/skills';
import { ToolProviderConnectionsPG } from './domains/tool-provider-connections';
import { WorkflowDefinitionsPG } from './domains/workflow-definitions';
import { WorkflowsPG } from './domains/workflows';
import { WorkspacesPG } from './domains/workspaces';

/** Default maximum number of connections in the pool */
const DEFAULT_MAX_CONNECTIONS = 20;
/** Default idle timeout in milliseconds */
const DEFAULT_IDLE_TIMEOUT_MS = 30000;

type ConnectionStringPoolConfig = {
  connectionString: string;
  ssl?: ConnectionOptions | boolean;
  max?: number;
  idleTimeoutMillis?: number;
};

type HostPoolConfig = {
  host: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  ssl?: ConnectionOptions | boolean;
  max?: number;
  idleTimeoutMillis?: number;
};

function createConnectionStringPool(config: ConnectionStringPoolConfig): Pool {
  return new Pool(
    buildConnectionStringPoolConfig(config, {
      max: DEFAULT_MAX_CONNECTIONS,
      idleTimeoutMillis: DEFAULT_IDLE_TIMEOUT_MS,
    }),
  );
}

function createHostPool(config: HostPoolConfig): Pool {
  return new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl,
    max: config.max ?? DEFAULT_MAX_CONNECTIONS,
    idleTimeoutMillis: config.idleTimeoutMillis ?? DEFAULT_IDLE_TIMEOUT_MS,
  });
}

/**
 * All storage domain classes, in order. Each provides a static getExportDDL method
 * that returns the complete DDL (tables, constraints, indexes, triggers) for that domain.
 */
const ALL_DOMAINS = [
  MemoryPG,
  NotificationsPG,
  ObservabilityPG,
  ScoresPG,
  ScorerDefinitionsPG,
  PromptBlocksPG,
  AgentsPG,
  MCPClientsPG,
  MCPServersPG,
  WorkspacesPG,
  SkillsPG,
  BlobsPG,
  ToolProviderConnectionsPG,
  WorkflowsPG,
  WorkflowDefinitionsPG,
  DatasetsPG,
  ExperimentsPG,
  BackgroundTasksPG,
  FavoritesPG,
  ChannelsPG,
  SchedulesPG,
] as const;

/**
 * Exports the Mastra database schema as SQL DDL statements, including tables, indexes, and triggers.
 * Does not require a database connection. Each domain class provides its own DDL contribution
 * via a static getExportDDL method, ensuring a single source of truth.
 */
export function exportSchemas(schemaName?: string): string {
  const statements: string[] = [];

  if (schemaName) {
    const quotedSchemaName = getSchemaName(schemaName);
    statements.push(`CREATE SCHEMA IF NOT EXISTS ${quotedSchemaName};`);
    statements.push('');
  }

  for (const Domain of ALL_DOMAINS) {
    statements.push(...Domain.getExportDDL(schemaName));
  }

  return statements.join('\n');
}
// Export domain classes for direct use with MastraStorage composition
export {
  AgentsPG,
  BackgroundTasksPG,
  BlobsPG,
  ChannelsPG,
  DatasetsPG,
  ExperimentsPG,
  MCPClientsPG,
  MCPServersPG,
  MemoryPG,
  NotificationsPG,
  ObservabilityPG,
  ObservabilityStoragePostgresVNext,
  PromptBlocksPG,
  ScorerDefinitionsPG,
  ScoresPG,
  SchedulesPG,
  SkillsPG,
  FavoritesPG,
  ToolProviderConnectionsPG,
  WorkflowsPG,
  WorkflowDefinitionsPG,
  WorkspacesPG,
};
export type { VNextPostgresObservabilityConfig };
export { PoolAdapter } from './client';
export type { DbClient, TxClient, QueryValues, Pool, PoolClient, QueryResult } from './client';
export type { PgDomainConfig, PgDomainClientConfig, PgDomainPoolConfig, PgDomainRestConfig } from './db';
export { PgFactoryStorage, hashAdvisoryLockKey, type PgFactoryStorageConfig } from './factory-storage';

/**
 * PostgreSQL storage adapter for Mastra.
 *
 * @example
 * ```typescript
 * // Option 1: Connection string
 * const store = new PostgresStore({
 *   id: 'my-store',
 *   connectionString: 'postgresql://...',
 * });
 *
 * // Option 2: Pre-configured pool
 * const pool = new Pool({ connectionString: 'postgresql://...' });
 * const store = new PostgresStore({ id: 'my-store', pool });
 *
 * // Access domain storage
 * const memory = await store.getStore('memory');
 * await memory?.saveThread({ thread });
 *
 * // Execute custom queries
 * const rows = await store.db.any('SELECT * FROM my_table');
 * ```
 */
export class PostgresStore extends MastraCompositeStore {
  #pool: Pool;
  // Narrowed to RoutingDbClient so init()'s pin/unpin path is type-checked.
  // The public `db` getter still exposes it as DbClient.
  #db: RoutingDbClient;
  #ownsPool: boolean;
  #poolClosed: boolean = false;
  private schema: string;
  private isInitialized: boolean = false;
  // Caches the in-flight init() so concurrent callers share one initialization
  // instead of each acquiring + pinning a client. See init() / issue #18282.
  #initPromise: Promise<void> | null = null;

  stores: StorageDomains;

  constructor(config: PostgresStoreConfig) {
    try {
      validateConfig('PostgresStore', config);
      super({ id: config.id, name: 'PostgresStore', disableInit: config.disableInit, retention: config.retention });
      // Validate schema name to prevent SQL injection
      this.schema = parseSqlIdentifier(config.schemaName || 'public', 'schema name');

      if (isPoolConfig(config)) {
        this.#pool = config.pool;
        this.#ownsPool = false;
      } else {
        this.#pool = this.createPool(config);
        this.#ownsPool = true;
      }

      // Wrap the pool adapter in a routing client so init() can temporarily
      // pin all DDL traffic to a single PoolClient. See PostgresStore.init().
      this.#db = new RoutingDbClient(new PoolAdapter(this.#pool));

      const domainConfig: PgDomainClientConfig = {
        client: this.#db,
        schemaName: this.schema,
        skipDefaultIndexes: config.skipDefaultIndexes,
        indexes: config.indexes,
      };

      this.stores = {
        scores: new ScoresPG(domainConfig),
        workflows: new WorkflowsPG(domainConfig),
        workflowDefinitions: new WorkflowDefinitionsPG(domainConfig),
        memory: new MemoryPG(domainConfig),
        notifications: new NotificationsPG(domainConfig),
        observability: new ObservabilityPG(domainConfig),
        agents: new AgentsPG(domainConfig),
        promptBlocks: new PromptBlocksPG(domainConfig),
        scorerDefinitions: new ScorerDefinitionsPG(domainConfig),
        mcpClients: new MCPClientsPG(domainConfig),
        mcpServers: new MCPServersPG(domainConfig),
        workspaces: new WorkspacesPG(domainConfig),
        skills: new SkillsPG(domainConfig),
        favorites: new FavoritesPG(domainConfig),
        toolProviderConnections: new ToolProviderConnectionsPG(domainConfig),
        blobs: new BlobsPG(domainConfig),
        datasets: new DatasetsPG(domainConfig),
        experiments: new ExperimentsPG(domainConfig),
        backgroundTasks: new BackgroundTasksPG(domainConfig),
        channels: new ChannelsPG(domainConfig),
        schedules: new SchedulesPG(domainConfig),
      };
    } catch (e) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'INITIALIZATION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        e,
      );
    }
  }

  private createPool(config: PostgresStoreConfig): Pool {
    const pool = this.#buildPool(config);

    // pg emits 'error' on the pool when an idle client's connection drops
    // (backend restart, network partition, cloud proxies reaping idle
    // sockets). Without a listener Node escalates the event to an
    // uncaughtException and crashes the process. Only pools this store
    // creates get the listener — a user-provided pool keeps the user's own
    // listeners, mirroring close().
    pool.on('error', err => {
      this.logger?.warn?.(
        'PostgresStore: idle pool client error (pool discards the client and reconnects on next checkout)',
        {
          err: err instanceof Error ? err.message : err,
        },
      );
    });

    return pool;
  }

  #buildPool(config: PostgresStoreConfig): Pool {
    if (isConnectionStringConfig(config)) {
      return createConnectionStringPool(config);
    }

    if (isHostConfig(config)) {
      return createHostPool(config);
    }

    if (isCloudSqlConfig(config)) {
      return new Pool(config as any);
    }

    throw new Error('PostgresStore: invalid config');
  }

  async init(): Promise<void> {
    // Skip the pinned-init path entirely when initialization is disabled. The
    // caller manages schema/migrations externally, so init() must not connect,
    // pin, or run DDL. This also keeps the call-site contract in @mastra/core
    // (which calls storage.init() directly and assumes it is "a no-op when
    // disabled") true for Postgres. See issue #18282.
    if (this.disableInit || process.env.MASTRA_DISABLE_STORAGE_INIT === 'true') {
      return;
    }

    if (this.isInitialized) {
      return;
    }

    // Coalesce concurrent init() calls into a single in-flight promise. A
    // PostgresStore shared across request-scoped Mastra instances can have
    // init() invoked from several callers at once; without this guard both
    // race past the `isInitialized` check and pin the RoutingDbClient twice,
    // throwing "RoutingDbClient already has a pinned client" (issue #18282).
    this.#initPromise ??= this.#runPinnedInit();
    await this.#initPromise;
  }

  async #runPinnedInit(): Promise<void> {
    // Acquire a single backend connection and pin every domain's DDL to it
    // for the duration of init(). This avoids:
    //   - per-statement pool.connect() RTT on remote/managed Postgres
    //   - transaction-pooler budget exhaustion under concurrent DDL fan-out
    //   - inter-statement lock contention across domains (issue #17679)
    // Runtime queries continue to use the pool normally once init completes.
    // connect() runs inside the try so a failing connection (e.g. a network
    // blip during boot) is caught below and resets #initPromise, keeping
    // init() retryable instead of permanently rejecting.
    let pinnedClient: PoolClient | undefined;

    try {
      pinnedClient = await this.#pool.connect();
      const pinned = new PinnedClientAdapter(this.#pool, pinnedClient);
      this.#db.pin(pinned);
      await super.init();
      // Only mark initialized after schema creation actually finishes so a
      // racing second init() caller can't return early and issue runtime
      // queries against tables that aren't yet created.
      this.isInitialized = true;
    } catch (error) {
      // Drop the cached promise so a transient failure (e.g. a network blip
      // during boot) can be retried by a later init() call instead of
      // permanently rejecting. Mirrors storageWithInit's cacheInit behavior.
      this.#initPromise = null;
      // Rethrow MastraError directly to preserve structured error IDs (e.g., MIGRATION_REQUIRED::DUPLICATE_SPANS)
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'INIT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    } finally {
      // Only unpin/release when connect() actually handed us a client; on a
      // failed connect() pinnedClient is undefined and pin() never ran.
      if (pinnedClient) {
        this.#db.unpin();
        pinnedClient.release();
      }
    }
  }

  /**
   * Database client for executing queries.
   *
   * @example
   * ```typescript
   * const rows = await store.db.any('SELECT * FROM users WHERE active = $1', [true]);
   * const user = await store.db.one('SELECT * FROM users WHERE id = $1', [userId]);
   * ```
   */
  public get db(): DbClient {
    return this.#db;
  }

  /**
   * The underlying pg.Pool for direct database access or ORM integration.
   */
  public get pool(): Pool {
    return this.#pool;
  }

  /**
   * Closes the connection pool if it was created by this store.
   * If a pool was passed in via config, it will not be closed.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  async close(): Promise<void> {
    if (this.#ownsPool && !this.#poolClosed) {
      this.#poolClosed = true;
      await this.#pool.end();
    }
  }
}

/**
 * Required connection config for the v-next observability domain. Accepts
 * the same connection shapes as `PostgresStoreConfig` (pool /
 * connectionString / host+port / Cloud SQL connector) plus the
 * vNext-specific options.
 *
 * Required by design — `PostgresStoreVNext` will not implicitly share the
 * primary connection. Callers who want to share must pass identical
 * connection details here, and they'll receive a runtime warning every time
 * the store is constructed (and again on every init() over the same logger).
 */
export type PostgresStoreVNextObservabilityConfig = (
  | { pool: Pool }
  | {
      connectionString: string;
      ssl?: ConnectionOptions | boolean;
      max?: number;
      idleTimeoutMillis?: number;
    }
  | {
      host: string;
      port?: number;
      database: string;
      user: string;
      password: string;
      ssl?: ConnectionOptions | boolean;
      max?: number;
      idleTimeoutMillis?: number;
    }
) & {
  schemaName?: string;
  partitioning?: VNextPostgresObservabilityConfig['partitioning'];
  discovery?: VNextPostgresObservabilityConfig['discovery'];
};

/**
 * Best-effort detection of two configs pointing at the same Postgres
 * instance. Catches the common collision cases without over-reaching:
 * - identical pool references
 * - identical connectionStrings
 * - identical (host, port, database) tuples
 *
 * Mixed shapes (e.g. connectionString vs host config) return false; we don't
 * try to parse URLs since false positives are worse than the occasional miss.
 */
function isSameConnectionTarget(
  primary: PostgresStoreConfig,
  observability: PostgresStoreVNextObservabilityConfig,
): boolean {
  if ('pool' in primary && 'pool' in observability) {
    return primary.pool === observability.pool;
  }
  if ('connectionString' in primary && 'connectionString' in observability) {
    return primary.connectionString === observability.connectionString;
  }
  if ('host' in primary && 'host' in observability) {
    return (
      primary.host === observability.host &&
      (primary.port ?? 5432) === ((observability as { port?: number }).port ?? 5432) &&
      primary.database === observability.database
    );
  }
  return false;
}

const COLLISION_WARNING =
  'PostgresStoreVNext: the `observability` connection appears to point at the same Postgres instance ' +
  'as the primary store. For production workloads, point observability at a dedicated Postgres ' +
  'instance to avoid degrading your application database performance.';

/**
 * Postgres storage adapter that uses the v-next observability domain.
 *
 * Composes a primary `PostgresStore` (memory / workflows / scores / agents /
 * etc.) with an `ObservabilityStoragePostgresVNext` for logs, metrics,
 * scores, feedback, and traces.
 *
 * The `observability` connection is **required**: every caller has to make
 * an explicit decision about where observability data goes. For production,
 * point it at a dedicated Postgres instance. For local development you can
 * pass the same connection details as the primary store — you'll get a
 * runtime warning every time the store is constructed.
 *
 * IMPORTANT: this adapter is intended for **low-volume production**
 * workloads only. For high-volume agent workloads, use the ClickHouse
 * adapter — Postgres (with or without TimescaleDB) cannot keep up past
 * roughly 1,500 calls/sec sustained on a single primary.
 *
 * @example
 * ```typescript
 * import { Mastra } from '@mastra/core';
 * import { PostgresStoreVNext } from '@mastra/pg';
 *
 * export const mastra = new Mastra({
 *   storage: new PostgresStoreVNext({
 *     id: 'app',
 *     connectionString: process.env.DATABASE_URL!,
 *     observability: {
 *       connectionString: process.env.OBSERVABILITY_DATABASE_URL!,
 *     },
 *   }),
 * });
 * ```
 */
export class PostgresStoreVNext extends PostgresStore {
  #observabilityPool?: Pool;
  #ownsObservabilityPool = false;
  #observabilityPoolClosed = false;

  constructor(
    config: PostgresStoreConfig & {
      /**
       * Connection config for the vNext observability domain. Required.
       * Pass a dedicated connection in production; reusing the primary
       * connection logs a runtime warning every construction.
       */
      observability: PostgresStoreVNextObservabilityConfig;
    },
  ) {
    super(config);
    this.name = 'PostgresStoreVNext';

    const obsConfig = config.observability;
    if (isSameConnectionTarget(config, obsConfig)) {
      console.warn(COLLISION_WARNING);
    }
    const built = this.#createObservabilityClient(obsConfig);
    const observabilityClient = built.client;
    this.#observabilityPool = built.pool;
    this.#ownsObservabilityPool = built.owned;

    // Same crash-prevention as the primary pool in createPool(): without an
    // 'error' listener, an idle client dropped by the backend escalates to an
    // uncaughtException. Only for pools this store created.
    if (built.owned) {
      built.pool.on('error', err => {
        this.logger?.warn?.(
          'PostgresStoreVNext: idle observability pool client error (pool discards the client and reconnects on next checkout)',
          {
            err: err instanceof Error ? err.message : err,
          },
        );
      });
    }

    // NOTE: `skipDefaultIndexes` / `indexes` from the primary config are
    // intentionally NOT forwarded. The vNext observability domain manages
    // its own index set (see `allIndexDDL` in `ddl.ts`) — pretending to
    // honor primary-store index config here would mislead callers. If the
    // need for custom observability indexes shows up, plumb them through
    // `observability.indexes` as a dedicated field.
    const observability = new ObservabilityStoragePostgresVNext({
      client: observabilityClient,
      schemaName: obsConfig.schemaName ?? config.schemaName,
      partitioning: obsConfig.partitioning,
      discovery: obsConfig.discovery,
    });

    this.stores = {
      ...this.stores,
      observability,
    };
  }

  #createObservabilityClient(cfg: PostgresStoreVNextObservabilityConfig): {
    client: DbClient;
    pool: Pool;
    owned: boolean;
  } {
    if ('pool' in cfg && cfg.pool) {
      return { client: new PoolAdapter(cfg.pool), pool: cfg.pool, owned: false };
    }
    if ('connectionString' in cfg && typeof cfg.connectionString === 'string') {
      const pool = createConnectionStringPool(cfg);
      return { client: new PoolAdapter(pool), pool, owned: true };
    }
    if ('host' in cfg) {
      const pool = createHostPool(cfg);
      return { client: new PoolAdapter(pool), pool, owned: true };
    }
    // Cloud SQL connector / pg ClientConfig style — pass through to pg.Pool.
    const pool = new Pool(cfg as never);
    return { client: new PoolAdapter(pool), pool, owned: true };
  }

  /**
   * Closes both the primary pool (when owned) and the observability pool
   * (when this store created it). Safe to call multiple times.
   */
  override async close(): Promise<void> {
    await super.close();
    if (this.#ownsObservabilityPool && this.#observabilityPool && !this.#observabilityPoolClosed) {
      this.#observabilityPoolClosed = true;
      await this.#observabilityPool.end();
    }
  }
}
