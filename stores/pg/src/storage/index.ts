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
import { BlobsPG } from './domains/blobs';
import { DatasetsPG } from './domains/datasets';
import { ExperimentsPG } from './domains/experiments';
import { MCPClientsPG } from './domains/mcp-clients';
import { MCPServersPG } from './domains/mcp-servers';
import { MemoryPG } from './domains/memory';
import { ObservabilityPG } from './domains/observability';
import { PromptBlocksPG } from './domains/prompt-blocks';
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
  BlobsPG,
  DatasetsPG,
  ExperimentsPG,
  MCPClientsPG,
  MCPServersPG,
  MemoryPG,
  ObservabilityPG,
  PromptBlocksPG,
  ScorerDefinitionsPG,
  ScoresPG,
  SkillsPG,
  WorkflowsPG,
  WorkspacesPG,
};
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
        blobs: new BlobsPG(domainConfig),
        datasets: new DatasetsPG(domainConfig),
        experiments: new ExperimentsPG(domainConfig),
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
