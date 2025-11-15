import type { MastraMessageContentV2, MastraDBMessage } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { MastraStorage } from '@mastra/core/storage';

export type MastraDBMessageWithTypedContent = Omit<MastraDBMessage, 'content'> & { content: MastraMessageContentV2 };
import type { StorageDomains } from '@mastra/core/storage';
import sql from 'mssql';
import { EvalsStorageMSSQL } from './domains/evals';
import { MemoryStorageMSSQL } from './domains/memory';
import { ObservabilityStorageMSSQL } from './domains/observability';
import { WorkflowsStorageMSSQL } from './domains/workflows';

export type MSSQLConfigType = {
  id: string;
  schemaName?: string;
} & (
  | {
      server: string;
      port: number;
      database: string;
      user: string;
      password: string;
      options?: sql.IOptions;
    }
  | {
      connectionString: string;
    }
);

export type MSSQLConfig = MSSQLConfigType;

export { EvalsStorageMSSQL } from './domains/evals';
export { MemoryStorageMSSQL } from './domains/memory';
export { ObservabilityStorageMSSQL } from './domains/observability';
export { WorkflowsStorageMSSQL } from './domains/workflows';
export class MSSQLStore extends MastraStorage {
  public pool: sql.ConnectionPool;
  private schema?: string;
  private isConnected: Promise<boolean> | null = null;
  stores: StorageDomains;

  constructor(config: MSSQLConfigType) {
    if (!config.id || typeof config.id !== 'string' || config.id.trim() === '') {
      throw new Error('MSSQLStore: id must be provided and cannot be empty.');
    }
    super({ id: config.id, name: 'MSSQLStore' });

    try {
      if ('connectionString' in config) {
        if (
          !config.connectionString ||
          typeof config.connectionString !== 'string' ||
          config.connectionString.trim() === ''
        ) {
          throw new Error('MSSQLStore: connectionString must be provided and cannot be empty.');
        }
      } else {
        const required = ['server', 'database', 'user', 'password'];
        for (const key of required) {
          if (!(key in config) || typeof (config as any)[key] !== 'string' || (config as any)[key].trim() === '') {
            throw new Error(`MSSQLStore: ${key} must be provided and cannot be empty.`);
          }
        }
      }

      this.schema = config.schemaName || 'dbo';
      this.pool =
        'connectionString' in config
          ? new sql.ConnectionPool(config.connectionString)
          : new sql.ConnectionPool({
              server: config.server,
              database: config.database,
              user: config.user,
              password: config.password,
              port: config.port,
              options: config.options || { encrypt: true, trustServerCertificate: true },
            });

      const evals = new EvalsStorageMSSQL({ pool: this.pool, schema: this.schema });
      const workflows = new WorkflowsStorageMSSQL({ pool: this.pool, schema: this.schema });
      const memory = new MemoryStorageMSSQL({ pool: this.pool, schema: this.schema });
      const observability = new ObservabilityStorageMSSQL({ pool: this.pool, schema: this.schema });

      this.stores = {
        evals,
        workflows,
        memory,
        observability,
      };
    } catch (e) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_INITIALIZATION_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        e,
      );
    }
  }

  async init(): Promise<void> {
    if (this.isConnected === null) {
      this.isConnected = this._performInitializationAndStore();
    }
    try {
      await this.isConnected;
      await super.init();
    } catch (error) {
      this.isConnected = null;
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_INIT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  private async _performInitializationAndStore(): Promise<boolean> {
    try {
      await this.pool.connect();
      return true;
    } catch (err) {
      throw err;
    }
  }

  public get supports(): {
    selectByIncludeResourceScope: boolean;
    resourceWorkingMemory: boolean;
    hasColumn: boolean;
    createTable: boolean;
    deleteMessages: boolean;
    listScoresBySpan: boolean;
    observabilityInstance: boolean;
    indexManagement: boolean;
  } {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
      hasColumn: true,
      createTable: true,
      deleteMessages: true,
      listScoresBySpan: true,
      observabilityInstance: true,
      indexManagement: true,
    };
  }
}
