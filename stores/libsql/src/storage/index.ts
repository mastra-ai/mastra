import { createClient } from '@libsql/client';
import type { Client } from '@libsql/client';
import { MastraStorage } from '@mastra/core/storage';
import type { StorageDomains } from '@mastra/core/storage';
import { EvalsStorageLibSQL } from './domains/evals';
import { MemoryStorageLibSQL } from './domains/memory';
import { ObservabilityStorageLibSQL } from './domains/observability';
import { WorkflowsStorageLibSQL } from './domains/workflows';

export type LibSQLConfig =
  | {
    id: string;
    url: string;
    authToken?: string;
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
  }
  | {
    id: string;
    client: Client;
    maxRetries?: number;
    initialBackoffMs?: number;
  };


export { EvalsStorageLibSQL as EvalsStorage } from './domains/evals';
export { MemoryStorageLibSQL as MemoryStorage } from './domains/memory';
export { ObservabilityStorageLibSQL as ObservabilityStorage } from './domains/observability';
export { WorkflowsStorageLibSQL as WorkflowsStorage } from './domains/workflows';

export class LibSQLStore extends MastraStorage {
  private client: Client;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;

  stores: StorageDomains;

  constructor(config: LibSQLConfig) {
    if (!config.id || typeof config.id !== 'string' || config.id.trim() === '') {
      throw new Error('LibSQLStore: id must be provided and cannot be empty.');
    }
    super({ id: config.id, name: `LibSQLStore` });

    this.maxRetries = config.maxRetries ?? 5;
    this.initialBackoffMs = config.initialBackoffMs ?? 100;

    if ('url' in config) {
      // need to re-init every time for in memory dbs or the tables might not exist
      if (config.url.endsWith(':memory:')) {
        this.shouldCacheInit = false;
      }

      this.client = createClient({
        url: config.url,
        ...(config.authToken ? { authToken: config.authToken } : {}),
      });

      // Set PRAGMAs for better concurrency, especially for file-based databases
      if (config.url.startsWith('file:') || config.url.includes(':memory:')) {
        this.client
          .execute('PRAGMA journal_mode=WAL;')
          .then(() => this.logger.debug('LibSQLStore: PRAGMA journal_mode=WAL set.'))
          .catch(err => this.logger.warn('LibSQLStore: Failed to set PRAGMA journal_mode=WAL.', err));
        this.client
          .execute('PRAGMA busy_timeout = 5000;') // 5 seconds
          .then(() => this.logger.debug('LibSQLStore: PRAGMA busy_timeout=5000 set.'))
          .catch(err => this.logger.warn('LibSQLStore: Failed to set PRAGMA busy_timeout.', err));
      }
    } else {
      this.client = config.client;
    }

    const evals = new EvalsStorageLibSQL({
      client: this.client,
      maxRetries: this.maxRetries,
      initialBackoffMs: this.initialBackoffMs,
    });

    const workflows = new WorkflowsStorageLibSQL({
      client: this.client,
      maxRetries: this.maxRetries,
      initialBackoffMs: this.initialBackoffMs,
    });

    const memory = new MemoryStorageLibSQL({
      client: this.client,
      maxRetries: this.maxRetries,
      initialBackoffMs: this.initialBackoffMs,
    });

    const observability = new ObservabilityStorageLibSQL({
      client: this.client,
      maxRetries: this.maxRetries,
      initialBackoffMs: this.initialBackoffMs,
    });

    this.stores = {
      evals,
      workflows,
      memory,
      observability,
    };
  }

  public get supports() {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
      hasColumn: true,
      createTable: true,
      deleteMessages: true,
      observabilityInstance: true,
      listScoresBySpan: true,
    };
  }
}

export { LibSQLStore as DefaultStorage };
