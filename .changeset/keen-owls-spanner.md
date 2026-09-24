---
'@mastra/spanner': patch
---

The Spanner observability store now reports metrics and metric discovery as supported only when metrics are enabled with `disableMetrics: false`. Previously Studio could treat metrics as available while every metric request failed.

```ts
const { capabilities } = await client.getObservabilityCapabilities();
capabilities.metrics; // true only when the SpannerStore sets disableMetrics: false
```
