---
'@mastra/observability': minor
'@mastra/core': patch
---

Added full RequestContext snapshot to span data. Every span now captures a serialized snapshot of the RequestContext at creation time in the `requestContext` field. This makes it possible to inspect the exact request-scoped values (user IDs, tenant IDs, feature flags, etc.) that were active when each span was created. Non-serializable values (functions, symbols) are automatically filtered out.
