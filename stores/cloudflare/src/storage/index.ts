import type { KVNamespace } from '@cloudflare/workers-types';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  MastraStorage,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_SCORERS,
} from '@mastra/core/storage';
import type { TABLE_NAMES, StorageDomains } from '@mastra/core/storage';
import Cloudflare from 'cloudflare';
import { EvalsStorageCloudflare } from './domains/evals';
import { MemoryStorageCloudflare } from './domains/memory';
import { WorkflowsStorageCloudflare } from './domains/workflows';
import { isWorkersConfig } from './types';
import type { CloudflareStoreConfig, CloudflareWorkersConfig, CloudflareRestConfig } from './types';

export { EvalsStorageCloudflare } from './domains/evals';
export { MemoryStorageCloudflare } from './domains/memory';
export { WorkflowsStorageCloudflare } from './domains/workflows';

export class CloudflareStore extends MastraStorage {
  stores: StorageDomains;
  private client?: Cloudflare;
  private accountId?: string;
  private namespacePrefix: string;
  private bindings?: Record<TABLE_NAMES, KVNamespace>;

  private validateWorkersConfig(config: CloudflareStoreConfig): asserts config is CloudflareWorkersConfig {
    if (!isWorkersConfig(config)) {
      throw new Error('Invalid Workers API configuration');
    }
    if (!config.bindings) {
      throw new Error('KV bindings are required when using Workers Binding API');
    }

    // Validate all required table bindings exist
    const requiredTables = [TABLE_THREADS, TABLE_MESSAGES, TABLE_WORKFLOW_SNAPSHOT, TABLE_SCORERS] as const;

    for (const table of requiredTables) {
      if (!(table in config.bindings)) {
        throw new Error(`Missing KV binding for table: ${table}`);
      }
    }
  }

  private validateRestConfig(config: CloudflareStoreConfig): asserts config is CloudflareRestConfig {
    if (isWorkersConfig(config)) {
      throw new Error('Invalid REST API configuration');
    }
    if (!config.accountId?.trim()) {
      throw new Error('accountId is required for REST API');
    }
    if (!config.apiToken?.trim()) {
      throw new Error('apiToken is required for REST API');
    }
  }

  public get supports() {
    const supports = super.supports;
    supports.listScoresBySpan = true;
    supports.resourceWorkingMemory = true;
    supports.selectByIncludeResourceScope = true;
    return supports;
  }

  constructor(config: CloudflareStoreConfig) {
    super({ id: config.id, name: 'Cloudflare' });

    try {
      if (isWorkersConfig(config)) {
        this.validateWorkersConfig(config);
        this.bindings = config.bindings;
        this.namespacePrefix = config.keyPrefix?.trim() || '';
        this.logger.info('Using Cloudflare KV Workers Binding API');
      } else {
        this.validateRestConfig(config);
        this.accountId = config.accountId.trim();
        this.namespacePrefix = config.namespacePrefix?.trim() || '';
        this.client = new Cloudflare({
          apiToken: config.apiToken.trim(),
        });
        this.logger.info('Using Cloudflare KV REST API');
      }

      const workflows = new WorkflowsStorageCloudflare({
        namespacePrefix: this.namespacePrefix,
        bindings: this.bindings,
        client: this.client,
        accountId: this.accountId,
      });

      const memory = new MemoryStorageCloudflare({
        namespacePrefix: this.namespacePrefix,
        bindings: this.bindings,
        client: this.client,
        accountId: this.accountId,
      });

      const scores = new EvalsStorageCloudflare({
        namespacePrefix: this.namespacePrefix,
        bindings: this.bindings,
        client: this.client,
        accountId: this.accountId,
      });

      this.stores = {
        workflows,
        memory,
        evals: scores,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_INIT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
