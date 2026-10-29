---
'@mastra/core': patch
---

Fixed resumed runs losing the link to the run they continue. When you resume an agent, durable agent or workflow run, its span now sets `resumedFromSpanId` to the span id of the first run. This stays true after several resumes and after a durable agent recovers. A resumed run also keeps the external parent span of the run it continues.

A resume that passes only `tracingOptions.parentSpanId` now stays in the original trace under the first run, and uses that id as its external parent. Before, it started a new trace.

```ts
await agent.resumeGenerate({ approved: true }, { runId, toolCallId, tracingOptions: { parentSpanId: callerSpanId } });
// The resumed run stays in the first run's trace.
// resumedFromSpanId is the first run's span id, externalParentSpanId is callerSpanId.
```

The `resumedFromSpanId` option of `getOrCreateSpan` is deprecated. Use `resumeFrom` with the saved tracing context instead.
