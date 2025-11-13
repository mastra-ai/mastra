import type { D1Database } from '@cloudflare/workers-types';
import Cloudflare from 'cloudflare';
import type { D1StoreConfig, D1Client } from '../index';
import { StoreOperationsD1 } from './operations';

export type D1DomainConfig =
  | {
      client?: D1Client;
      binding?: D1Database;
      tablePrefix?: string;
      config?: never;
    }
  | { client?: never; binding?: never; tablePrefix?: never; config: D1StoreConfig };

export class D1DomainBase {
  protected operations: StoreOperationsD1;
  private ownedOperations: boolean;

  constructor(opts: D1DomainConfig) {
    if ('client' in opts || 'binding' in opts || 'tablePrefix' in opts) {
      // Shared mode: use provided parameters to create operations
      this.operations = new StoreOperationsD1({
        client: opts.client,
        binding: opts.binding,
        tablePrefix: opts.tablePrefix,
      });
      this.ownedOperations = false;
    } else if ('config' in opts && opts.config) {
      // Standalone mode: create our own operations from config
      const config = opts.config;
      let client: D1Client | undefined;
      let binding: D1Database | undefined;

      if ('binding' in config) {
        // Workers API
        binding = config.binding;
      } else if ('client' in config) {
        // D1Client
        client = config.client;
      } else {
        // REST API
        const cfClient = new Cloudflare({
          apiToken: config.apiToken,
        });
        client = {
          query: ({ sql, params }) => {
            return cfClient.d1.database.query(config.databaseId, {
              account_id: config.accountId,
              sql,
              params,
            });
          },
        };
      }

      this.operations = new StoreOperationsD1({
        client,
        binding,
        tablePrefix: config.tablePrefix,
      });
      this.ownedOperations = true;
    } else {
      throw new Error(
        'D1DomainBase: Invalid configuration. Provide either { client, binding, tablePrefix } or { config }.',
      );
    }
  }

  protected get isStandalone(): boolean {
    return this.ownedOperations;
  }
}
