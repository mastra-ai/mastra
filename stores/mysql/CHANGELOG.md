# @mastra/mysql

## 0.1.0-alpha.0

### Minor Changes

- Added the MySQL storage adapter for Mastra. Use it as a storage backend with the same domain coverage as the other first-party adapters (memory, threads, workflows, observability, agents, and more). ([#17446](https://github.com/mastra-ai/mastra/pull/17446))

  ```ts
  import { MySQLStore } from '@mastra/mysql';

  const store = new MySQLStore({
    connectionString: 'mysql://user:password@localhost:3306/mastra',
  });
  ```

  This release also makes table and index setup reliable on a brand-new database:
  - Fixed store initialization failing on a fresh database. Idempotency for favorites is now enforced by the table's primary key instead of a separate index that MySQL rejected, which previously aborted setup and left the connection pool unusable.
  - Fixed default performance indexes silently failing to be created. Indexes on text columns now include a key-length prefix so they are created instead of skipped.

### Patch Changes

- Updated dependencies [[`19a8658`](https://github.com/mastra-ai/mastra/commit/19a86589c788ef48bb6c1b0612cc82a201857379), [`a659a77`](https://github.com/mastra-ai/mastra/commit/a659a779bdebe3a52a518c56d2260592d0240fe0), [`3332be9`](https://github.com/mastra-ai/mastra/commit/3332be9701ecd77aba840959d9a1d1ce7aef02d3)]:
  - @mastra/core@1.38.0-alpha.6
