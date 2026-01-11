import { MastraStorage } from '@mastra/core/storage';
import type { StorageDomains } from '@mastra/core/storage';
import { createClient } from 'redis';

import { StoreMemoryRedis } from './domains/memory';
import { ScoresRedis } from './domains/scores';
import { WorkflowsRedis } from './domains/workflows';
import type { RedisClient, RedisConfig } from './types';
import { isClientConfig, isConnectionStringConfig } from './utils';

/**
 * Redis storage adapter for Mastra.
 *
 * Provides storage functionality for direct Redis connections using the official redis package.
 *
 * Access domain-specific storage via `getStore()`:
 *
 * @example
 * ```typescript
 * // Using connection string
 * const storage = new RedisStore({
 *   id: 'my-store',
 *   connectionString: 'redis://localhost:6379',
 * });
 *
 * // Using host/port
 * const storage = new RedisStore({
 *   id: 'my-store',
 *   host: 'localhost',
 *   port: 6379,
 *   password: 'secret',
 * });
 *
 * // Access memory domain
 * const memory = await storage.getStore('memory');
 * await memory?.saveThread({ thread });
 *
 * // Access workflows domain
 * const workflows = await storage.getStore('workflows');
 * await workflows?.persistWorkflowSnapshot({ workflowName, runId, snapshot });
 * ```
 *
 * @example
 * ```typescript
 * // Using a pre-configured client for advanced features
 * import { createClient } from 'redis';
 *
 * const client = createClient({
 *   url: 'redis://localhost:6379',
 *   socket: {
 *     reconnectStrategy: (retries) => Math.min(retries * 50, 2000),
 *   },
 * });
 * await client.connect();
 *
 * const storage = new RedisStore({
 *   id: 'my-store',
 *   client,
 * });
 * ```
 */
export class RedisStore extends MastraStorage {
  private client: RedisClient;
  private shouldManageConnection: boolean;
  public stores: StorageDomains;

  constructor(config: RedisConfig) {
    super({ id: config.id, name: 'Redis', disableInit: config.disableInit });

    const { client, shouldManageConnection } = this.createClient(config);
    this.client = client;
    this.shouldManageConnection = shouldManageConnection;

    this.stores = {
      scores: new ScoresRedis({ client: this.client }),
      workflows: new WorkflowsRedis({ client: this.client }),
      memory: new StoreMemoryRedis({ client: this.client }),
    };
  }

  public override async init(): Promise<void> {
    if (this.shouldManageConnection && !this.client.isOpen) {
      await this.client.connect();
    }
    await super.init();
  }

  public getClient(): RedisClient {
    return this.client;
  }

  public async close(): Promise<void> {
    if (this.shouldManageConnection && this.client.isOpen) {
      await this.client.quit();
    }
  }

  private createClient(config: RedisConfig): { client: RedisClient; shouldManageConnection: boolean } {
    if (isClientConfig(config)) {
      return { client: config.client, shouldManageConnection: false };
    }

    if (isConnectionStringConfig(config)) {
      if (!config.connectionString?.trim()) {
        throw new Error('RedisStore: connectionString is required and cannot be empty.');
      }
      return {
        client: createClient({ url: config.connectionString }) as RedisClient,
        shouldManageConnection: true,
      };
    }

    if (!config.host?.trim()) {
      throw new Error('RedisStore: host is required and cannot be empty.');
    }

    const url = config.password
      ? `redis://:${config.password}@${config.host}:${config.port || 6379}/${config.db || 0}`
      : `redis://${config.host}:${config.port || 6379}/${config.db || 0}`;

    return {
      client: createClient({ url }) as RedisClient,
      shouldManageConnection: true,
    };
  }
}
