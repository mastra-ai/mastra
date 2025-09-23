import { DialectConfig, SchemaDefinition, QueryResult, TransactionClient } from './types';

export abstract class BaseDialect {
  protected config: DialectConfig;
  protected db?: any;
  protected schemas: any = {};

  constructor(config: DialectConfig) {
    this.config = config;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract isConnected(): boolean;

  abstract createSchema(definition: SchemaDefinition): any;
  abstract getDb(): any;
  abstract getSchemas(): any;

  abstract query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  abstract transaction<T>(callback: (tx: TransactionClient) => Promise<T>): Promise<T>;

  abstract createTable(tableName: string): Promise<void>;
  abstract dropTable(tableName: string): Promise<void>;
  abstract tableExists(tableName: string): Promise<boolean>;

  abstract insert(table: string, data: Record<string, any>): Promise<any>;
  abstract update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<any>;
  abstract delete(table: string, where: Record<string, any>): Promise<number>;
  abstract select(table: string, where?: Record<string, any>, options?: any): Promise<any[]>;

  getConfig(): DialectConfig {
    return this.config;
  }

  protected buildConnectionUrl(): string | undefined {
    const { connection } = this.config;

    if (connection.connectionString) {
      return connection.connectionString;
    }

    if (connection.url) {
      return connection.url;
    }

    if (connection.host && connection.database) {
      const { host, port, database, user, password } = connection;
      const protocol = this.getProtocol();

      let url = `${protocol}://`;

      if (user) {
        url += user;
        if (password) {
          url += `:${password}`;
        }
        url += '@';
      }

      url += host;
      if (port) {
        url += `:${port}`;
      }
      url += `/${database}`;

      return url;
    }

    return undefined;
  }

  protected abstract getProtocol(): string;
}
