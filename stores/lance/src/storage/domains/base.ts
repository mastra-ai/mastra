import { connect } from '@lancedb/lancedb';
import type { Connection, ConnectionOptions } from '@lancedb/lancedb';
import { StoreOperationsLance } from './operations';

export type LanceConfig = {
  id: string;
  uri: string;
  options?: ConnectionOptions;
};

export type LanceDomainConfig = { client: Connection; config?: never } | { client?: never; config: LanceConfig };

export class LanceDomainBase {
  protected client: Connection;
  protected operations: StoreOperationsLance;
  private ownedClient: boolean;

  private constructor(client: Connection, ownedClient: boolean) {
    this.client = client;
    this.operations = new StoreOperationsLance({ client: this.client });
    this.ownedClient = ownedClient;
  }

  /**
   * Static factory method to create a LanceDomainBase instance
   * Required because LanceDB connection is async
   */
  static async create(opts: LanceDomainConfig): Promise<LanceDomainBase> {
    if ('client' in opts && opts.client) {
      // Shared mode: use provided client
      return new LanceDomainBase(opts.client, false);
    } else if ('config' in opts && opts.config) {
      // Standalone mode: create our own client
      const config = opts.config;
      const client = await connect(config.uri, config.options);
      return new LanceDomainBase(client, true);
    } else {
      throw new Error('LanceDomainBase: Invalid configuration. Provide either { client } or { config }.');
    }
  }

  async close(): Promise<void> {
    if (this.ownedClient) {
      await this.client.close();
    }
  }

  protected get isStandalone(): boolean {
    return this.ownedClient;
  }

  getClient(): Connection {
    return this.client;
  }

  getOperations(): StoreOperationsLance {
    return this.operations;
  }
}
