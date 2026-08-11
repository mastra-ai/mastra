---
'@mastra/factory': minor
---

Fixed the Factory metrics so the same date range always reports the same numbers, and removed the parts of the response nothing displayed.

**Completions are events, not the board's current state.** Throughput and lead time now count entries into `done` in the stage history, so reopening a card no longer erases the day it shipped and a card that shipped twice counts twice. The per-day rate divides by the days the board actually existed, so a 12-month range on a two-week-old board no longer reads as ~0 per day.

**Automation numbers stop counting the wrong things.** A card landing on the board when it is created is no longer counted as an automated stage move, which used to credit every webhook-synced card. Automation coverage measures the first pass through each stage only — a redo used to add a second entry to the denominator alone, capping a fully automated stage at 50% — and each pass's outcome is now frozen at the end of the window instead of reflecting where the card sits today.

**Response shape.** `stageDurations`, `wip`, `agingWip` and `earliestItemAt` are gone: nothing rendered them, and live in-flight work is already covered by the queue-health chart. `windowDays` is now `daysCovered` (the window clipped to the board's life) and `cycleTime` is `leadTime`, which is what it always measured — card creation through to `done`.

```ts
const metrics = computeFactoryMetrics(items, range);

metrics.cycleTime.medianMs; // before
metrics.leadTime.medianMs; // after
```

A corrupt stage-history timestamp now throws instead of being read as 1970.
