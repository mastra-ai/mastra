---
'@mastra/oracledb': patch
---

Added observability score deletion by id, with optional organization and resource filters.

```typescript
await observability.deleteScores({
  scoreIds: ['score-1'],
  organizationId: 'org-1',
  resourceId: 'resource-1',
});
```
