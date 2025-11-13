import type { ClickHouseClient } from '@clickhouse/client';
import { createClient } from '@clickhouse/client';
import type { ClickhouseConfig as MainClickhouseConfig } from '../index';
import { StoreOperationsClickhouse } from './operations';

export type ClickhouseDomainConfig =
  | { client: ClickHouseClient; ttl?: MainClickhouseConfig['ttl']; config?: never }
  | { client?: never; ttl?: never; config: MainClickhouseConfig };

export class ClickhouseDomainBase {
  protected client: ClickHouseClient;
  protected operations: StoreOperationsClickhouse;
  private ownedClient: boolean;

  constructor(opts: ClickhouseDomainConfig) {
    if ('client' in opts && opts.client) {
      // Shared mode: use provided client, create operations
      this.client = opts.client;
      this.operations = new StoreOperationsClickhouse({
        client: this.client,
        ttl: opts.ttl,
      });
      this.ownedClient = false;
    } else if ('config' in opts && opts.config) {
      // Standalone mode: create our own client and operations
      const config = opts.config;

      this.client = createClient({
        url: config.url,
        username: config.username,
        password: config.password,
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
          output_format_json_quote_64bit_integers: 0,
        },
      });

      this.operations = new StoreOperationsClickhouse({
        client: this.client,
        ttl: config.ttl,
      });

      this.ownedClient = true;
    } else {
      throw new Error('ClickhouseDomainBase: Invalid configuration. Provide either { client, ttl? } or { config }.');
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
}
