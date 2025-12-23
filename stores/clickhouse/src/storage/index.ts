import type { ClickHouseClient } from '@clickhouse/client';
import { createClient } from '@clickhouse/client';
import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import { createStorageErrorId, MastraStorage } from '@mastra/core/storage';
import type { TABLE_NAMES, StorageDomains, TABLE_SCHEMAS, StorageSupports } from '@mastra/core/storage';
import { MemoryStorageClickhouse } from './domains/memory';
import { ObservabilityStorageClickhouse } from './domains/observability';
import { ScoresStorageClickhouse } from './domains/scores';
import { WorkflowsStorageClickhouse } from './domains/workflows';

type IntervalUnit =
  | 'NANOSECOND'
  | 'MICROSECOND'
  | 'MILLISECOND'
  | 'SECOND'
  | 'MINUTE'
  | 'HOUR'
  | 'DAY'
  | 'WEEK'
  | 'MONTH'
  | 'QUARTER'
  | 'YEAR';

type ClickhouseTtlConfig = {
  [TableKey in TABLE_NAMES]?: {
    row?: { interval: number; unit: IntervalUnit; ttlKey?: string };
    columns?: Partial<{
      [ColumnKey in keyof (typeof TABLE_SCHEMAS)[TableKey]]: {
        interval: number;
        unit: IntervalUnit;
        ttlKey?: string;
      };
    }>;
  };
};

/**
 * ClickHouse configuration type.
 *
 * Accepts either:
 * - A pre-configured ClickHouse client: `{ id, client, ttl? }`
 * - URL/credentials config: `{ id, url, username, password, ttl? }`
 */
export type ClickhouseConfig = {
  id: string;
  ttl?: ClickhouseTtlConfig;
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
   * const storage = new ClickhouseStore({ ...config, disableInit: false });
   * await storage.init(); // Explicitly run migrations
   *
   * // In runtime application:
   * const storage = new ClickhouseStore({ ...config, disableInit: true });
   * // No auto-init, tables must already exist
   */
  disableInit?: boolean;
} & (
  | {
      /**
       * Pre-configured ClickHouse client.
       * Use this when you need to configure the client before initialization,
       * e.g., to set custom connection settings or interceptors.
       *
       * @example
       * ```typescript
       * import { createClient } from '@clickhouse/client';
       *
       * const client = createClient({
       *   url: 'http://localhost:8123',
       *   username: 'default',
       *   password: '',
       *   // Custom settings
       *   request_timeout: 60000,
       * });
       *
       * const store = new ClickhouseStore({ id: 'my-store', client });
       * ```
       */
      client: ClickHouseClient;
    }
  | {
      url: string;
      username: string;
      password: string;
    }
);

/**
 * Type guard for pre-configured client config
 */
const isClientConfig = (config: ClickhouseConfig): config is ClickhouseConfig & { client: ClickHouseClient } => {
  return 'client' in config;
};

/**
 * ClickHouse storage adapter for Mastra.
 *
 * Access domain-specific storage via `getStore()`:
 *
 * @example
 * ```typescript
 * const storage = new ClickhouseStore({ id: 'my-store', url: '...', username: '...', password: '...' });
 *
 * // Access memory domain
 * const memory = await storage.getStore('memory');
 * await memory?.saveThread({ thread });
 *
 * // Access workflows domain
 * const workflows = await storage.getStore('workflows');
 * await workflows?.persistWorkflowSnapshot({ workflowName, runId, snapshot });
 *
 * // Access observability domain
 * const observability = await storage.getStore('observability');
 * await observability?.createSpan(span);
 * ```
 */
export class ClickhouseStore extends MastraStorage {
  protected db: ClickHouseClient;
  protected ttl: ClickhouseConfig['ttl'] = {};

  stores: StorageDomains;

  constructor(config: ClickhouseConfig) {
    super({ id: config.id, name: 'ClickhouseStore', disableInit: config.disableInit });

    // Handle pre-configured client vs creating new connection
    if (isClientConfig(config)) {
      // User provided a pre-configured ClickHouse client
      this.db = config.client;
    } else {
      // Validate URL before creating client
      if (!config.url || typeof config.url !== 'string' || config.url.trim() === '') {
        throw new Error('ClickhouseStore: url is required and cannot be empty.');
      }
      // Validate username and password are strings (can be empty for default user)
      if (typeof config.username !== 'string') {
        throw new Error('ClickhouseStore: username must be a string.');
      }
      if (typeof config.password !== 'string') {
        throw new Error('ClickhouseStore: password must be a string.');
      }
      // Create client from credentials
      this.db = createClient({
        url: config.url,
        username: config.username,
        password: config.password,
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso', // This is crucial
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });
    }

    this.ttl = config.ttl;

    const domainConfig = { client: this.db, ttl: this.ttl };
    const workflows = new WorkflowsStorageClickhouse(domainConfig);
    const scores = new ScoresStorageClickhouse(domainConfig);
    const memory = new MemoryStorageClickhouse(domainConfig);
    const observability = new ObservabilityStorageClickhouse(domainConfig);

    this.stores = {
      workflows,
      scores,
      memory,
      observability,
    };
  }

  get supports(): StorageSupports {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
    };
  }

  async optimizeTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      await this.db.command({
        query: `OPTIMIZE TABLE ${tableName} FINAL`,
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'OPTIMIZE_TABLE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  async materializeTtl({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      await this.db.command({
        query: `ALTER TABLE ${tableName} MATERIALIZE TTL;`,
      });
    } catch (error: any) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'MATERIALIZE_TTL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { tableName },
        },
        error,
      );
    }
  }

  /**
   * Closes the ClickHouse client connection.
   *
   * This will close the ClickHouse client, including pre-configured clients.
   * The store assumes ownership of all clients and manages their lifecycle.
   */
  async close(): Promise<void> {
    try {
      await this.db.close();
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'CLOSE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
