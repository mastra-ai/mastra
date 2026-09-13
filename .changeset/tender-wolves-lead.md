---
'@mastra/factory': minor
---

Added an idempotent HTTP endpoint that lets trusted external orchestrators queue a deferred skill dispatch for a work item without risking duplicate work on retries.

A trusted external event controller can now enqueue exactly one deferred skill dispatch against a work item. The `requestId` makes the call idempotent: replaying the same request returns the prior result instead of queuing duplicate work. Reusing a `requestId` for a different operation (work item, role, skill, or arguments) is rejected with a `409 request_id_conflict` instead of falsely reporting success. Every queue and reject is recorded to the audit trail in both tenant and local no-auth deployments, with one event per `requestId`.

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
