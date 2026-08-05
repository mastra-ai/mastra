---
'@mastra/client-js': patch
---

Added landmark types for trace signal theme snapshots. Querying the theme-snapshots endpoint with `presentation=landmarks` returns a bounded, time-balanced selection of snapshots instead of every snapshot in range. The response types now cover that mode.

```ts
import type { ThemeSnapshotsResponse } from '@mastra/client-js';

const response: ThemeSnapshotsResponse = await fetch(
  '/api/learning/entities/my-agent/theme-snapshots?' +
    'entityType=agent&signalNames=goal,outcome&presentation=landmarks&limit=24',
).then(res => res.json());

response.totalSnapshots; // full in-range count, larger than the landmark list
for (const snapshot of response.snapshots) {
  snapshot.cutoffAt; // position ticks proportionally on a time axis
  snapshot.reason; // 'range_start' | 'range_end' | 'time_sample'
}
```
