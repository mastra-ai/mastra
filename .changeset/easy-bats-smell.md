---
'@mastra/server': patch
---

Added DELETE /api/observability/feedback and DELETE /api/observability/scores routes for deleting feedback and score records by id, gated behind the observability-signal-deletion core feature and the observability:delete permission.

```typescript
await fetch(`${baseUrl}/api/observability/feedback`, {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ feedbackIds: ['feedback-1'] }),
});

await fetch(`${baseUrl}/api/observability/scores`, {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ scoreIds: ['score-1'], organizationId: 'org-1' }),
});
```
