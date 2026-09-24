---
'@mastra/playground-ui': patch
---

Fixed Studio timestamps losing their time on historical dates. Date-only cells now stay date-only even today, while trace tooltips and unnamed chat threads preserve seconds. Timeline timestamps use the browser locale while keeping UTC. Calendar labels respect the requested timezone at year boundaries.

Added shared date, duration, and elapsed-time helpers for custom Studio interfaces. `formatDate` requires an explicit preset: `date`, `date-time`, `date-time-seconds`, `time`, `time-seconds`, or `relative-time`. Trace list dates, table timestamps, and tool-call timestamps preserve visible seconds without requiring a hover. Relative labels fall back to the `date` preset after seven days. `formatTimestampPrecise` retains milliseconds for debugging.

```tsx
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { formatDuration } from '@mastra/playground-ui/utils/duration';
import { formatRelativeTime } from '@mastra/playground-ui/utils/relative-time';
import { useElapsedTime } from '@mastra/playground-ui/hooks/use-elapsed-time';

formatDate('2026-09-24T10:00:00Z', 'date-time-seconds', { timeZone: 'UTC' });
formatRelativeTime('2026-09-24T10:00:00Z');
formatDuration(1234); // "1.23s"

function Elapsed({ isRunning }: { isRunning: boolean }) {
  const elapsed = useElapsedTime(isRunning);
  return <span>{formatDuration(elapsed)}</span>;
}
```
