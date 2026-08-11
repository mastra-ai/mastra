---
'@mastra/core': patch
---

Fixed `Mastra.shutdown()` leaving database connections open when storage is a `MastraCompositeStore`. The composite had no `close()` of its own, so shutdown silently skipped storage cleanup and any composed adapter (Redis, LibSQL, Postgres, ...) kept its client connected — leaving processes that wait for a graceful drain, such as test runners and Kubernetes pods handling SIGTERM, hanging until they were killed.

A composite now closes everything it was built from: the `default` and `editor` stores, plus any domain that owns its own connection. Each store is closed once even when it backs several domains, and a store that fails to close is logged and skipped so the remaining handles are still released. See [#20621](https://github.com/mastra-ai/mastra/issues/20621).
