---
'@mastra/playground-ui': patch
---

The Traces list now updates live via delta polling. Previously the list was refetched every 10 seconds, replacing the whole page with no signal about what changed; now new traces appear within a few seconds of being created, with a brief highlight to draw attention. Status changes on already-visible rows (running → success / error) also propagate without intervention, and returning to the tab after being idle re-syncs from a fresh cursor.

**New `useTraces` return fields**

- `isRefetching` — true while any meaningful refetch is in flight. Use it to drive a heartbeat indicator.
- `autoRefetch` / `setAutoRefetch` — pause / resume all automatic polling so the consumer can render an opt-out toggle.
- `recentlyAddedKeys` — `Set<string>` of `traceId:spanId` for rows that just arrived via delta polling. Drives the temporary highlight in `TracesListView`.

**New polling config**

Every timing in the hook is tunable per-instance via a new `polling` option:

```ts
import { useTraces, type TracesPollingConfig } from '@mastra/playground-ui';

useTraces({
  filters,
  listMode,
  polling: {
    deltaPollIntervalMs: 10_000,
    idleGuardThresholdMs: 5 * 60_000,
  },
});
```

Omitted fields fall through to the defaults (delta poll every 5s, idle reset after 15 min, status refresh every 60s, etc).

**TracesListView**

New optional `recentlyAddedKeys?: Set<string>` prop. Rows whose `traceId:spanId` is in the set get the `animate-row-highlight` class — a brief fade-out to transparent, added to `index.css`.

**Compatibility**

Requires `@mastra/server` and `@mastra/client-js` at the versions that ship the observability delta-polling endpoints, and a store that opts into delta polling (`@mastra/clickhouse`, `@mastra/duckdb`, and the in-memory store today). When unavailable — older server or a store without delta capability — the hook silently falls back to page-mode interval refetching. No consumer changes required.
