---
'@mastra/client-js': patch
---

Added a `feedback` flag to the observability capabilities response so you can check whether the configured store supports the feedback endpoints before calling them.

```ts
const { capabilities } = await client.getObservabilityCapabilities();

if (capabilities.feedback) {
  const feedback = await client.listFeedback({ traceId });
}
```
