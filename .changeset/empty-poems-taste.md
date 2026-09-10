---
'@mastra/pg': patch
---

Added observability feedback and score deletion by id, with optional scope predicates.

```typescript
import { ObservabilityStoragePostgresVNext } from '@mastra/pg';

const observability = new ObservabilityStoragePostgresVNext({
  connectionString: process.env.OBSERVABILITY_DATABASE_URL!,
});

await observability.deleteFeedback({ feedbackIds: ['feedback-1'] });
await observability.deleteScores({ scoreIds: ['score-1'], organizationId: 'org-1' });
```
