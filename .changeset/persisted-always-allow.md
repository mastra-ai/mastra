---
'@mastra/core': patch
---

`respondToPersistedToolApproval` now accepts `alwaysAllowCategory`. Approving a tool call restored after a restart with "always allow" grants the tool's category to the run's thread, matching a live approval.

```ts
await session.respondToPersistedToolApproval({ toolCallId, approved: true, alwaysAllowCategory: true });
```
