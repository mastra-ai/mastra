---
'@mastra/factory': minor
---

Added separate provider work item and board item storage so source refreshes do not invalidate pending board moves. Existing card IDs stay unchanged. Migration skips conflicting sources instead of blocking startup.

Board items now retain comment counts maintained by the comments domain, so listing cards, transitions, and session cleanup no longer load comment bodies. Recounts invalidate cached board lists without changing placement revisions, and migration recopies preserve refreshed counts. The internal feed activity clock is no longer returned on cards. Open pull request refreshes also avoid adding empty reconciliation markers that would invalidate pending rules.

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
