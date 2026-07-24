---
'@mastra/duckdb': patch
---

Fixed severe CPU and memory spikes when listing traces from large DuckDB databases.

Opening the traces page in Studio (or calling the list traces / list branches APIs) against a multi-GB trace database previously decompressed the entire span_events table for every page load, poll, and scroll — pinning all CPU cores and ballooning memory by several GB per query. On multi-GB databases, trace list queries now use roughly 5x less CPU and stay within a bounded memory budget:

- Page queries now scan only the time range containing the requested spans instead of the whole table
- Filtered and custom-ordered queries (status, hasChildError, order by endedAt) now paginate on a narrow column set before reconstructing full span payloads
- Delta polls now short-circuit when there is no new data

Also added `memoryLimit` and `threads` options to `DuckDBStore`. DuckDB previously used its default memory budget of 80% of system RAM, which could push application servers into swap; it now defaults to 2GB. File-backed databases spill larger-than-memory operations to disk. Note that `:memory:` databases cannot spill, so if you run very large queries against an in-memory database, raise `memoryLimit`.

```typescript
const store = new DuckDBStore({
  path: 'mastra.duckdb',
  memoryLimit: '4GB', // default '2GB'
  threads: 2, // default: one per CPU core
});
```
