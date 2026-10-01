---
'@mastra/clickhouse': patch
---

Improved ClickHouse query performance by letting filters use table indexes instead of scanning whole tables.

**Observability**

- Delta polling and list cursors for traces, branches, logs, metrics, scores and feedback now read only the rows past the cursor instead of the whole signal table.
- Score dashboards and `listScores` with a time range or trace filter no longer merge the entire current-scores table.
- Trace list pages and paginated trace queries load faster and use far less memory on large time ranges.
- Metric, score and feedback percentile charts compute all requested percentiles in one query.
- Added skip indexes for trace-root and branch lookups by trace, feedback lookups by id, and log filters by trace, thread, resource, user, organization, experiment, run, session and request. They are added automatically on the next `init()`.

**Memory, workflows and scores**

- `updateMessages` and `updateResource` are much faster on large tables and no longer slow down as message and resource history grows.
- `saveMessages`, `updateMessages` and `listThreads` respond faster, especially for batches of messages and for users with many threads.
- Added skip indexes for message, thread, resource, workflow run and score lookups by id. They are added automatically on the next `init()`.
