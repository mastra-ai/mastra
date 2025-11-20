import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { MastraStorage } from '@mastra/core/storage';
import type { StorageDomains } from '@mastra/core/storage';
import pgPromise from 'pg-promise';
import { validateConfig, isCloudSqlConfig, isConnectionStringConfig, isHostConfig } from '../shared/config';
import type { PostgresStoreConfig } from '../shared/config';
import { EvalsStoragePG } from './domains/evals';
import { MemoryStoragePG } from './domains/memory';
import { ObservabilityPG } from './domains/observability';
import { WorkflowsStoragePG } from './domains/workflows';

export { EvalsStoragePG as EvalsStorage } from './domains/evals';
export { MemoryStoragePG as MemoryStorage } from './domains/memory';
export { ObservabilityPG as ObservabilityStorage } from './domains/observability';
export { WorkflowsStoragePG as WorkflowsStorage } from './domains/workflows';

export type { CreateIndexOptions, IndexInfo } from '@mastra/core/storage';
export class PostgresStore extends MastraStorage {
  #db?: pgPromise.IDatabase<{}>;
  #pgp?: pgPromise.IMain;
  #config: PostgresStoreConfig;
  private schema: string;
  private isConnected: boolean = false;

  stores: StorageDomains;

  constructor(config: PostgresStoreConfig) {
    // Validation: connectionString or host/database/user/password must not be empty
    try {
      validateConfig('PostgresStore', config);
      super({ id: config.id, name: 'PostgresStore' });
      this.schema = config.schemaName || 'public';
      if (isConnectionStringConfig(config)) {
        this.#config = {
          id: config.id,
          connectionString: config.connectionString,
          max: config.max,
          idleTimeoutMillis: config.idleTimeoutMillis,
          ssl: config.ssl,
        };
      } else if (isCloudSqlConfig(config)) {
        // Cloud SQL connector config
        this.#config = {
          ...config,
          id: config.id,
          max: config.max,
          idleTimeoutMillis: config.idleTimeoutMillis,
        };
      } else if (isHostConfig(config)) {
        this.#config = {
          id: config.id,
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.user,
          password: config.password,
          ssl: config.ssl,
          max: config.max,
          idleTimeoutMillis: config.idleTimeoutMillis,
        };
      } else {
        // This should never happen due to validation above, but included for completeness
        throw new Error(
          'PostgresStore: invalid config. Provide either {connectionString}, {host,port,database,user,password}, or a pg ClientConfig (e.g., Cloud SQL connector with `stream`).',
        );
      }

      this.isConnected = true;
      this.#pgp = pgPromise();
      this.#db = this.#pgp(this.#config as any);

      const scores = new EvalsStoragePG({ client: this.#db, schema: this.schema });
      const workflows = new WorkflowsStoragePG({ client: this.#db, schema: this.schema });
      const memory = new MemoryStoragePG({ client: this.#db, schema: this.schema });
      const observability = new ObservabilityPG({ client: this.#db, schema: this.schema });

      this.stores = {
        evals: scores,
        workflows,
        memory,
        observability,
      };
    } catch (e) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_INITIALIZATION_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        e,
      );
    }
  }

  public get db() {
    if (!this.#db) {
      throw new Error(`PostgresStore: Store is not initialized, please call "init()" first.`);
    }
    return this.#db;
  }

  public get pgp() {
    if (!this.#pgp) {
      throw new Error(`PostgresStore: Store is not initialized, please call "init()" first.`);
    }
    return this.#pgp;
  }

  public get supports() {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
      hasColumn: true,
      createTable: true,
      deleteMessages: true,
      observabilityInstance: true,
      indexManagement: true,
      listScoresBySpan: true,
    };
  }

  async close(): Promise<void> {
    this.pgp.end();
  }
}
