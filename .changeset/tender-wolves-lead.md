---
'@mastra/factory': minor
---

Added an idempotent HTTP endpoint that lets trusted external orchestrators queue a deferred skill dispatch for a work item without risking duplicate work on retries.

A trusted external event controller can now enqueue exactly one deferred skill dispatch against a work item. The `requestId` makes the call idempotent: replaying the same request returns the prior result instead of queuing duplicate work.

```ts
await fetch(`/web/factory/projects/${projectId}/work-items/${workItemId}/automation-runs`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    requestId: crypto.randomUUID(),
    expectedRevision: 1,
    role: 'work',
    skillName: 'factory-plan',
  }),
});
```
