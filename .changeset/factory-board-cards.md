---
'@mastra/playground-ui': minor
---

Added Factory board cards, list rows, filters, view controls, card activity and the run queue menu under `@mastra/playground-ui/domains/factory`.

```tsx
import { BoardCard, CardActivity } from '@mastra/playground-ui/domains/factory';

<BoardCard title={card.title} href={`/cards/${card.id}`} dragPayload={dragPayload} LinkComponent={RouterLink}>
  <span>{card.title}</span>
  <CardActivity worker={{ name: card.lastWorker }} entries={activityEntries} />
</BoardCard>;
```
