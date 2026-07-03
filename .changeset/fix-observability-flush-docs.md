---
'@mastra/core': patch
'@mastra/observability': minor
---

Added `flush()` to `ObservabilityEntrypoint` so `mastra.observability.flush()` works directly in serverless environments.

Previously, `flush()` only existed on individual `ObservabilityInstance` objects, requiring users to call `mastra.observability.getDefaultInstance()?.flush()`. The entrypoint-level `flush()` delegates to all registered instances, matching the existing `shutdown()` pattern.

```ts
// Before (broken — getObservability() didn't exist, flush() wasn't on the entrypoint)
const observability = mastra.getObservability()
await observability.flush()

// After
await mastra.observability.flush()
```

Fixed the serverless flush docs in the observability config guide and Vercel deployment guide to use the correct API.
