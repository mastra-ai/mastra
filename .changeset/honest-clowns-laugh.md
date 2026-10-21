---
'@mastra/server': minor
---

Added `spanQueryContextFields` to observability capabilities so clients can check support for expanded `querySpans()` filters.

```ts
const { capabilities } = await client.getObservabilityCapabilities();
const supportsContextFilters = capabilities.spanQueryContextFields === true;
```
