---
'@mastra/playground-ui': minor
---

Added `RelativeTimestamp`, which shows a compact relative time such as `3m ago` or `in 2h` in monospace. Hover or focus shows a card with the time since, counting up live, and the date and time in your timezone and in UTC. Studio schedules, trigger history, and workflow run headers now use it.

```tsx
import { RelativeTimestamp } from '@mastra/playground-ui/components/RelativeTimestamp';

<RelativeTimestamp value={run.createdAt} />
```
