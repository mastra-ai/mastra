import { createClient } from '@libsql/client';
import type { Client, InArgs, InStatement, ResultSet, Transaction, TransactionMode } from '@libsql/client';
import type { StorageDomains } from '@mastra/core/storage';
import { MastraCompositeStore } from '@mastra/core/storage';

import { AgentsLibSQL } from './domains/agents';
import { BackgroundTasksLibSQL } from './domains/background-tasks';
import { BlobsLibSQL } from './domains/blobs';
import { ChannelsLibSQL } from './domains/channels';
import { DatasetsLibSQL } from './domains/datasets';
import { ExperimentsLibSQL } from './domains/experiments';
import { FavoritesLibSQL } from './domains/favorites';
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
  ToolProviderConnectionsLibSQL,
  WorkflowsLibSQL,
  WorkspacesLibSQL,
};
export type { LibSQLDomainConfig } from './db';

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
};

export type LibSQLConfig =
  | (LibSQLBaseConfig & {
      url: string;
      authToken?: string;
    })
  | (LibSQLBaseConfig & {
      client: Client;
    });

function beginForMode(mode: TransactionMode): string {
  switch (mode) {
    case 'write':
      return 'BEGIN IMMEDIATE';
    case 'read':
      return 'BEGIN';
    case 'deferred':
    default:
      return 'BEGIN DEFERRED';
  }
}

/**
 * Wraps a local (`file:`/`:memory:`) libsql client so that `transaction()` does
 * not orphan the underlying connection.
 *
 * `@libsql/client`'s sqlite3 transport implements `transaction()` by handing its
 * single connection to the returned transaction and setting its own connection
 * reference to `null` (see Sqlite3Client.transaction). The next `execute()`/
 * `batch()` call then lazily opens a brand-new connection. For local databases
 * this is broken in two ways, both tracked upstream:
 *   - `:memory:` — the new connection is a separate, empty in-memory database,
 *     so previously created tables vanish (`SQLITE_ERROR: no such table`).
 *     See libsql-client-ts#229.
 *   - `file:` — the new connection loses the PRAGMAs we applied at startup
 *     (notably `busy_timeout`), so concurrent writers fail instantly with
 *     `SQLITE_BUSY` instead of waiting. See libsql-client-ts#288.
 *
 * To avoid this entirely we route transactions over the same managed connection:
 * `transaction()` issues `BEGIN`/`COMMIT`/`ROLLBACK` as ordinary statements and
 * returns a transaction-shaped object whose operations delegate back to the
 * shared client. The underlying connection is never detached, so tables and
 * PRAGMAs persist across transaction boundaries. Write transactions begin with
 * `BEGIN IMMEDIATE` so the lock is taken up front, the other workaround called
 * out in libsql-client-ts#288.
 *
 * Remote (HRANA/HTTP) clients are not wrapped: their `transaction()` opens a
 * dedicated stream and is correct as-is.
 *
 * @see https://github.com/tursodatabase/libsql-client-ts/issues/288 (file: busy_timeout dropped)
 * @see https://github.com/tursodatabase/libsql-client-ts/issues/229 (:memory: database discarded)
 *
 * @internal Exported for testing.
 */
export function wrapLocalClient(client: Client): Client {
  // The shared connection can only hold one transaction at a time, so concurrent
  // transaction() callers are serialized: each waits for the previous transaction
  // to finish before issuing its own BEGIN. The real driver achieved concurrency
  // by handing each transaction its own connection, but that is exactly the
  // behavior that corrupts local databases (see the doc comment above).
  let txTail: Promise<void> = Promise.resolve();

  const makeTransaction = (release: () => void): Transaction => {
    let finished = false;

    const ensureOpen = () => {
      if (finished) {
        throw new Error('The transaction is closed');
      }
    };

    const finalize = async (sql: 'COMMIT' | 'ROLLBACK'): Promise<void> => {
      try {
        await client.execute(sql);
        finished = true;
      } catch (err) {
        // COMMIT/ROLLBACK failed. The underlying transaction may still be open
        // on the shared connection (e.g. a failed COMMIT that did not end the
        // transaction). Force a ROLLBACK so the connection is clean before the
        // next acquirer issues its BEGIN; otherwise it would fail with "cannot
        // start a transaction within a transaction". Only mark the transaction
        // closed once the connection is actually released from the transaction.
        try {
          await client.execute('ROLLBACK');
        } catch {
          // Best effort: if there was no active transaction to roll back, the
          // connection is already clean.
        }
        finished = true;
        throw err;
      } finally {
        release();
      }
    };

    const transaction: Transaction = {
      async execute(stmtOrSql: InStatement | string, args?: InArgs): Promise<ResultSet> {
        ensureOpen();
        const stmt = typeof stmtOrSql === 'string' ? ({ sql: stmtOrSql, args: args ?? [] } as InStatement) : stmtOrSql;
        return client.execute(stmt);
      },
      async batch(stmts: Array<InStatement | [string, InArgs?]>): Promise<Array<ResultSet>> {
        ensureOpen();
        // Run statements individually on the open connection. Routing through
        // client.batch() would wrap them in its own BEGIN/COMMIT, which is
        // invalid inside an already-open transaction.
        const results: ResultSet[] = [];
        for (const stmt of stmts) {
          const normalized = Array.isArray(stmt) ? ({ sql: stmt[0], args: stmt[1] ?? [] } as InStatement) : stmt;
          results.push(await client.execute(normalized));
        }
        return results;
      },
      async executeMultiple(sql: string): Promise<void> {
        ensureOpen();
        return client.executeMultiple(sql);
      },
      async commit(): Promise<void> {
        ensureOpen();
        await finalize('COMMIT');
      },
      async rollback(): Promise<void> {
        if (finished) {
          return;
        }
        await finalize('ROLLBACK');
      },
      close(): void {
        if (!finished) {
          // Best-effort rollback for an abandoned transaction.
          void this.rollback().catch(() => {});
        }
      },
      get closed(): boolean {
        return finished;
      },
    };

    return transaction;
  };

  // Claim the connection's transaction slot, waiting for any in-flight
  // transaction/batch to finish. Returns a release function.
  const acquire = async (): Promise<() => void> => {
    const previous = txTail;
    let release!: () => void;
    txTail = new Promise<void>(resolve => {
      release = resolve;
    });
    await previous;
    return release;
  };

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'transaction') {
        return async (mode: TransactionMode = 'write'): Promise<Transaction> => {
          const release = await acquire();
          try {
            await target.execute(beginForMode(mode));
          } catch (err) {
            // BEGIN failed; free the slot so we don't deadlock the chain.
            release();
            throw err;
          }
          return makeTransaction(release);
        };
      }

      if (prop === 'batch') {
        // batch() issues its own BEGIN/COMMIT on the shared connection, so it
        // must not overlap with an open transaction. Serialize it with the
        // transaction slot.
        return async (
          stmts: Array<InStatement | [string, InArgs?]>,
          mode?: TransactionMode,
        ): Promise<Array<ResultSet>> => {
          const release = await acquire();
          try {
            return await target.batch(stmts, mode);
          } finally {
            release();
          }
        };
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

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
  private readonly pragmasReady: Promise<void>;
  private readonly isLocalDb: boolean;
  private readonly localPragmas: Required<LibSQLLocalPragmaOptions>;

  stores: StorageDomains;

  constructor(config: LibSQLConfig) {
    if (!config.id || typeof config.id !== 'string' || config.id.trim() === '') {
      throw new Error('LibSQLStore: id must be provided and cannot be empty.');
    }
    super({ id: config.id, name: `LibSQLStore`, disableInit: config.disableInit });

    this.maxRetries = config.maxRetries ?? 5;
    this.initialBackoffMs = config.initialBackoffMs ?? 100;
    this.localPragmas = {
      cacheSize: config.localPragmas?.cacheSize ?? DEFAULT_LOCAL_CACHE_SIZE,
      mmapSize: config.localPragmas?.mmapSize ?? DEFAULT_LOCAL_MMAP_SIZE,
    };

    if ('url' in config) {
      // need to re-init every time for in memory dbs or the tables might not exist
      if (config.url.includes(':memory:')) {
        this.shouldCacheInit = false;
      }

      const rawClient = createClient({
        url: config.url,
        ...(config.authToken ? { authToken: config.authToken } : {}),
      });

      this.isLocalDb = config.url.startsWith('file:') || config.url.includes(':memory:');
      // Local clients route transactions over the shared connection to avoid
      // @libsql/client's connection-detach behavior (see wrapLocalClient).
      this.client = this.isLocalDb ? wrapLocalClient(rawClient) : rawClient;
      this.pragmasReady = this.isLocalDb ? this.applyLocalPragmas() : Promise.resolve();
    } else {
      this.client = config.client;
      this.isLocalDb = false;
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
    const toolProviderConnections = new ToolProviderConnectionsLibSQL(domainConfig);
    const notifications = new NotificationsLibSQL(domainConfig);

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
      toolProviderConnections,
      notifications,
    };
  }

  private async applyLocalPragmas(): Promise<void> {
    const pragmas = [
      ['journal_mode=WAL', 'PRAGMA journal_mode=WAL;'],
      ['busy_timeout=5000', 'PRAGMA busy_timeout=5000;'],
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
   * For local file databases, first runs PRAGMA wal_checkpoint(TRUNCATE) and
   * switches back to journal_mode=DELETE so that Windows releases the -wal
   * and -shm sidecar files promptly. Without this, the handles stay open
   * until process exit, causing EBUSY errors when callers try to fs.rm the
   * storage directory after Mastra.shutdown().
   *
   * Remote (Turso) databases skip the WAL pragmas and just close the client.
   *
   * Safe to call more than once; subsequent calls are no-ops.
   */
  async close(): Promise<void> {
    if (this.client.closed) {
      return;
    }

    // A store built from an injected client may still point at a local file even
    // though `isLocalDb` (derived from the url config) is false, so also trust the
    // client's own protocol to decide whether WAL cleanup is needed.
    const isLocalFileDb = this.isLocalDb || this.client.protocol === 'file';

    if (isLocalFileDb) {
      try {
        await this.client.execute('PRAGMA wal_checkpoint(TRUNCATE);');
        await this.client.execute('PRAGMA journal_mode=DELETE;');
      } catch (err) {
        this.logger.warn('LibSQLStore: Failed to checkpoint WAL before close.', err);
      }
    }

    this.client.close();
  }
}

export { LibSQLStore as DefaultStorage };
