---
'@mastra/clickhouse': patch
---

Fixed `listScores` in the ClickHouse store returning scores in an unstable order when several scores share the same timestamp or value. Pages no longer repeat or skip scores in that case; ties are now ordered by score ID in the same direction as the requested sort.
