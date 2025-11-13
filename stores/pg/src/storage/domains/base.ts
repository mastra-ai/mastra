import type { IDatabase } from 'pg-promise';
import pgPromise from 'pg-promise';
import { validateConfig, isCloudSqlConfig, isConnectionStringConfig, isHostConfig } from '../../shared/config';
import type { PostgresStoreConfig } from '../../shared/config';
import { StoreOperationsPG } from './operations';

export type PGDomainConfig =
  | {
      client: IDatabase<{}>;
      schema?: string;
      config?: never;
    }
  | { client?: never; schema?: never; config: PostgresStoreConfig };

export class PGDomainBase {
  client: IDatabase<{}>;
  operations: StoreOperationsPG;
  protected schema: string;
  private ownedClient: boolean;
  pgp?: pgPromise.IMain;

  constructor(opts: PGDomainConfig) {
    if ('client' in opts && opts.client) {
      // Shared mode: use provided client
      this.client = opts.client;
      this.schema = opts.schema || 'public';
      this.operations = new StoreOperationsPG({
        client: this.client,
        schemaName: this.schema,
      });
      this.ownedClient = false;
    } else if ('config' in opts && opts.config) {
      // Standalone mode: create our own client and operations
      const config = opts.config;
      validateConfig('PGDomainBase', config);

      this.schema = config.schemaName || 'public';
      this.pgp = pgPromise();

      if (isConnectionStringConfig(config)) {
        this.client = this.pgp({
          connectionString: config.connectionString,
          max: config.max,
          idleTimeoutMillis: config.idleTimeoutMillis,
          ssl: config.ssl,
        } as any);
      } else if (isCloudSqlConfig(config)) {
        this.client = this.pgp({
          ...config,
          max: config.max,
          idleTimeoutMillis: config.idleTimeoutMillis,
        } as any);
      } else if (isHostConfig(config)) {
        this.client = this.pgp({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.user,
          password: config.password,
          ssl: config.ssl,
          max: config.max,
          idleTimeoutMillis: config.idleTimeoutMillis,
        } as any);
      } else {
        throw new Error(
          'PGDomainBase: invalid config. Provide either {connectionString}, {host,port,database,user,password}, or a pg ClientConfig.',
        );
      }

      this.operations = new StoreOperationsPG({
        client: this.client,
        schemaName: this.schema,
      });
      this.ownedClient = true;
    } else {
      throw new Error('PGDomainBase: Invalid configuration. Provide either { client, schema? } or { config }.');
    }
  }

  async close(): Promise<void> {
    if (this.ownedClient && this.pgp) {
      this.pgp.end();
    }
  }

  protected get isStandalone(): boolean {
    return this.ownedClient;
  }
}
