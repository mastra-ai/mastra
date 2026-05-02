---
'@mastra/core': minor
---

Add `harness.listAwaitingInputs()` for scoped pending Harness input enumeration.

```ts
const pendingInputs = await harness.listAwaitingInputs({ threadId });
```

The method returns pending input objects such as tool approvals, tool suspensions, questions, and plan approvals with their `id`, `kind`, durability flag, and resource/thread scope where available. This is a non-breaking public API addition.
