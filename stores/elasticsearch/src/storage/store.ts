import { Client as ElasticSearchClient } from '@elastic/elasticsearch';
import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import { MastraStorage } from '@mastra/core/storage';
import type { StorageDomains } from '@mastra/core/storage';

import packageJson from '../../package.json';
import { MemoryElasticSearch } from './domains/memory';
import { ScoresElasticSearch } from './domains/scores';
import { WorkflowsElasticSearch } from './domains/workflows';
import type { ElasticSearchConfig } from './types';

/**
 * ElasticSearch storage adapter for Mastra.
 *
 * Implements the memory, workflows, and scores storage domains on top of
 * ElasticSearch. Shares the same connection config surface as
 * `ElasticSearchVector`, so both can reuse one client or connection config.
 *
 * @example
 * ```typescript
 * // Using connection parameters
 * const storage = new ElasticSearchStore({
 *   id: 'my-store',
 *   url: 'http://localhost:9200',
 *   auth: { apiKey: '...' },
 * });
 *
 * // Access memory domain
 * const memory = await storage.getStore('memory');
 * await memory?.saveThread({ thread });
 * ```
 *
 * @example
 * ```typescript
 * // Using a pre-configured client shared with ElasticSearchVector
 * import { Client } from '@elastic/elasticsearch';
 *
 * const client = new Client({ node: 'http://localhost:9200' });
 * const storage = new ElasticSearchStore({ id: 'my-store', client });
 * const vector = new ElasticSearchVector({ id: 'my-vector', client });
 * ```
 */
export class ElasticSearchStore extends MastraStorage {
  private client: ElasticSearchClient;
  private shouldManageConnection: boolean;
  public stores: StorageDomains;

  constructor(config: ElasticSearchConfig) {
    super({ id: config.id, name: 'ElasticSearch', disableInit: config.disableInit });

    if ('client' in config && config.client) {
      this.client = config.client;
      this.shouldManageConnection = false;
    } else if ('url' in config && config.url) {
      this.client = new ElasticSearchClient({
        node: config.url,
        ...(config.auth && { auth: config.auth }),
        name: 'mastra-elasticsearch',
        headers: { 'user-agent': `mastra-es/${packageJson.version}` },
      });
      this.shouldManageConnection = true;
    } else {
      throw new MastraError({
        id: 'ELASTIC_SEARCH_STORE_CONSTRUCTOR_ERROR',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Invalid config: provide either { client } or { url }.',
      });
    }

    this.stores = {
      memory: new MemoryElasticSearch({ client: this.client }),
      workflows: new WorkflowsElasticSearch({ client: this.client }),
      scores: new ScoresElasticSearch({ client: this.client }),
    };
  }

  public getClient(): ElasticSearchClient {
    return this.client;
  }

  public async close(): Promise<void> {
    if (this.shouldManageConnection) {
      await this.client.close();
    }
  }
}
