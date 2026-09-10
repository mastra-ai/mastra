---
'@mastra/client-js': patch
---

Added deleteFeedback() and deleteScores() client methods for removing observability feedback and score records by id.

```typescript
await mastraClient.deleteFeedback({ feedbackIds: ['feedback-1'] });
```
