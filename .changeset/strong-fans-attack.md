---
'@mastra/factory': minor
---

Added separate provider work item and board item storage so source refreshes do not invalidate pending board moves. Existing card IDs stay unchanged. Migration skips conflicting sources instead of blocking startup.

```typescript
import { primarySource } from '@mastra/factory';

// Provider facts are normalized on the work item.
card.workItem.labels;

// syncCard checks the source revision, not the work-item revision.
await workItems.syncCard({
  orgId,
  id: card.id,
  userId,
  expectedSourceRevision: primarySource(card)?.revision,
  patch: { metadata: { labels: ['bug'] } },
});

// Factory process state and board revision stay on the card.
card.metadata;
card.revision;
```
