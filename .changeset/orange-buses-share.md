---
'@mastra/core': minor
---

Align observability signal contracts around first-class trace and span fields.

**Improved observability signal consistency**
Logs, metrics, scores, and feedback now carry `traceId` and `spanId` directly on each signal. Shared correlation metadata stays in `correlationContext`.

**Added clearer provenance fields**
Score and feedback payloads now support `scoreSource`, `feedbackSource`, and `executionSource` for clearer source tracking.

**Migration note**
Deprecated fields (like `source` and feedback `userId`) are still accepted for compatibility.

```ts
metrics.emit('mastra_tool_duration_ms', 42, {}, {
  correlationContext: { entityType: 'agent', entityName: 'my-agent' },
  traceId: 'trace-123',
  spanId: 'span-456',
});
```
