import type { StorageDomains } from '@mastra/core/storage';
import { MastraStorage } from '@mastra/core/storage';

import type { ConvexAdminClientConfig } from './client';
import { ConvexAdminClient } from './client';
import { MemoryConvex } from './domains/memory';
import { ScoresConvex } from './domains/scores';
import { WorkflowsConvex } from './domains/workflows';

// Export domain classes for direct use with MastraStorage composition
export { MemoryConvex, ScoresConvex, WorkflowsConvex };
export type { ConvexDomainConfig } from './db';

/**
 * Convex configuration type.
 *
 * Accepts either:
 * - A pre-configured ConvexAdminClient: `{ id, client }`
 * - Deployment config: `{ id, deploymentUrl, adminAuthToken, storageFunction? }`
 */
export type ConvexStoreConfig = {
  id: string;
  name?: string;
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
   * const storage = new ConvexStore({ ...config, disableInit: false });
   * await storage.init(); // Explicitly run migrations
   *
   * // In runtime application:
   * const storage = new ConvexStore({ ...config, disableInit: true });
   * // No auto-init, tables must already exist
   */
  disableInit?: boolean;
} & (
  | {
      /**
       * Pre-configured ConvexAdminClient.
       * Use this when you need to configure the client before initialization.
       *
       * @example
       * ```typescript
       * import { ConvexAdminClient } from '@mastra/convex/storage/client';
       *
       * const client = new ConvexAdminClient({
       *   deploymentUrl: 'https://your-deployment.convex.cloud',
       *   adminAuthToken: 'your-token',
       *   storageFunction: 'custom/storage:handle',
       * });
       *
       * const store = new ConvexStore({ id: 'my-store', client });
       * ```
       */
      client: ConvexAdminClient;
    }
  | ConvexAdminClientConfig
);

/**
 * Type guard for pre-configured client config
 */
const isClientConfig = (config: ConvexStoreConfig): config is ConvexStoreConfig & { client: ConvexAdminClient } => {
  return 'client' in config;
};

/**
 * Convex storage adapter for Mastra.
 *
 * Access domain-specific storage via `getStore()`:
 *
 * @example
 * ```typescript
 * const storage = new ConvexStore({ id: 'my-store', deploymentUrl: '...', adminAuthToken: '...' });
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
export class ConvexStore extends MastraStorage {
  declare stores: StorageDomains;

  constructor(config: ConvexStoreConfig) {
    super({ id: config.id, name: config.name ?? 'ConvexStore', disableInit: config.disableInit });

    // Handle pre-configured client vs creating new one
    const client = isClientConfig(config) ? config.client : new ConvexAdminClient(config);

    const domainConfig = { client };
    const memory = new MemoryConvex(domainConfig);
    const workflows = new WorkflowsConvex(domainConfig);
    const scores = new ScoresConvex(domainConfig);

    this.stores = {
      memory,
      workflows,
      scores,
    };
  }
}
