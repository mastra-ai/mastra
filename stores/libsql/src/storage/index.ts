import { createClient } from '@libsql/client';
import type { Client } from '@libsql/client';
import type { RetentionConfig, StorageDomains } from '@mastra/core/storage';
import { MastraCompositeStore } from '@mastra/core/storage';

import type { LibSQLLocalJournalMode } from '../types';
import { DEFAULT_CONNECTION_TIMEOUT_MS } from './db';
import { AgentsLibSQL } from './domains/agents';
import { BackgroundTasksLibSQL } from './domains/background-tasks';
import { BlobsLibSQL } from './domains/blobs';
import { ChannelsLibSQL } from './domains/channels';
import { DatasetsLibSQL } from './domains/datasets';
import { ExperimentsLibSQL } from './domains/experiments';
import { FavoritesLibSQL } from './domains/favorites';
import { HarnessLibSQL } from './domains/harness';
import { MCPClientsLibSQL } from './domains/mcp-clients';
import { MCPServersLibSQL } from './domains/mcp-servers';
import { MemoryLibSQL } from './domains/memory';
import { NotificationsLibSQL } from './domains/notifications';
import { ObservabilityLibSQL } from './domains/observability';
import { PromptBlocksLibSQL } from './domains/prompt-blocks';
import { SchedulesLibSQL } from './domains/schedules';
import { ScorerDefinitionsLibSQL } from './domains/scorer-definitions';
import { ScoresLibSQL } from './domains/scores';
import { SkillsLibSQL } from './domains/skills';
import { ThreadStateLibSQL } from './domains/thread-state';
import { ToolProviderConnectionsLibSQL } from './domains/tool-provider-connections';
import { WorkflowsLibSQL } from './domains/workflows';
import { WorkspacesLibSQL } from './domains/workspaces';

// Export domain classes for direct use with MastraStorage composition
export {
  AgentsLibSQL,
  BackgroundTasksLibSQL,
  BlobsLibSQL,
  ChannelsLibSQL,
  DatasetsLibSQL,
  ExperimentsLibSQL,
  HarnessLibSQL,
  MCPClientsLibSQL,
  MCPServersLibSQL,
  MemoryLibSQL,
  NotificationsLibSQL,
  ObservabilityLibSQL,
  PromptBlocksLibSQL,
  SchedulesLibSQL,
  ScorerDefinitionsLibSQL,
  ScoresLibSQL,
  SkillsLibSQL,
  FavoritesLibSQL,
  ThreadStateLibSQL,
  ToolProviderConnectionsLibSQL,
  WorkflowsLibSQL,
  WorkspacesLibSQL,
};
export type { LibSQLLocalJournalMode } from '../types';
export type { LibSQLDomainConfig } from './db';
export { LibSQLFactoryStorage, type LibSQLFactoryStorageConfig } from './factory-storage';

export type LibSQLStorageDomain = keyof StorageDomains;

const DEFAULT_LOCAL_CACHE_SIZE = -16000;
const DEFAULT_LOCAL_MMAP_SIZE = 134217728;

export type LibSQLLocalPragmaOptions = {
  /**
   * SQLite PRAGMA cache_size value for local databases.
   * Negative values are interpreted as kibibytes by SQLite.
   * @default -16000
   */
  cacheSize?: number;
  /**
   * SQLite PRAGMA mmap_size value in bytes for local databases.
   * @default 134217728
   */
  mmapSize?: number;
};

/**
 * Base configuration options shared across LibSQL configurations
 */
export type LibSQLBaseConfig = {
  id: string;
  /**
   * Maximum number of retries for write operations if an SQLITE_BUSY error occurs.
   * @default 5
   */
  maxRetries?: number;
  /**
   * Initial backoff time in milliseconds for retrying write operations on SQLITE_BUSY.
   * The backoff time will double with each retry (exponential backoff).
   * @default 100
   */
  initialBackoffMs?: number;
  /**
   * SQLite `busy_timeout` (in milliseconds) applied to the underlying connection
   * for local (`file:`/`:memory:`) databases. When a write hits a locked
   * database, the driver waits up to this long for the lock to clear instead of
   * failing immediately with `SQLITE_BUSY`. Requires `@libsql/client` >= 0.17.4,
   * which also ensures the timeout survives connections created after
   * `transaction()` (see libsql-client-ts#288/#345).
   *
   * Has no effect for remote (`libsql://`/`https://`) clients or when an existing
   * `client` is supplied.
   * @default 5000
   */
  connectionTimeoutMs?: number;
  /**
   * SQLite journal mode for local file databases. Remote and in-memory databases
   * keep their existing behavior.
   * @default 'wal'
   */
  journalMode?: LibSQLLocalJournalMode;
  /**
   * Overrides local SQLite PRAGMA values used for startup/read performance.
   * Only applies to local file and in-memory databases.
   */
  localPragmas?: LibSQLLocalPragmaOptions;
  /**
   * When true, automatic initialization (table creation/migrations) is disabled.
   * This is useful for CI/CD pipelines where you want to:
   * 1. Run migrations explicitly during deployment (not at runtime)
   * 2. Use different credentials for schema changes vs runtime operations
   *
   * When disableInit is true:
   * - The storage will not automatically create/alter tables on first use
   * - You must call `storage.init()` explicitly in your CI/CD scripts
   *
   * @example
   * // In CI/CD script:
   * const storage = new LibSQLStore({ ...config, disableInit: false });
   * await storage.init(); // Explicitly run migrations
   *
   * // In runtime application:
   * const storage = new LibSQLStore({ ...config, disableInit: true });
   * // No auto-init, tables must already exist
   */
  disableInit?: boolean;
  /**
   * Opt-in, table-granular, age-based retention policies. Declare per-table
   * `maxAge` per domain (e.g. `{ memory: { messages: { maxAge: '30d' } } }`);
   * unset tables are kept forever. Wire `storage.prune()` to your own cron to
   * apply them. See {@link RetentionConfig}.
   */
  retention?: RetentionConfig;
};

export type LibSQLConfig =
  | (LibSQLBaseConfig & {
      url: string;
      authToken?: string;
    })
  | (LibSQLBaseConfig & {
      client: Client;
    });

/**
 * LibSQL/Turso storage adapter for Mastra.
 *
 * Access domain-specific storage via `getStore()`:
 *
 * @example
 * ```typescript
 * const storage = new LibSQLStore({ id: 'my-store', url: 'file:./dev.db' });
 *
 * // Access memory domain
 * const memory = await storage.getStore('memory');
 * await memory?.saveThread({ thread });
 *
 * // Access workflows domain
 * const workflows = await storage.getStore('workflows');
 * await workflows?.persistWorkflowSnapshot({ workflowName, runId, snapshot });
 * ```
 */
export class LibSQLStore extends MastraCompositeStore {
  private client: Client;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;
  private readonly connectionTimeoutMs: number;
  private readonly pragmasReady: Promise<void>;
  private readonly isLocalDb: boolean;
  private readonly isLocalFileDb: boolean;
  private readonly journalMode: LibSQLLocalJournalMode;
  private readonly localPragmas: Required<LibSQLLocalPragmaOptions>;
  private closePromise?: Promise<void>;

  stores: StorageDomains;

  constructor(config: LibSQLConfig) {
    if (!config.id || typeof config.id !== 'string' || config.id.trim() === '') {
      throw new Error('LibSQLStore: id must be provided and cannot be empty.');
    }
    if (config.journalMode !== undefined && config.journalMode !== 'wal' && config.journalMode !== 'delete') {
      throw new Error("LibSQLStore: journalMode must be either 'wal' or 'delete'.");
    }
    super({ id: config.id, name: `LibSQLStore`, disableInit: config.disableInit, retention: config.retention });

    this.maxRetries = config.maxRetries ?? 5;
    this.initialBackoffMs = config.initialBackoffMs ?? 100;
    this.connectionTimeoutMs = config.connectionTimeoutMs ?? DEFAULT_CONNECTION_TIMEOUT_MS;
    this.journalMode = config.journalMode ?? 'wal';
    this.localPragmas = {
      cacheSize: config.localPragmas?.cacheSize ?? DEFAULT_LOCAL_CACHE_SIZE,
      mmapSize: config.localPragmas?.mmapSize ?? DEFAULT_LOCAL_MMAP_SIZE,
    };

    if ('url' in config) {
      // need to re-init every time for in memory dbs or the tables might not exist
      if (config.url.includes(':memory:')) {
        this.shouldCacheInit = false;
      }

      this.isLocalDb = config.url.startsWith('file:') || config.url.includes(':memory:');
      this.isLocalFileDb = config.url.startsWith('file:') && !config.url.includes(':memory:');

      this.client = createClient({
        url: config.url,
        ...(config.authToken ? { authToken: config.authToken } : {}),
        // `busy_timeout` only applies to local sqlite3 connections; remote
        // contention is handled server-side. See libsql-client-ts#288/#345.
        ...(this.isLocalDb ? { timeout: this.connectionTimeoutMs } : {}),
      });
      this.pragmasReady = this.isLocalDb ? this.applyLocalPragmas() : Promise.resolve();
    } else {
      this.client = config.client;
      this.isLocalDb = false;
      this.isLocalFileDb = false;
      this.pragmasReady = Promise.resolve();
    }

    const domainConfig = {
      client: this.client,
      maxRetries: this.maxRetries,
      initialBackoffMs: this.initialBackoffMs,
    };

    const scores = new ScoresLibSQL(domainConfig);
    const workflows = new WorkflowsLibSQL(domainConfig);
    const memory = new MemoryLibSQL(domainConfig);
    const observability = new ObservabilityLibSQL(domainConfig);
    const agents = new AgentsLibSQL(domainConfig);
    const channels = new ChannelsLibSQL(domainConfig);
    const datasets = new DatasetsLibSQL(domainConfig);
    const experiments = new ExperimentsLibSQL(domainConfig);
    const promptBlocks = new PromptBlocksLibSQL(domainConfig);
    const scorerDefinitions = new ScorerDefinitionsLibSQL(domainConfig);
    const mcpClients = new MCPClientsLibSQL(domainConfig);
    const mcpServers = new MCPServersLibSQL(domainConfig);
    const workspaces = new WorkspacesLibSQL(domainConfig);
    const skills = new SkillsLibSQL(domainConfig);
    const favorites = new FavoritesLibSQL(domainConfig);
    const blobs = new BlobsLibSQL(domainConfig);
    const backgroundTasks = new BackgroundTasksLibSQL(domainConfig);
    const schedules = new SchedulesLibSQL(domainConfig);
    const harness = new HarnessLibSQL(domainConfig);
    const toolProviderConnections = new ToolProviderConnectionsLibSQL(domainConfig);
    const notifications = new NotificationsLibSQL(domainConfig);
    const threadState = new ThreadStateLibSQL(domainConfig);

    this.stores = {
      scores,
      workflows,
      memory,
      observability,
      agents,
      channels,
      datasets,
      experiments,
      promptBlocks,
      scorerDefinitions,
      mcpClients,
      mcpServers,
      workspaces,
      skills,
      favorites,
      blobs,
      backgroundTasks,
      schedules,
      harness,
      toolProviderConnections,
      notifications,
      threadState,
    };
  }

  private async applyLocalPragmas(): Promise<void> {
    const journalMode = this.journalMode.toUpperCase();
    try {
      const result = await this.client.execute(`PRAGMA journal_mode=${journalMode};`);

      if (this.isLocalFileDb && this.journalMode === 'delete') {
        const appliedMode = Object.values(result.rows[0] ?? {})[0];
        if (typeof appliedMode !== 'string' || appliedMode.toLowerCase() !== 'delete') {
          throw new Error(
            `LibSQLStore: Failed to set PRAGMA journal_mode=DELETE; SQLite reported ${String(appliedMode)}.`,
          );
        }
      }
      this.logger.debug(`LibSQLStore: PRAGMA journal_mode=${journalMode} set.`);
    } catch (err) {
      if (this.isLocalFileDb && this.journalMode === 'delete') {
        throw err;
      }
      this.logger.warn(`LibSQLStore: Failed to set PRAGMA journal_mode=${journalMode}.`, err);
    }

    const pragmas = [
      // Keep in sync with the connection-level `timeout` passed to createClient
      // so a custom connectionTimeoutMs isn't clobbered back to a hardcoded value.
      [`busy_timeout=${this.connectionTimeoutMs}`, `PRAGMA busy_timeout=${this.connectionTimeoutMs};`],
      ['synchronous=NORMAL', 'PRAGMA synchronous=NORMAL;'],
      ['temp_store=MEMORY', 'PRAGMA temp_store=MEMORY;'],
      [`cache_size=${this.localPragmas.cacheSize}`, `PRAGMA cache_size=${this.localPragmas.cacheSize};`],
      [`mmap_size=${this.localPragmas.mmapSize}`, `PRAGMA mmap_size=${this.localPragmas.mmapSize};`],
    ] as const;

    for (const [label, sql] of pragmas) {
      try {
        await this.client.execute(sql);
        this.logger.debug(`LibSQLStore: PRAGMA ${label} set.`);
      } catch (err) {
        this.logger.warn(`LibSQLStore: Failed to set PRAGMA ${label}.`, err);
      }
    }
  }

  private getStoresToInit() {
    return Object.values(this.stores).filter(Boolean);
  }

  private async initDomainsSequentially(): Promise<boolean> {
    for (const store of this.getStoresToInit()) {
      await store.init();
    }
    return true;
  }

  private async initDomainsInParallel(): Promise<boolean> {
    await Promise.all(this.getStoresToInit().map(store => store.init()));
    return true;
  }

  override async init(): Promise<void> {
    await this.pragmasReady;

    if (!this.isLocalDb) {
      if (this.shouldCacheInit) {
        if (this.hasInitialized) {
          await this.hasInitialized;
          return;
        }

        this.hasInitialized = this.initDomainsInParallel();
        await this.hasInitialized;
        return;
      }

      await this.initDomainsInParallel();
      return;
    }

    // Cache and coalesce local file DB initialization to avoid duplicate DDL.
    if (this.shouldCacheInit) {
      if (this.hasInitialized) {
        await this.hasInitialized;
        return;
      }

      this.hasInitialized = this.initDomainsSequentially();
      await this.hasInitialized;
      return;
    }

    await this.initDomainsSequentially();
  }

  /**
   * Closes the underlying libsql client, releasing all OS file handles.
   *
   * Local file databases configured for WAL are checkpointed and switched to
   * journal_mode=DELETE so that Windows releases the -wal and -shm sidecar
   * files promptly. Databases already configured for DELETE skip that work.
   *
   * Remote (Turso) databases skip the WAL pragmas and just close the client.
   *
   * Safe to call more than once; subsequent calls are no-ops.
   */
  close(): Promise<void> {
    if (!this.closePromise) {
      this.closePromise = this.closeClient();
    }
    return this.closePromise;
  }

  private async closeClient(): Promise<void> {
    if (this.client.closed) {
      return;
    }

    let readinessError: unknown;
    try {
      await this.pragmasReady;
    } catch (err) {
      readinessError = err;
    }

    // A store built from an injected client may still point at a local file even
    // though its journal mode is unknown, so preserve the WAL cleanup behavior.
    const needsWalCleanup =
      (this.isLocalFileDb && this.journalMode === 'wal') || (!this.isLocalDb && this.client.protocol === 'file');

    if (!readinessError && needsWalCleanup) {
      try {
        await this.client.execute('PRAGMA wal_checkpoint(TRUNCATE);');
        await this.client.execute('PRAGMA journal_mode=DELETE;');
      } catch (err) {
        this.logger.warn('LibSQLStore: Failed to checkpoint WAL before close.', err);
      }
    }

    this.client.close();

    if (readinessError) {
      throw readinessError;
    }
  }
}

export { LibSQLStore as DefaultStorage };
