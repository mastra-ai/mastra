---
'@mastra/playground-ui': major
---

Added a **Time to first chunk** column to the Traces page. Pick it from the **Columns** menu to see how long each run took to stream its first chunk back. Runs that never streamed show a dash. Click the column header to sort traces by it. The column is only offered when the observability store records this value, and the header is only sortable when the store can order by it. When the store doesn't support it, or the column is hidden, the list falls back to newest first instead of showing an always-empty column or an unusable sort.

**Breaking:** `TracesExplorer` now takes the sort as a single `{ field, direction }` value so it can sort by more than the start time. Replace `sortDirection` / `onSortDirectionChange` with `sort` / `onSortChange`:

```tsx
// Before
<TracesExplorer sortDirection={direction} onSortDirectionChange={setDirection} />;

// After
import { DEFAULT_TRACES_SORT, type TracesSort } from '@mastra/playground-ui/domains/traces/components/traces-explorer';

const [sort, setSort] = useState<TracesSort>(DEFAULT_TRACES_SORT);
<TracesExplorer sort={sort} onSortChange={setSort} />;
```

`field` is `'startedAt'` or `'timeToFirstChunkMs'`.
