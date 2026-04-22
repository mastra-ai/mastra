# @mastra/redis

## 1.0.1-alpha.0

### Patch Changes

- Add Redis storage provider ([#11795](https://github.com/mastra-ai/mastra/pull/11795))

  Introduces `@mastra/redis`, a Redis-backed storage implementation for Mastra built on the official `redis` (node-redis) client.

  Includes support for the core storage domains (memory, workflows, scores) and multiple connection options: `connectionString`, `host`/`port`/`db`/`password`, or injecting a pre-configured client for advanced setups (e.g. custom socket/retry settings, Sentinel/Cluster via custom client).

- Updated dependencies [[`a371ac5`](https://github.com/mastra-ai/mastra/commit/a371ac534aa1bb368a1acf9d8b313378dfdc787e), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e), [`c80dc16`](https://github.com/mastra-ai/mastra/commit/c80dc16e113e6cc159f510ffde501ad4711b2189), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e)]:
  - @mastra/core@1.26.0-alpha.12
