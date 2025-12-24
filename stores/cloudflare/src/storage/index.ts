import type { KVNamespace } from '@cloudflare/workers-types';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  MastraStorage,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_SCORERS,
} from '@mastra/core/storage';
import type { TABLE_NAMES, StorageDomains } from '@mastra/core/storage';
import Cloudflare from 'cloudflare';
import { MemoryStorageCloudflare } from './domains/memory';
import { ScoresStorageCloudflare } from './domains/scores';
import { WorkflowsStorageCloudflare } from './domains/workflows';
import { isWorkersConfig } from './types';

// Export domain classes for direct use with MastraStorage composition
export { MemoryStorageCloudflare, ScoresStorageCloudflare, WorkflowsStorageCloudflare };
export type { CloudflareDomainConfig } from './types';
import type { CloudflareStoreConfig, CloudflareWorkersConfig, CloudflareRestConfig } from './types';

/**
 * Cloudflare KV storage adapter for Mastra.
 *
 * Access domain-specific storage via `getStore()`:
 *
 * @example
 * ```typescript
 * const storage = new CloudflareStore({ id: 'my-store', accountId: '...', apiToken: '...' });
 *
 * // Access memory domain
 * const memory = await storage.getStore('memory');
 * await memory?.saveThread({ thread });
 *
 * // Access workflows domain
 * const workflows = await storage.getStore('workflows');
 * await workflows?.persistWorkflowSnapshot({ workflowName, runId, snapshot });
 * ```
 */
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

  constructor(config: CloudflareStoreConfig) {
    super({ id: config.id, name: 'Cloudflare', disableInit: config.disableInit });

    try {
      let workflows: WorkflowsStorageCloudflare;
      let memory: MemoryStorageCloudflare;
      let scores: ScoresStorageCloudflare;

      if (isWorkersConfig(config)) {
        this.validateWorkersConfig(config);
        this.bindings = config.bindings;
        this.namespacePrefix = config.keyPrefix?.trim() || '';
        this.logger.info('Using Cloudflare KV Workers Binding API');

        const domainConfig = {
          bindings: this.bindings,
          keyPrefix: this.namespacePrefix,
        };
        workflows = new WorkflowsStorageCloudflare(domainConfig);
        memory = new MemoryStorageCloudflare(domainConfig);
        scores = new ScoresStorageCloudflare(domainConfig);
      } else {
        this.validateRestConfig(config);
        this.accountId = config.accountId.trim();
        this.namespacePrefix = config.namespacePrefix?.trim() || '';
        this.client = new Cloudflare({
          apiToken: config.apiToken.trim(),
        });
        this.logger.info('Using Cloudflare KV REST API');

        const domainConfig = {
          client: this.client,
          accountId: this.accountId,
          namespacePrefix: this.namespacePrefix,
        };
        workflows = new WorkflowsStorageCloudflare(domainConfig);
        memory = new MemoryStorageCloudflare(domainConfig);
        scores = new ScoresStorageCloudflare(domainConfig);
      }

      this.stores = {
        workflows,
        memory,
        scores,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE', 'INIT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async close(): Promise<void> {
    // No explicit cleanup needed
  }
}
