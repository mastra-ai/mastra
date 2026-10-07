---
'@mastra/langfuse': patch
---

Fixed a run nested under another run replacing the Langfuse trace name, input, output, metadata, user, and session. Start the nested run with `tracingOptions.nestUnderParent: true` and the trace keeps the values of the run that started it.

```ts
await judge.generate('Grade this answer', {
  tracingOptions: { traceId: turn.traceId, parentSpanId: turn.spanId, nestUnderParent: true },
});
```
