---
'@mastra/client-js': minor
---

Added `getObservabilityCapabilities()`, which returns the optional observability features the server's configured storage supports.

```ts
const { observabilityStorageType, capabilities } = await client.getObservabilityCapabilities();

if (!capabilities.traceQuery) {
  // List traces with the legacy endpoint instead
  const traces = await client.listTracesLight({ pagination: { page: 0, perPage: 25 } });
}
```
