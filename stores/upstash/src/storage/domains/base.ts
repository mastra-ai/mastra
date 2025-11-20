import { Redis } from '@upstash/redis';
import type { UpstashConfig } from '../index';
import { StoreOperationsUpstash } from './operations';

export type UpstashDomainConfig = { client: Redis; config?: never } | { client?: never; config: UpstashConfig };

export class UpstashDomainBase {
  protected client: Redis;
  protected operations: StoreOperationsUpstash;
  private ownedClient: boolean;

  constructor(opts: UpstashDomainConfig) {
    if ('client' in opts && opts.client) {
      // Shared mode: use provided client
      this.client = opts.client;
      this.operations = new StoreOperationsUpstash({ client: this.client });
      this.ownedClient = false;
    } else if ('config' in opts && opts.config) {
      // Standalone mode: create our own client
      const config = opts.config;
      this.client = new Redis({
        url: config.url,
        token: config.token,
      });
      this.operations = new StoreOperationsUpstash({ client: this.client });
      this.ownedClient = true;
    } else {
      throw new Error('UpstashDomainBase: Invalid configuration. Provide either { client } or { config }.');
    }
  }

  protected get isStandalone(): boolean {
    return this.ownedClient;
  }

  getClient(): Redis {
    return this.client;
  }

  getOperations(): StoreOperationsUpstash {
    return this.operations;
  }
}
