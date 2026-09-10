---
'@mastra/core': minor
---

Added saved manual and automatic tool approval for scheduled runs. A controller target connects the existing result Session even without an open browser. Explicit denies remain blocked after resume, while normal chat settings stay unchanged. Durable recovery restores saved manual gates without executing them and continues eligible automatic gates.

```typescript
await mastra.schedules.create({
  agentId: 'reporter',
  resourceId: 'user-1',
  threadId: 'existing-report-thread',
  cron: '0 9 * * *',
  prompt: 'Prepare the daily report.',
  ifIdle: {
    behavior: 'wake',
    streamOptions: {
      toolApprovalPolicy: 'manual',
      controllerTarget: {
        controllerId: 'report-controller',
        scope: 'thread:existing-report-thread',
      },
    },
  },
})
```
