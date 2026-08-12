---
'@mastra/core': minor
---

Added minimal persistence for resuming agent tool approvals without storing complete workflow snapshots.

Continue a minimal-mode run with `Agent.approveToolCall()` or `Agent.declineToolCall()`. Generic workflow `resume()`, `restart()`, `cancel()`, and `timeTravel()` are not supported for these runs. `approvalPersistence` defaults to `"full"`, which keeps existing behavior.

```ts
await agent.stream('Send the email', {
  approvalPersistence: 'minimal',
});
```
