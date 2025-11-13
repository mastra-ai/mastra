import { createClient } from '@libsql/client';
import type { Client } from '@libsql/client';
import { StoreOperationsLibSQL } from './operations';

export type LibSQLConfig = {
  id: string;
  url: string;
  authToken?: string;
  maxRetries?: number;
  initialBackoffMs?: number;
};

export type LibSQLDomainConfig =
  | { client: Client; config?: never; maxRetries?: number; initialBackoffMs?: number }
  | { client?: never; config: LibSQLConfig };

export class LibSQLDomainBase {
  protected client: Client;
  protected operations: StoreOperationsLibSQL;
  private ownedClient: boolean;

  constructor(opts: LibSQLDomainConfig) {
    if ('client' in opts && opts.client) {
      // Shared mode: use provided client
      this.client = opts.client;
      this.ownedClient = false;
    } else if ('config' in opts && opts.config) {
      // Standalone mode: create our own client
      const config = opts.config;

      this.client = createClient({
        url: config.url,
        ...(config.authToken ? { authToken: config.authToken } : {}),
      });

      // Set PRAGMAs for better concurrency, especially for file-based databases
      if (config.url.startsWith('file:') || config.url.includes(':memory:')) {
        this.client.execute('PRAGMA journal_mode=WAL;').catch(() => {
          // Silently fail - this is a best-effort optimization
        });
        this.client.execute('PRAGMA busy_timeout = 5000;').catch(() => {
          // Silently fail - this is a best-effort optimization
        });
      }

      this.ownedClient = true;
    } else {
      throw new Error('LibSQLDomainBase: Invalid configuration. Provide either { client } or { config }.');
    }

    // Create operations instance
    const maxRetries = 'config' in opts && opts.config ? opts.config.maxRetries : opts.maxRetries;
    const initialBackoffMs = 'config' in opts && opts.config ? opts.config.initialBackoffMs : opts.initialBackoffMs;

    this.operations = new StoreOperationsLibSQL({
      client: this.client,
      maxRetries: maxRetries ?? 5,
      initialBackoffMs: initialBackoffMs ?? 100,
    });
  }

  async close(): Promise<void> {
    if (this.ownedClient) {
      this.client.close();
    }
  }

  protected get isStandalone(): boolean {
    return this.ownedClient;
  }
}
