---
'@mastra/clickhouse': patch
---

Fixed a flaky ClickHouse store test that could fail when an old discovery view refreshed while the test was running.
