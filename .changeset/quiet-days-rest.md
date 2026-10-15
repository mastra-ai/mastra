---
'@mastra/server': minor
'@mastra/client-js': patch
---

Added an optional `traceRetentionDays` to the observability capabilities type and response schema, for hosts that serve `GET /observability/capabilities` themselves and know how long traces are kept. Clients can use it to stop users picking dates whose traces are already gone. Mastra's own server and built-in stores don't report a retention, so the field is omitted there.

```ts
const { capabilities } = await client.getObservabilityCapabilities();
capabilities.traceRetentionDays; // e.g. 180, or undefined
```
