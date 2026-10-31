---
'@mastra/core': minor
---

Added `onDecision` to `ClassifierProcessor` for writing guardrail decisions to your own audit log (#28985). It runs after each classification, including failed classifier calls, and receives the outcome (`allowed`, `filtered` or `aborted`), the answers or the error, the call duration, and the ids of the message, thread, resource or run.

```ts
new ClassifierProcessor({
  classifier: safety,
  onResult,
  onDecision: async decision => {
    await auditLog.insert({
      threadId: decision.ids.threadId,
      outcome: decision.outcome,
      answers: decision.result ? decision.result.answers : null,
      error: decision.result ? null : String(decision.error),
    });
  },
});
```

`abort` in `onResult` now accepts tripwire metadata, so the caller can tell which policy blocked the request:

```ts
onResult: (answers, { abort }) => {
  if ((answers.unsafe.probability ?? 1) > 0.8) abort('Blocked', { metadata: { policy: 'unsafe' } });
};
```

A failed classifier call under `errorStrategy: 'strict'` now sets tripwire metadata `{ processorId, classifierId, code: 'CLASSIFIER_FAILED' }`. On agents that aren't durable, stopping a streaming reply now cancels a classifier call that is still running.
