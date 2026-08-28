import type { Client as ElasticSearchClient } from '@elastic/elasticsearch';

import type { ElasticSearchAuth } from '../vector';

/**
 * ElasticSearch storage configuration type.
 *
 * Accepts either:
 * - A pre-configured ElasticSearch client: `{ id, client }`
 * - Connection parameters: `{ id, url, auth? }`
 *
 * This mirrors the config surface of `ElasticSearchVector` so both can share
 * the same connection settings (or the same client instance).
 */
export type ElasticSearchConfig = {
  id: string;
  /**
   * When true, automatic initialization (index creation) is disabled.
   * You must call `storage.init()` explicitly before use.
   */
  disableInit?: boolean;
} & (
  | {
      /**
       * Pre-configured ElasticSearch client (from `@elastic/elasticsearch`).
       *
       * @example
       * ```typescript
       * import { Client } from '@elastic/elasticsearch';
       *
       * const client = new Client({ node: 'http://localhost:9200' });
       * const store = new ElasticSearchStore({ id: 'my-store', client });
       * ```
       */
      client: ElasticSearchClient;
      url?: never;
      auth?: never;
    }
  | {
      /**
       * ElasticSearch node URL.
       *
       * @example
       * ```typescript
       * const store = new ElasticSearchStore({
       *   id: 'my-store',
       *   url: 'http://localhost:9200',
       *   auth: { apiKey: '...' },
       * });
       * ```
       */
      url: string;
      auth?: ElasticSearchAuth;
      client?: never;
    }
);
