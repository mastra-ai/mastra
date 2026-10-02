---
'@mastra/clickhouse': patch
---

Improved ClickHouse query performance by letting filters use table indexes instead of scanning whole tables.

**Observability**

- Delta polling and list cursors for traces, branches, logs, metrics, scores and feedback now read only the rows past the cursor instead of the whole signal table.
- Score dashboards and `listScores` filtered by trace no longer merge the entire current-scores table.
- Trace list pages and paginated trace queries load faster and use far less memory on large time ranges.
- Metric, score and feedback percentile charts compute all requested percentiles in one query.
- Added skip indexes for trace-root and branch lookups by trace, feedback lookups by id, and log filters by trace, thread, resource, user, organization, experiment, run, session and request.

**Memory, workflows and scores**

- `updateMessages` and `updateResource` are much faster on large tables because they no longer rewrite the entire table on every call.
- `saveMessages`, `updateMessages` and `listThreads` respond faster, especially for batches of messages and for users with many threads.
- Added skip indexes for message, thread, resource, workflow run and score lookups by id.

**Skip index coverage**

The new skip indexes are added automatically on the next `init()`. They cover data written from then on immediately; existing data is covered only as ClickHouse merges it. Older memory and workflow data rarely re-merges, so lookups over existing history stay as slow as before until the index is built for it. To cover existing data now, run this once per table and index (a background job that reads the indexed column):

```sql
ALTER TABLE <table> MATERIALIZE INDEX idx_<column>;
```

For example, `ALTER TABLE mastra_messages MATERIALIZE INDEX idx_thread_id;`. List the indexes on a table with `SELECT name FROM system.data_skipping_indices WHERE table = '<table>'`.
