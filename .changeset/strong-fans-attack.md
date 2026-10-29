---
'@mastra/factory': minor
'mastra': patch
---

Added separate provider work item and board item storage so source refreshes do not invalidate pending board moves. Existing card IDs stay unchanged. Migration skips conflicting source or claim owners instead of blocking startup.

```typescript
// Provider facts have their own record and revision.
card.workItem.labels;
card.workItem.revision;

// Factory process state and board revision stay on the card.
card.metadata;
card.revision;
```
