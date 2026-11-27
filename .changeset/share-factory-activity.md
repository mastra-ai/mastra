---
'@mastra/playground-ui': minor
---

Added Factory's activity band to `@mastra/playground-ui/domains/factory`: `ActivityBand`, `RecapButton`, the chart pieces (`ActivityChart`, `ActivityField`, `ActivitySlotCard`, `ActivityTotals`, `ActivityPeriodMenu`, `ActivityReveal`), the activity types and labels, and `traySurface`. The band takes plain data, so any app can show what came in, ran and shipped.

```tsx
import { ActivityBand, ACTIVITY_RECAPS, RecapButton } from '@mastra/playground-ui/domains/factory';

<ActivityBand
  period={period}
  onPeriodChange={setPeriod}
  activity={activity}
  runs={{ status: 'success', complete: true }}
  live={[{ count: 2, label: 'Working' }]}
  recap={<RecapButton label={ACTIVITY_RECAPS[period].label} onClick={() => send(ACTIVITY_RECAPS[period].prompt)} />}
/>
```
