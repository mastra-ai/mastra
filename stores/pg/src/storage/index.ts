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
import { PoolAdapter } from './client';
import type { DbClient } from './client';
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
import { ObservabilityPG } from './domains/observability';
import { ObservabilityStoragePostgresVNext } from './domains/observability/v-next';
import type { VNextPostgresObservabilityConfig } from './domains/observability/v-next';
import { PromptBlocksPG } from './domains/prompt-blocks';
import { SchedulesPG } from './domains/schedules';
import { ScorerDefinitionsPG } from './domains/scorer-definitions';
import { ScoresPG } from './domains/scores';
import { SkillsPG } from './domains/skills';
import { WorkflowsPG } from './domains/workflows';
import { WorkspacesPG } from './domains/workspaces';

/** Default maximum number of connections in the pool */
const DEFAULT_MAX_CONNECTIONS = 20;
/** Default idle timeout in milliseconds */
const DEFAULT_IDLE_TIMEOUT_MS = 30000;

/**
 * All storage domain classes, in order. Each provides a static getExportDDL method
 * that returns the complete DDL (tables, constraints, indexes, triggers) for that domain.
 */
const ALL_DOMAINS = [
  MemoryPG,
  ObservabilityPG,
  ScoresPG,
  ScorerDefinitionsPG,
  PromptBlocksPG,
  AgentsPG,
  WorkflowsPG,
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
  ObservabilityPG,
  ObservabilityStoragePostgresVNext,
  PromptBlocksPG,
  ScorerDefinitionsPG,
  ScoresPG,
  SchedulesPG,
  SkillsPG,
  FavoritesPG,
  WorkflowsPG,
  WorkspacesPG,
};
export type { VNextPostgresObservabilityConfig };
export { PoolAdapter } from './client';
export type { DbClient, TxClient, QueryValues, Pool, PoolClient, QueryResult } from './client';
export type { PgDomainConfig, PgDomainClientConfig, PgDomainPoolConfig, PgDomainRestConfig } from './db';

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
  #db: DbClient;
  #ownsPool: boolean;
  private schema: string;
  private isInitialized: boolean = false;

  stores: StorageDomains;

  constructor(config: PostgresStoreConfig) {
    try {
      validateConfig('PostgresStore', config);
      super({ id: config.id, name: 'PostgresStore', disableInit: config.disableInit });
      // Validate schema name to prevent SQL injection
      this.schema = parseSqlIdentifier(config.schemaName || 'public', 'schema name');

      if (isPoolConfig(config)) {
        this.#pool = config.pool;
        this.#ownsPool = false;
      } else {
        this.#pool = this.createPool(config);
        this.#ownsPool = true;
      }

      this.#db = new PoolAdapter(this.#pool);

      const domainConfig: PgDomainClientConfig = {
        client: this.#db,
        schemaName: this.schema,
        skipDefaultIndexes: config.skipDefaultIndexes,
        indexes: config.indexes,
      };

      this.stores = {
        scores: new ScoresPG(domainConfig),
        workflows: new WorkflowsPG(domainConfig),
        memory: new MemoryPG(domainConfig),
        observability: new ObservabilityPG(domainConfig),
        agents: new AgentsPG(domainConfig),
        promptBlocks: new PromptBlocksPG(domainConfig),
        scorerDefinitions: new ScorerDefinitionsPG(domainConfig),
        mcpClients: new MCPClientsPG(domainConfig),
        mcpServers: new MCPServersPG(domainConfig),
        workspaces: new WorkspacesPG(domainConfig),
        skills: new SkillsPG(domainConfig),
        favorites: new FavoritesPG(domainConfig),
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
    if (isConnectionStringConfig(config)) {
      return new Pool({
        connectionString: config.connectionString,
        ssl: config.ssl,
        max: config.max ?? DEFAULT_MAX_CONNECTIONS,
        idleTimeoutMillis: config.idleTimeoutMillis ?? DEFAULT_IDLE_TIMEOUT_MS,
      });
    }

    if (isHostConfig(config)) {
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

    if (isCloudSqlConfig(config)) {
      return new Pool(config as any);
    }

    throw new Error('PostgresStore: invalid config');
  }

  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.isInitialized = true;
      await super.init();
    } catch (error) {
      this.isInitialized = false;
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
   */
  async close(): Promise<void> {
    if (this.#ownsPool) {
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
      this.logger.warn(COLLISION_WARNING);
    }
    const built = this.#createObservabilityClient(obsConfig);
    const observabilityClient = built.client;
    this.#observabilityPool = built.pool;
    this.#ownsObservabilityPool = built.owned;

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
      const pool = new Pool({
        connectionString: cfg.connectionString,
        ssl: cfg.ssl,
        max: cfg.max ?? DEFAULT_MAX_CONNECTIONS,
        idleTimeoutMillis: cfg.idleTimeoutMillis ?? DEFAULT_IDLE_TIMEOUT_MS,
      });
      return { client: new PoolAdapter(pool), pool, owned: true };
    }
    if ('host' in cfg) {
      const pool = new Pool({
        host: cfg.host,
        port: cfg.port,
        database: cfg.database,
        user: cfg.user,
        password: cfg.password,
        ssl: cfg.ssl,
        max: cfg.max ?? DEFAULT_MAX_CONNECTIONS,
        idleTimeoutMillis: cfg.idleTimeoutMillis ?? DEFAULT_IDLE_TIMEOUT_MS,
      });
      return { client: new PoolAdapter(pool), pool, owned: true };
    }
    // Cloud SQL connector / pg ClientConfig style — pass through to pg.Pool.
    const pool = new Pool(cfg as never);
    return { client: new PoolAdapter(pool), pool, owned: true };
  }

  /**
   * Closes both the primary pool (when owned) and the observability pool
   * (when this store created it).
   */
  override async close(): Promise<void> {
    await super.close();
    if (this.#ownsObservabilityPool && this.#observabilityPool) {
      await this.#observabilityPool.end();
    }
  }
}
