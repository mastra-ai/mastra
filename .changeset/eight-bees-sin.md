---
'@mastra/core': minor
---

Added deleteFeedback() and deleteScores() to observability storage. Both accept a batch of ids and optional organizationId / resourceId tenant scope, are idempotent, and are implemented by the in-memory store. Storage adapters that don't implement them throw a not-implemented error.

```typescript
await observability.deleteFeedback({ feedbackIds: ['feedback-1'] });
await observability.deleteScores({ scoreIds: ['score-1'], organizationId: 'org-1' });
```
