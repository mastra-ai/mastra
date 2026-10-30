---
'@mastra/factory': minor
---

Added separate work identity, provider sources and board placement to Factory. `WorkItemRow` now describes the work itself; use `Card` for board placement and `WorkItemSourceRow` for provider facts. Existing card IDs are preserved, and Factory-created work items have no external sources.

```typescript
// Before
import type { WorkItemRow } from '@mastra/factory';
function stages(item: WorkItemRow) {
  return item.stages;
}

// After
import { primarySource, type Card } from '@mastra/factory';
function stages(card: Card) {
  return card.stages;
}
function providerUrl(card: Card) {
  return primarySource(card)?.url ?? null;
}
```

Factory copies existing cards automatically at startup. Inspect reported skipped IDs before rollout. The old `work_items` table is left unchanged, but writes after cutover are not copied back: rolling back to an older build loses visibility of those writes. `MASTRA_FACTORY_WORK_ITEM_SPLIT=dry-run` is supported only before cutover and refuses startup when migrated board items already exist.
