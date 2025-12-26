import { MastraStorage } from '@mastra/core/storage';
import type { StorageDomains } from '@mastra/core/storage';
import { Redis } from '@upstash/redis';
import { StoreMemoryUpstash } from './domains/memory';
import { ScoresUpstash } from './domains/scores';
import { WorkflowsUpstash } from './domains/workflows';

// Export domain classes for direct use with MastraStorage composition
export { StoreMemoryUpstash, ScoresUpstash, WorkflowsUpstash };
export type { UpstashDomainConfig } from './db';

/**
 * Upstash configuration type.
 *
 * Accepts either:
 * - A pre-configured Redis client: `{ id, client }`
 * - URL/token config: `{ id, url, token }`
 */
export type UpstashConfig = {
  id: string;
  /**
   * When true, automatic initialization (table creation/migrations) is disabled.
   * This is useful for CI/CD pipelines where you want to:
   * 1. Run migrations explicitly during deployment (not at runtime)
   * 2. Use different credentials for schema changes vs runtime operations
   *
   * When disableInit is true:
   * - The storage will not automatically create/alter tables on first use
   * - You must call `storage.init()` explicitly in your CI/CD scripts
   *
   * @example
   * // In CI/CD script:
   * const storage = new UpstashStore({ ...config, disableInit: false });
   * await storage.init(); // Explicitly run migrations
   *
   * // In runtime application:
   * const storage = new UpstashStore({ ...config, disableInit: true });
   * // No auto-init, tables must already exist
   */
  disableInit?: boolean;
} & (
  | {
      /**
       * Pre-configured Upstash Redis client.
       * Use this when you need to configure the client before initialization,
       * e.g., to set custom retry strategies or interceptors.
       *
       * @example
       * ```typescript
       * import { Redis } from '@upstash/redis';
       *
       * const client = new Redis({
       *   url: 'https://...',
       *   token: '...',
       *   // Custom settings
       *   retry: { retries: 5, backoff: (retryCount) => Math.exp(retryCount) * 50 },
       * });
       *
       * const store = new UpstashStore({ id: 'my-store', client });
       * ```
       */
      client: Redis;
    }
  | {
      url: string;
      token: string;
    }
);

/**
 * Type guard for pre-configured client config
 */
const isClientConfig = (config: UpstashConfig): config is UpstashConfig & { client: Redis } => {
  return 'client' in config;
};

/**
 * Upstash Redis storage adapter for Mastra.
 *
 * Access domain-specific storage via `getStore()`:
 *
 * @example
 * ```typescript
 * const storage = new UpstashStore({ id: 'my-store', url: '...', token: '...' });
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
export class UpstashStore extends MastraStorage {
  private redis: Redis;
  stores: StorageDomains;

  constructor(config: UpstashConfig) {
    super({ id: config.id, name: 'Upstash', disableInit: config.disableInit });

    // Handle pre-configured client vs creating new connection
    if (isClientConfig(config)) {
      // User provided a pre-configured Redis client
      this.redis = config.client;
    } else {
      // Validate URL and token before creating client
      if (!config.url || typeof config.url !== 'string' || config.url.trim() === '') {
        throw new Error('UpstashStore: url is required and cannot be empty.');
      }
      if (!config.token || typeof config.token !== 'string' || config.token.trim() === '') {
        throw new Error('UpstashStore: token is required and cannot be empty.');
      }
      // Create client from credentials
      this.redis = new Redis({
        url: config.url,
        token: config.token,
      });
    }

    const scores = new ScoresUpstash({ client: this.redis });
    const workflows = new WorkflowsUpstash({ client: this.redis });
    const memory = new StoreMemoryUpstash({ client: this.redis });

    this.stores = {
      scores,
      workflows,
      memory,
    };
  }

  async close(): Promise<void> {
    // No explicit cleanup needed for Upstash Redis
  }
}
