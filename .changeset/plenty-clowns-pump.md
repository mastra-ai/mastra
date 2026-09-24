---
'@mastra/server': patch
---

Added a `feedback` observability storage capability and clearer errors for unsupported storage APIs.

- `GET /observability/capabilities` and `GET /system/packages` now report a `feedback` flag, so clients can check feedback support before calling the feedback endpoints.
- Observability routes backed by an optional storage API (feedback, metrics, logs, scores) now return a 501 status instead of a server error when the configured store does not implement it. This also removes the noisy error log Studio triggered when probing feedback on stores without it (for example LibSQL).

```ts
const { capabilities } = await client.getObservabilityCapabilities();

if (capabilities.feedback) {
  const feedback = await client.listFeedback({ traceId });
}
```
