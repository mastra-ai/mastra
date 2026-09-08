---
'@mastra/duckdb': patch
---

Added observability feedback and score deletion by id, with optional organization and resource filters.

```typescript
await observability.deleteFeedback({ feedbackIds: ['feedback-1'] });
await observability.deleteScores({ scoreIds: ['score-1'], resourceId: 'resource-1' });
```
