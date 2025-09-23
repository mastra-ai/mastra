import { drizzle } from 'drizzle-orm/libsql';
import { createClient, Client } from '@libsql/client';
import { SQLiteDialect } from './sqlite';
import { DialectConfig } from './types';

export class TursoDialect extends SQLiteDialect {
  private client?: Client;

  constructor(config: DialectConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    const { connection } = this.config;

    this.client = createClient({
      url: connection.url || connection.connectionString || '',
      authToken: connection.authToken,
    });

    this.db = drizzle(this.client) as any;
  }

  async disconnect(): Promise<void> {
    // LibSQL client doesn't have explicit disconnect
    this.client = undefined;
    this.db = undefined;
  }

  isConnected(): boolean {
    return !!this.client;
  }

  protected getProtocol(): string {
    return 'libsql';
  }
}
