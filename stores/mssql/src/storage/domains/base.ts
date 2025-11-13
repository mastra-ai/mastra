import sql from 'mssql';
import type { MSSQLConfig } from '../index';
import { StoreOperationsMSSQL } from './operations';

export type MSSQLDomainConfig =
  | { pool: sql.ConnectionPool; schema: string; config?: never }
  | { pool?: never; schema?: never; config: MSSQLConfig };

export class MSSQLDomainBase {
  protected pool: sql.ConnectionPool;
  protected operations: StoreOperationsMSSQL;
  protected schema: string;
  private ownedPool: boolean;

  constructor(opts: MSSQLDomainConfig) {
    if ('pool' in opts && opts.pool) {
      // Shared mode: use provided pool
      this.pool = opts.pool;
      this.schema = opts.schema;
      this.operations = new StoreOperationsMSSQL({ pool: this.pool, schemaName: this.schema });
      this.ownedPool = false;
    } else if ('config' in opts && opts.config) {
      // Standalone mode: create our own pool
      const config = opts.config;
      this.schema = config.schemaName || 'dbo';

      if ('connectionString' in config) {
        this.pool = new sql.ConnectionPool(config.connectionString);
      } else {
        this.pool = new sql.ConnectionPool({
          server: config.server,
          database: config.database,
          user: config.user,
          password: config.password,
          port: config.port,
          options: config.options || { encrypt: true, trustServerCertificate: true },
        });
      }

      this.operations = new StoreOperationsMSSQL({ pool: this.pool, schemaName: this.schema });
      this.ownedPool = true;
    } else {
      throw new Error('MSSQLDomainBase: Invalid configuration. Provide either { pool, schema } or { config }.');
    }
  }

  async close(): Promise<void> {
    if (this.ownedPool) {
      await this.pool.close();
    }
  }

  protected get isStandalone(): boolean {
    return this.ownedPool;
  }

  getClient(): sql.ConnectionPool {
    return this.pool;
  }

  getOperations(): StoreOperationsMSSQL {
    return this.operations;
  }

  getSchema(): string {
    return this.schema;
  }
}
