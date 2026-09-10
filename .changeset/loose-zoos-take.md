---
'@mastra/core': minor
---

Added a persisted manual tool approval policy for scheduled runs and direct agent execution. Each tool waits for a decision across resume even when the Session allows tools automatically. Omitting the policy preserves existing approval behavior.

```typescript
await mastra.schedules.create({
  agentId: 'reporter',
  resourceId: 'user-1',
  threadId: 'existing-report-thread',
  cron: '0 9 * * *',
  prompt: 'Prepare the daily report.',
  ifIdle: {
    behavior: 'wake',
    streamOptions: { toolApprovalPolicy: 'manual' },
  },
})
```
