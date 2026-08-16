---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/observability': patch
'@mastra/pulse': patch
'@mastra/clickhouse': patch
'@mastra/server': patch
'@mastra/core': patch
---

Fixed Pulse flow status rules in ClickHouse to match the reference implementation (experimental).

- A flow's status is decided by its LAST terminal pulse — a `run_failed` arriving after a `run_completed` no longer reads as completed.
- Abort matching keeps every abort fact per thread (a second abort in the same thread can now match a later flow) and joins exactly by run id when present.
- Fixed SQL `LIKE` patterns where `_` acted as a wildcard — actions like `restarted` no longer miscount as `*_started`.
- The relationships table gained `from_system`/`to_system`/`metadata` columns (added automatically to existing tables).

A shared edge-case fixture now pins the ClickHouse rules to the in-memory reference — both adapters produce identical statuses and durations.
