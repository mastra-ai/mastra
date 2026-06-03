---
"@mastra/core": minor
---

Add experimental record-first notification signals with thread-scoped inbox storage, `agent.sendNotificationSignal()`, priority-aware notification delivery policies, due-notification dispatch, summary rollups for low-priority notifications, a structured `metadata.notification` signal contract, and a flexible notification inbox tool.

```ts
await agent.sendNotificationSignal(
  {
    source: 'github',
    kind: 'ci-status',
    priority: 'high',
    summary: 'CI failed on main',
  },
  { resourceId: 'user-1', threadId: 'thread-1' },
);
```

Agents can then use the `notification_inbox` tool to list, read, dismiss, or archive persisted inbox records.
