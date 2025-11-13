import type { KVNamespace } from '@cloudflare/workers-types';
import type { TABLE_NAMES } from '@mastra/core/storage';
import Cloudflare from 'cloudflare';
import type { CloudflareStoreConfig } from '../types';
import { StoreOperationsCloudflare } from './operations';

export type CloudflareDomainConfig =
  | {
      namespacePrefix: string;
      bindings?: Record<TABLE_NAMES, KVNamespace>;
      client?: Cloudflare;
      accountId?: string;
      config?: never;
    }
  | { namespacePrefix?: never; bindings?: never; client?: never; accountId?: never; config: CloudflareStoreConfig };

export class CloudflareDomainBase {
  protected operations: StoreOperationsCloudflare;
  private ownedOperations: boolean;

  constructor(opts: CloudflareDomainConfig) {
    if ('namespacePrefix' in opts && opts.namespacePrefix !== undefined) {
      // Shared mode: use provided parameters to create operations
      this.operations = new StoreOperationsCloudflare({
        namespacePrefix: opts.namespacePrefix,
        bindings: opts.bindings,
        client: opts.client,
        accountId: opts.accountId,
      });
      this.ownedOperations = false;
    } else if ('config' in opts && opts.config) {
      // Standalone mode: create our own operations from config
      const config = opts.config;
      if ('bindings' in config) {
        // Workers API
        this.operations = new StoreOperationsCloudflare({
          namespacePrefix: config.keyPrefix || '',
          bindings: config.bindings,
        });
      } else {
        // REST API
        this.operations = new StoreOperationsCloudflare({
          namespacePrefix: config.namespacePrefix || '',
          client: new Cloudflare({
            apiToken: config.apiToken,
          }),
          accountId: config.accountId,
        });
      }
      this.ownedOperations = true;
    } else {
      throw new Error(
        'CloudflareDomainBase: Invalid configuration. Provide either { namespacePrefix, ... } or { config }.',
      );
    }
  }

  protected get isStandalone(): boolean {
    return this.ownedOperations;
  }
}
