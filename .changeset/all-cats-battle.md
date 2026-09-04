---
'@mastra/clickhouse': patch
---

Improved `batchDeleteTraces()` with a durable deletion request and synchronous lightweight delete masking across trace branches, metrics, logs, scores, and feedback. Physical removal follows the deployment's configured retention TTL and merge policy.

```ts
await observabilityStore.batchDeleteTraces({ traceIds: ['trace-123'] });
```
