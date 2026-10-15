---
'@mastra/server': minor
'@mastra/client-js': patch
---

`GET /observability/capabilities` can now report how long the observability store keeps traces, as an optional `traceRetentionDays`. Clients can use it to stop users picking dates whose traces are already gone. It's omitted when the store doesn't report a limit.

```ts
const { capabilities } = await client.getObservabilityCapabilities();
capabilities.traceRetentionDays; // e.g. 180, or undefined
```
