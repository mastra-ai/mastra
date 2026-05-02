---
'@mastra/core': minor
---

Added durable Harness awaiting-input APIs for tool approval and suspension resume flows.

```ts
const awaitingInput = await harness.waitForAwaitingInputReady({ id: toolCallId });
await harness.resumeAwaitingInput({ id: toolCallId, resumeData: { approved: true } });
```

Apps can wait for resumable state, inspect pending input metadata, and resume storage-backed tool approvals or suspensions by id.
