---
'@mastra/core': minor
---

Added minimal persistence for resuming agent tool approvals without storing complete workflow snapshots.

```ts
await agent.stream('Send the email', {
  approvalPersistence: 'minimal',
});
```
